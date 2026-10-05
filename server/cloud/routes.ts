import { Hono } from "hono";
import type {
  CloudMemberView,
  CloudMembership,
  CloudObjectiveSet,
  CloudProject,
  CloudProjectDetail,
  CloudProjectSummary,
  CloudRecommendation,
  CloudRecommendationView,
  CloudReportView,
  CloudRole,
  CloudSubmittedReport,
  CloudTask,
  CloudUser,
  ObjectiveItemStatus,
  SubmittedReportPr,
  SubmittedReportStats,
} from "../../shared/types";
import { requireAuth, type AuthEnv } from "./auth";
import { consumeUsage } from "./billing";
import { mePayload, pendingInvitesFor, getUserGithubToken } from "./users";
import { createBranch } from "../branches";
import {
  deleteProjectFile,
  listMyFiles,
  listProjectFiles,
  signedFileUrl,
  uploadProjectFile,
} from "./files";
import {
  findUser,
  HttpError,
  mutateStore,
  newId,
  normalizeLogin,
  readStore,
  type StoreData,
} from "./store";

const MONTHS_OK = (year: number, month: number) =>
  Number.isInteger(year) && year >= 2000 && year <= 2100 && Number.isInteger(month) && month >= 1 && month <= 12;

function userById(data: StoreData, id: string | null) {
  if (!id) return null;
  return findUser(data, id);
}

function membershipFor(data: StoreData, projectId: string, user: CloudUser) {
  const login = normalizeLogin(user.login);
  return (
    data.memberships.find(
      (membership) =>
        membership.projectId === projectId &&
        (membership.userId === user.id || normalizeLogin(membership.githubLogin) === login),
    ) ?? null
  );
}

function requireProjectAccess(data: StoreData, projectId: string, user: CloudUser) {
  const project = data.projects.find((item) => item.id === projectId);
  if (!project) throw new HttpError(404, "Project not found.");
  const membership = membershipFor(data, projectId, user);
  if (!membership || membership.status !== "active") {
    throw new HttpError(403, "You are not a member of this project.");
  }
  return { project, membership };
}

function requireLead(data: StoreData, projectId: string, user: CloudUser) {
  const access = requireProjectAccess(data, projectId, user);
  if (access.membership.role !== "lead" && access.project.leadUserId !== user.id) {
    throw new HttpError(403, "Only the project lead can do that.");
  }
  return access;
}

function memberView(data: StoreData, membership: CloudMembership): CloudMemberView {
  const user = userById(data, membership.userId);
  return {
    ...membership,
    name: user?.name ?? null,
    avatarUrl: user?.avatarUrl ?? null,
  };
}

function projectSummary(data: StoreData, project: CloudProject, role: CloudRole): CloudProjectSummary {
  return {
    ...project,
    role,
    memberCount: data.memberships.filter(
      (membership) => membership.projectId === project.id && membership.status === "active",
    ).length,
  };
}

function projectDetail(data: StoreData, project: CloudProject, role: CloudRole): CloudProjectDetail {
  return {
    ...project,
    role,
    members: data.memberships
      .filter((membership) => membership.projectId === project.id)
      .map((membership) => memberView(data, membership))
      .sort((a, b) => {
        if (a.role !== b.role) return a.role === "lead" ? -1 : 1;
        return a.githubLogin.localeCompare(b.githubLogin);
      }),
  };
}

function reportView(data: StoreData, report: CloudSubmittedReport): CloudReportView {
  const author = userById(data, report.authorUserId);
  return {
    ...report,
    authorLogin: author?.login || "unknown",
    authorName: author?.name ?? null,
    authorAvatarUrl: author?.avatarUrl ?? null,
  };
}

function recommendationView(data: StoreData, rec: CloudRecommendation): CloudRecommendationView {
  const author = userById(data, rec.authorUserId);
  const target = userById(data, rec.targetUserId);
  const project = data.projects.find((item) => item.id === rec.projectId);
  return {
    ...rec,
    authorLogin: author?.login || "unknown",
    authorName: author?.name ?? null,
    targetLogin: target?.login || "unknown",
    targetName: target?.name ?? null,
    projectName: project?.name || "Project",
  };
}

function visibleReports(data: StoreData, projectId: string, user: CloudUser, isLead: boolean) {
  return data.reports.filter((report) => {
    if (report.projectId !== projectId) return false;
    return isLead || report.authorUserId === user.id;
  });
}

function visibleRecommendations(data: StoreData, projectId: string, user: CloudUser, isLead: boolean) {
  return data.recommendations.filter((rec) => {
    if (rec.projectId !== projectId) return false;
    return isLead || rec.targetUserId === user.id || rec.authorUserId === user.id;
  });
}

function parseStats(raw: unknown): SubmittedReportStats {
  const stats = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (key: string) => {
    const value = Number(stats[key] ?? 0);
    return Number.isFinite(value) ? value : 0;
  };
  return {
    prsMerged: num("prsMerged"),
    prsOpen: num("prsOpen"),
    prsClosed: num("prsClosed"),
    commits: num("commits"),
    repos: num("repos"),
    additions: num("additions"),
    deletions: num("deletions"),
  };
}

function parseMergedPrs(raw: unknown): SubmittedReportPr[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return {
        title: String(row.title || "").trim(),
        url: String(row.url || "").trim(),
        repo: String(row.repo || "").trim(),
      };
    })
    .filter((item) => item.title && item.url)
    .slice(0, 200);
}

function handle(err: unknown) {
  if (err instanceof HttpError) return err;
  return new HttpError(500, err instanceof Error ? err.message : "Request failed.");
}

export const cloudRoutes = new Hono<AuthEnv>();

cloudRoutes.use("/me", requireAuth);
cloudRoutes.use("/me/*", requireAuth);
cloudRoutes.use("/invites/*", requireAuth);
cloudRoutes.use("/projects", requireAuth);
cloudRoutes.use("/projects/*", requireAuth);
cloudRoutes.use("/recommendations/*", requireAuth);
cloudRoutes.use("/files/*", requireAuth);
cloudRoutes.use("/tasks", requireAuth);
cloudRoutes.use("/tasks/*", requireAuth);
cloudRoutes.use("/objectives", requireAuth);
cloudRoutes.use("/objectives/*", requireAuth);
cloudRoutes.use("/github/branches", requireAuth);

cloudRoutes.get("/me", async (c) => {
  return c.json(await mePayload(c.get("user")));
});

cloudRoutes.get("/me/recommendations", async (c) => {
  const user = c.get("user");
  const year = Number(c.req.query("year") || 0);
  const month = Number(c.req.query("month") || 0);
  const data = await readStore();
  const recs = data.recommendations.filter((rec) => {
    if (rec.targetUserId !== user.id) return false;
    if (year && rec.year !== year) return false;
    if (month && rec.month !== month) return false;
    return true;
  });
  return c.json(recs.map((rec) => recommendationView(data, rec)));
});

cloudRoutes.get("/me/files", async (c) => {
  try {
    return c.json(await listMyFiles(c.get("user")));
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

cloudRoutes.get("/me/sync", async (c) => {
  const user = c.get("user");
  const year = Number(c.req.query("year") || 0);
  const month = Number(c.req.query("month") || 0);
  try {
    const data = await readStore();
    const login = normalizeLogin(user.login);
    const seen = new Set<string>();
    const projects: CloudProjectSummary[] = [];
    for (const membership of data.memberships) {
      if (membership.status !== "active") continue;
      if (membership.userId !== user.id && normalizeLogin(membership.githubLogin) !== login) continue;
      if (seen.has(membership.projectId)) continue;
      const project = data.projects.find((item) => item.id === membership.projectId);
      if (!project) continue;
      seen.add(project.id);
      projects.push(projectSummary(data, project, membership.role));
    }
    const recs = data.recommendations.filter((rec) => {
      if (rec.targetUserId !== user.id && rec.authorUserId !== user.id) return false;
      if (year && rec.year !== year) return false;
      if (month && rec.month !== month) return false;
      return true;
    });
    const files = await listMyFiles(user).catch(() => []);
    return c.json({
      user,
      invites: pendingInvitesFor(data, user),
      projects,
      recommendations: recs.map((rec) => recommendationView(data, rec)),
      files,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

cloudRoutes.post("/invites/:id/accept", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  try {
    const invite = await mutateStore((data) => {
      const membership = data.memberships.find((item) => item.id === id);
      if (!membership || membership.status !== "invited") {
        throw new HttpError(404, "Invite not found.");
      }
      const login = normalizeLogin(user.login);
      if (membership.userId !== user.id && normalizeLogin(membership.githubLogin) !== login) {
        throw new HttpError(403, "That invite is for a different GitHub account.");
      }
      membership.userId = user.id;
      membership.status = "active";
      membership.githubLogin = user.login;
      const project = data.projects.find((item) => item.id === membership.projectId);
      if (!project) throw new HttpError(404, "Project not found.");
      return projectSummary(data, project, membership.role);
    });
    return c.json(invite);
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

cloudRoutes.get("/projects", async (c) => {
  const user = c.get("user");
  const data = await readStore();
  const login = normalizeLogin(user.login);
  const seen = new Set<string>();
  const projects: CloudProjectSummary[] = [];
  for (const membership of data.memberships) {
    if (membership.status !== "active") continue;
    if (membership.userId !== user.id && normalizeLogin(membership.githubLogin) !== login) continue;
    if (seen.has(membership.projectId)) continue;
    const project = data.projects.find((item) => item.id === membership.projectId);
    if (!project) continue;
    seen.add(project.id);
    projects.push(projectSummary(data, project, membership.role));
  }
  projects.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return c.json(projects);
});

cloudRoutes.post("/projects", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => null)) as { name?: string; description?: string } | null;
  const name = String(body?.name || "").trim();
  if (!name) return c.json({ error: "name is required" }, 400);
  const description = String(body?.description || "").trim();
  const project = await mutateStore((data) => {
    const created: CloudProject = {
      id: newId(),
      name: name.slice(0, 120),
      description: description.slice(0, 500),
      leadUserId: user.id,
      createdAt: new Date().toISOString(),
    };
    data.projects.push(created);
    data.memberships.push({
      id: newId(),
      projectId: created.id,
      userId: user.id,
      githubLogin: user.login,
      role: "lead",
      status: "active",
      invitedAt: created.createdAt,
    });
    return projectDetail(data, created, "lead");
  });
  return c.json(project, 201);
});

cloudRoutes.get("/projects/:id", async (c) => {
  const user = c.get("user");
  try {
    const data = await readStore();
    const { project, membership } = requireProjectAccess(data, c.req.param("id"), user);
    return c.json(projectDetail(data, project, membership.role));
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

cloudRoutes.patch("/projects/:id", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => null)) as { name?: string; description?: string } | null;
  try {
    const updated = await mutateStore((data) => {
      const { project } = requireLead(data, c.req.param("id"), user);
      if (typeof body?.name === "string") {
        const name = body.name.trim();
        if (!name) throw new HttpError(400, "name is required");
        project.name = name.slice(0, 120);
      }
      if (typeof body?.description === "string") {
        project.description = body.description.trim().slice(0, 500);
      }
      return projectDetail(data, project, "lead");
    });
    return c.json(updated);
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

cloudRoutes.post("/projects/:id/members", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => null)) as { githubLogin?: string } | null;
  const githubLogin = String(body?.githubLogin || "").trim().replace(/^@/, "");
  if (!githubLogin) return c.json({ error: "githubLogin is required" }, 400);
  try {
    const member = await mutateStore((data) => {
      const { project } = requireLead(data, c.req.param("id"), user);
      const login = normalizeLogin(githubLogin);
      const duplicate = data.memberships.find(
        (membership) => membership.projectId === project.id && normalizeLogin(membership.githubLogin) === login,
      );
      if (duplicate) throw new HttpError(409, "That GitHub user is already on this project.");
      const existingUser = data.users.find((item) => normalizeLogin(item.login) === login) ?? null;
      const membership: CloudMembership = {
        id: newId(),
        projectId: project.id,
        userId: existingUser?.id ?? null,
        githubLogin: existingUser?.login || githubLogin,
        role: "member",
        status: "invited",
        invitedAt: new Date().toISOString(),
      };
      data.memberships.push(membership);
      return memberView(data, membership);
    });
    return c.json(member, 201);
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

cloudRoutes.delete("/projects/:id/members/:login", async (c) => {
  const user = c.get("user");
  const login = normalizeLogin(c.req.param("login"));
  try {
    await mutateStore((data) => {
      const { project } = requireLead(data, c.req.param("id"), user);
      const membership = data.memberships.find(
        (item) => item.projectId === project.id && normalizeLogin(item.githubLogin) === login,
      );
      if (!membership) throw new HttpError(404, "Member not found.");
      if (membership.role === "lead" || membership.userId === project.leadUserId) {
        throw new HttpError(400, "The project lead cannot be removed.");
      }
      data.memberships = data.memberships.filter((item) => item.id !== membership.id);
    });
    return c.json({ ok: true });
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

cloudRoutes.get("/projects/:id/reports", async (c) => {
  const user = c.get("user");
  const year = Number(c.req.query("year") || 0);
  const month = Number(c.req.query("month") || 0);
  try {
    const data = await readStore();
    const { project, membership } = requireProjectAccess(data, c.req.param("id"), user);
    const isLead = membership.role === "lead" || project.leadUserId === user.id;
    let reports = visibleReports(data, project.id, user, isLead);
    if (year) reports = reports.filter((report) => report.year === year);
    if (month) reports = reports.filter((report) => report.month === month);
    reports.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return c.json(reports.map((report) => reportView(data, report)));
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

cloudRoutes.post("/projects/:id/reports", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => null)) as {
    year?: number;
    month?: number;
    markdown?: string;
    stats?: unknown;
    mergedPrs?: unknown;
  } | null;
  const year = Number(body?.year);
  const month = Number(body?.month);
  const markdown = String(body?.markdown || "").trim();
  if (!MONTHS_OK(year, month)) return c.json({ error: "Valid year and month are required." }, 400);
  if (!markdown) return c.json({ error: "markdown is required" }, 400);
  try {
    const data = await readStore();
    requireProjectAccess(data, c.req.param("id"), user);
    const existing = data.reports.find(
      (report) =>
        report.projectId === c.req.param("id") &&
        report.authorUserId === user.id &&
        report.year === year &&
        report.month === month,
    );
    if (!existing) await consumeUsage(user.id, "report");
    const saved = await mutateStore((store) => {
      requireProjectAccess(store, c.req.param("id"), user);
      const projectId = c.req.param("id");
      const existing = store.reports.find(
        (report) =>
          report.projectId === projectId &&
          report.authorUserId === user.id &&
          report.year === year &&
          report.month === month,
      );
      const payload: CloudSubmittedReport = {
        id: existing?.id || newId(),
        projectId,
        authorUserId: user.id,
        year,
        month,
        markdown: markdown.slice(0, 200_000),
        stats: parseStats(body?.stats),
        mergedPrs: parseMergedPrs(body?.mergedPrs),
        submittedAt: new Date().toISOString(),
      };
      if (existing) Object.assign(existing, payload);
      else data.reports.push(payload);
      return reportView(data, payload);
    });
    void uploadProjectFile(c.req.param("id"), user, {
      name: `${year}-${String(month).padStart(2, "0")}-report.md`,
      mime: "text/markdown",
      contentBase64: Buffer.from(markdown.slice(0, 200_000), "utf8").toString("base64"),
      year,
      month,
      reportId: saved.id,
    }).catch(() => undefined);
    return c.json(saved, 201);
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

cloudRoutes.get("/projects/:id/recommendations", async (c) => {
  const user = c.get("user");
  const year = Number(c.req.query("year") || 0);
  const month = Number(c.req.query("month") || 0);
  const targetUserId = c.req.query("targetUserId") || "";
  try {
    const data = await readStore();
    const { project, membership } = requireProjectAccess(data, c.req.param("id"), user);
    const isLead = membership.role === "lead" || project.leadUserId === user.id;
    let recs = visibleRecommendations(data, project.id, user, isLead);
    if (year) recs = recs.filter((rec) => rec.year === year);
    if (month) recs = recs.filter((rec) => rec.month === month);
    if (targetUserId) recs = recs.filter((rec) => rec.targetUserId === targetUserId);
    recs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return c.json(recs.map((rec) => recommendationView(data, rec)));
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

cloudRoutes.post("/projects/:id/recommendations", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => null)) as {
    targetUserId?: string;
    year?: number;
    month?: number;
    body?: string;
    reportId?: string | null;
  } | null;
  const targetUserId = String(body?.targetUserId || "").trim();
  const year = Number(body?.year);
  const month = Number(body?.month);
  const text = String(body?.body || "").trim();
  const reportId = body?.reportId ? String(body.reportId).trim() : null;
  if (!targetUserId) return c.json({ error: "targetUserId is required" }, 400);
  if (!MONTHS_OK(year, month)) return c.json({ error: "Valid year and month are required." }, 400);
  if (!text) return c.json({ error: "body is required" }, 400);
  try {
    const created = await mutateStore((data) => {
      const { project } = requireLead(data, c.req.param("id"), user);
      const targetMember = data.memberships.find(
        (membership) =>
          membership.projectId === project.id &&
          membership.userId === targetUserId &&
          membership.status === "active",
      );
      if (!targetMember) throw new HttpError(400, "That person is not an active member of this project.");
      if (reportId) {
        const report = data.reports.find((item) => item.id === reportId && item.projectId === project.id);
        if (!report) throw new HttpError(404, "Report not found.");
        if (report.authorUserId !== targetUserId) {
          throw new HttpError(400, "That report does not belong to the selected member.");
        }
      }
      const rec: CloudRecommendation = {
        id: newId(),
        projectId: project.id,
        authorUserId: user.id,
        targetUserId,
        reportId,
        year,
        month,
        body: text.slice(0, 8000),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      data.recommendations.push(rec);
      return recommendationView(data, rec);
    });
    return c.json(created, 201);
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

cloudRoutes.patch("/recommendations/:id", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => null)) as { body?: string } | null;
  const text = String(body?.body || "").trim();
  if (!text) return c.json({ error: "body is required" }, 400);
  try {
    const updated = await mutateStore((data) => {
      const rec = data.recommendations.find((item) => item.id === c.req.param("id"));
      if (!rec) throw new HttpError(404, "Recommendation not found.");
      const { project, membership } = requireProjectAccess(data, rec.projectId, user);
      const isLead = membership.role === "lead" || project.leadUserId === user.id;
      if (rec.authorUserId !== user.id && !isLead) {
        throw new HttpError(403, "You cannot edit that recommendation.");
      }
      rec.body = text.slice(0, 8000);
      rec.updatedAt = new Date().toISOString();
      return recommendationView(data, rec);
    });
    return c.json(updated);
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

cloudRoutes.delete("/recommendations/:id", async (c) => {
  const user = c.get("user");
  try {
    await mutateStore((data) => {
      const rec = data.recommendations.find((item) => item.id === c.req.param("id"));
      if (!rec) throw new HttpError(404, "Recommendation not found.");
      const { project, membership } = requireProjectAccess(data, rec.projectId, user);
      const isLead = membership.role === "lead" || project.leadUserId === user.id;
      if (rec.authorUserId !== user.id && !isLead) {
        throw new HttpError(403, "You cannot delete that recommendation.");
      }
      data.recommendations = data.recommendations.filter((item) => item.id !== rec.id);
    });
    return c.json({ ok: true });
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

cloudRoutes.get("/projects/:id/files", async (c) => {
  try {
    return c.json(await listProjectFiles(c.req.param("id"), c.get("user")));
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

cloudRoutes.post("/projects/:id/files", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    name?: string;
    mime?: string;
    contentBase64?: string;
    year?: number | null;
    month?: number | null;
    reportId?: string | null;
  } | null;
  const name = String(body?.name || "").trim();
  const contentBase64 = String(body?.contentBase64 || "").trim();
  if (!name) return c.json({ error: "name is required" }, 400);
  if (!contentBase64) return c.json({ error: "contentBase64 is required" }, 400);
  try {
    const file = await uploadProjectFile(c.req.param("id"), c.get("user"), {
      name,
      mime: body?.mime,
      contentBase64,
      year: body?.year ?? null,
      month: body?.month ?? null,
      reportId: body?.reportId ?? null,
    });
    return c.json(file, 201);
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

cloudRoutes.get("/files/:id/url", async (c) => {
  try {
    return c.json(await signedFileUrl(c.req.param("id"), c.get("user")));
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

cloudRoutes.delete("/files/:id", async (c) => {
  try {
    return c.json(await deleteProjectFile(c.req.param("id"), c.get("user")));
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

// --- Tasks & Objectives: personal data, never shared with other users ------

cloudRoutes.get("/tasks", async (c) => {
  const user = c.get("user");
  const data = await readStore();
  const tasks = data.tasks.filter((task) => task.ownerUserId === user.id);
  tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return c.json(tasks);
});

cloudRoutes.post("/tasks", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => null)) as Partial<CloudTask> | null;
  const title = String(body?.title || "").trim();
  if (!title) return c.json({ error: "title is required" }, 400);
  const now = new Date().toISOString();
  const created = await mutateStore((data) => {
    const task: CloudTask = {
      id: newId(),
      ownerUserId: user.id,
      title: title.slice(0, 300),
      description: body?.description?.trim() || null,
      status: body?.status || "todo",
      repo: body?.repo || null,
      branchName: body?.branchName || null,
      source: body?.source || "local",
      issueKey: body?.issueKey || null,
      createdAt: body?.createdAt || now,
      expectedFinishAt: body?.expectedFinishAt || null,
      finishedAt: null,
      updatedAt: now,
    };
    data.tasks.push(task);
    return task;
  });
  return c.json(created, 201);
});

cloudRoutes.post("/github/branches", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => null)) as { repo?: string; branchName?: string } | null;
  const repo = String(body?.repo || "").trim();
  const branchName = String(body?.branchName || "").trim();
  if (!repo || !branchName) return c.json({ error: "repo and branchName are required" }, 400);

  const token = await getUserGithubToken(user.id);
  if (!token) {
    return c.json({ error: "Connect GitHub with full access first — sign in again to grant it." }, 400);
  }

  try {
    const result = await createBranch(token, repo, branchName);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create the branch.";
    return c.json({ error: message }, 502 as 400);
  }
});

cloudRoutes.patch("/tasks/:id", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => null)) as Partial<CloudTask> | null;
  try {
    const updated = await mutateStore((data) => {
      const task = data.tasks.find((item) => item.id === c.req.param("id") && item.ownerUserId === user.id);
      if (!task) throw new HttpError(404, "Task not found.");
      if (typeof body?.title === "string") {
        const title = body.title.trim();
        if (!title) throw new HttpError(400, "title is required");
        task.title = title.slice(0, 300);
      }
      if (body && "description" in body) task.description = body.description?.trim() || null;
      if (body?.status) {
        task.status = body.status;
        task.finishedAt = body.status === "done" ? task.finishedAt || new Date().toISOString() : null;
      }
      if (body && "repo" in body) task.repo = body.repo || null;
      if (body && "branchName" in body) task.branchName = body.branchName || null;
      if (body && "expectedFinishAt" in body) task.expectedFinishAt = body.expectedFinishAt || null;
      task.updatedAt = new Date().toISOString();
      return task;
    });
    return c.json(updated);
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

cloudRoutes.delete("/tasks/:id", async (c) => {
  const user = c.get("user");
  await mutateStore((data) => {
    data.tasks = data.tasks.filter((item) => !(item.id === c.req.param("id") && item.ownerUserId === user.id));
  });
  return c.json({ ok: true });
});

cloudRoutes.get("/objectives", async (c) => {
  const user = c.get("user");
  const data = await readStore();
  const sets = data.objectiveSets.filter((set) => set.ownerUserId === user.id);
  sets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return c.json(sets);
});

cloudRoutes.post("/objectives", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => null)) as {
    kind?: string;
    title?: string;
    sourceName?: string | null;
    items?: string[];
    repo?: string | null;
    branchName?: string | null;
  } | null;
  const kind = body?.kind === "target" ? "target" : "objective";
  const items = (Array.isArray(body?.items) ? body.items : [])
    .map((text) => String(text).trim())
    .filter(Boolean);
  if (items.length === 0) {
    return c.json({ error: "No objectives could be drafted from that text. Try adding more detail." }, 400);
  }
  const repo = body?.repo?.trim() || null;
  const now = new Date().toISOString();
  const created = await mutateStore((data) => {
    const set: CloudObjectiveSet = {
      id: newId(),
      ownerUserId: user.id,
      kind,
      title: (body?.title || "").trim() || (kind === "target" ? "Targets" : "Objectives"),
      sourceName: body?.sourceName ?? null,
      repo,
      branchName: repo ? body?.branchName?.trim() || null : null,
      createdAt: now,
      updatedAt: now,
      items: items.map((text) => ({ id: newId(), text, status: "not-started" as ObjectiveItemStatus })),
    };
    data.objectiveSets.push(set);
    return set;
  });
  return c.json(created, 201);
});

cloudRoutes.patch("/objectives/:id", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => null)) as {
    title?: string;
    repo?: string | null;
    branchName?: string | null;
    itemUpdates?: Array<{ id: string; status?: ObjectiveItemStatus; jiraIssueKey?: string | null; jiraUrl?: string | null }>;
  } | null;
  try {
    const updated = await mutateStore((data) => {
      const set = data.objectiveSets.find((item) => item.id === c.req.param("id") && item.ownerUserId === user.id);
      if (!set) throw new HttpError(404, "Objective set not found.");
      if (typeof body?.title === "string") {
        const title = body.title.trim();
        if (title) set.title = title.slice(0, 200);
      }
      if (body && "repo" in body) {
        const repo = body.repo?.trim() || null;
        set.repo = repo;
        set.branchName = repo ? body.branchName?.trim() || null : null;
      }
      if (Array.isArray(body?.itemUpdates)) {
        const byId = new Map(body.itemUpdates.map((update) => [update.id, update]));
        for (const item of set.items) {
          const update = byId.get(item.id);
          if (!update) continue;
          if (update.status) item.status = update.status;
          if ("jiraIssueKey" in update) item.jiraIssueKey = update.jiraIssueKey ?? null;
          if ("jiraUrl" in update) item.jiraUrl = update.jiraUrl ?? null;
        }
      }
      set.updatedAt = new Date().toISOString();
      return set;
    });
    return c.json(updated);
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});

cloudRoutes.delete("/objectives/:id", async (c) => {
  const user = c.get("user");
  await mutateStore((data) => {
    data.objectiveSets = data.objectiveSets.filter(
      (item) => !(item.id === c.req.param("id") && item.ownerUserId === user.id),
    );
  });
  return c.json({ ok: true });
});

cloudRoutes.delete("/objectives/:id/items/:itemId", async (c) => {
  const user = c.get("user");
  try {
    await mutateStore((data) => {
      const set = data.objectiveSets.find((item) => item.id === c.req.param("id") && item.ownerUserId === user.id);
      if (!set) throw new HttpError(404, "Objective set not found.");
      set.items = set.items.filter((item) => item.id !== c.req.param("itemId"));
      set.updatedAt = new Date().toISOString();
    });
    return c.json({ ok: true });
  } catch (err) {
    const error = handle(err);
    return c.json({ error: error.message }, error.status as 400);
  }
});
