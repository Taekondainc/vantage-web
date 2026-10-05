import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import type {
  CloudMembership,
  CloudObjectiveSet,
  CloudProject,
  CloudRecommendation,
  CloudSession,
  CloudSubmittedReport,
  CloudTask,
  CloudUser,
  MembershipStatus,
  ObjectiveItem,
  CloudRole,
  SubmittedReportPr,
  SubmittedReportStats,
} from "../../shared/types";
import { getSupabase, supabaseConfigured } from "./supabase";

const STORE_PATH = resolve(process.cwd(), "data/store.json");

export const SESSION_MS = 1000 * 60 * 60 * 24 * 30;

export type StoreData = {
  users: CloudUser[];
  sessions: CloudSession[];
  projects: CloudProject[];
  memberships: CloudMembership[];
  reports: CloudSubmittedReport[];
  recommendations: CloudRecommendation[];
  tasks: CloudTask[];
  objectiveSets: CloudObjectiveSet[];
};

function emptyStore(): StoreData {
  return {
    users: [],
    sessions: [],
    projects: [],
    memberships: [],
    reports: [],
    recommendations: [],
    tasks: [],
    objectiveSets: [],
  };
}

let jsonCache: StoreData | null = null;

export function newId() {
  return randomUUID();
}

export function newToken() {
  return randomBytes(32).toString("hex");
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function findUser(data: StoreData, userId: string) {
  return data.users.find((user) => user.id === userId) ?? null;
}

export function findUserByGithubId(data: StoreData, githubId: number) {
  return data.users.find((user) => user.githubId === githubId) ?? null;
}

export function findSession(data: StoreData, token: string) {
  const session = data.sessions.find((item) => item.token === token) ?? null;
  if (!session) return null;
  if (Date.parse(session.expiresAt) <= Date.now()) return null;
  return session;
}

export function purgeExpiredSessions(data: StoreData) {
  const now = Date.now();
  data.sessions = data.sessions.filter((session) => Date.parse(session.expiresAt) > now);
}

export function normalizeLogin(login: string) {
  return login.trim().replace(/^@/, "").toLowerCase();
}

function readJsonStore(): StoreData {
  if (jsonCache) return jsonCache;
  if (!existsSync(STORE_PATH)) {
    jsonCache = emptyStore();
    return jsonCache;
  }
  try {
    const parsed = JSON.parse(readFileSync(STORE_PATH, "utf8")) as Partial<StoreData>;
    jsonCache = {
      users: parsed.users ?? [],
      sessions: parsed.sessions ?? [],
      projects: parsed.projects ?? [],
      memberships: parsed.memberships ?? [],
      reports: parsed.reports ?? [],
      recommendations: parsed.recommendations ?? [],
      tasks: parsed.tasks ?? [],
      objectiveSets: parsed.objectiveSets ?? [],
    };
    return jsonCache;
  } catch {
    jsonCache = emptyStore();
    return jsonCache;
  }
}

function writeJsonStore(data: StoreData) {
  jsonCache = data;
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
}

type SbError = { message: string; code?: string } | null;

function unwrap<T>(data: T | null, error: SbError, fallback: T): T {
  if (error) throw new HttpError(502, `Supabase: ${error.message}`);
  return data ?? fallback;
}

function mapUser(row: {
  id: string;
  github_id: number | string;
  login: string;
  name: string | null;
  avatar_url: string | null;
  github_token_enc?: string | null;
}): CloudUser {
  return {
    id: row.id,
    githubId: Number(row.github_id),
    login: row.login,
    name: row.name,
    avatarUrl: row.avatar_url,
    githubTokenEnc: row.github_token_enc ?? null,
  };
}

function mapProject(row: {
  id: string;
  name: string;
  description: string;
  lead_user_id: string;
  created_at: string;
}): CloudProject {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    leadUserId: row.lead_user_id,
    createdAt: row.created_at,
  };
}

function mapMembership(row: {
  id: string;
  project_id: string;
  user_id: string | null;
  github_login: string;
  role: string;
  status: string;
  invited_at: string;
}): CloudMembership {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    githubLogin: row.github_login,
    role: row.role as CloudRole,
    status: row.status as MembershipStatus,
    invitedAt: row.invited_at,
  };
}

function mapStats(raw: unknown): SubmittedReportStats {
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

function mapPrs(raw: unknown): SubmittedReportPr[] {
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
    .filter((item) => item.title && item.url);
}

function mapReport(row: {
  id: string;
  project_id: string;
  author_user_id: string;
  year: number;
  month: number;
  markdown: string;
  stats: unknown;
  merged_prs: unknown;
  submitted_at: string;
}): CloudSubmittedReport {
  return {
    id: row.id,
    projectId: row.project_id,
    authorUserId: row.author_user_id,
    year: row.year,
    month: row.month,
    markdown: row.markdown,
    stats: mapStats(row.stats),
    mergedPrs: mapPrs(row.merged_prs),
    submittedAt: row.submitted_at,
  };
}

function mapRecommendation(row: {
  id: string;
  project_id: string;
  author_user_id: string;
  target_user_id: string;
  report_id: string | null;
  year: number;
  month: number;
  body: string;
  created_at: string;
  updated_at: string;
}): CloudRecommendation {
  return {
    id: row.id,
    projectId: row.project_id,
    authorUserId: row.author_user_id,
    targetUserId: row.target_user_id,
    reportId: row.report_id,
    year: row.year,
    month: row.month,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTask(row: {
  id: string;
  owner_user_id: string;
  title: string;
  description: string | null;
  status: string;
  repo: string | null;
  branch_name: string | null;
  source: string;
  issue_key: string | null;
  created_at: string;
  expected_finish_at: string | null;
  finished_at: string | null;
  updated_at: string;
}): CloudTask {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    title: row.title,
    description: row.description,
    status: row.status as CloudTask["status"],
    repo: row.repo,
    branchName: row.branch_name,
    source: row.source as CloudTask["source"],
    issueKey: row.issue_key,
    createdAt: row.created_at,
    expectedFinishAt: row.expected_finish_at,
    finishedAt: row.finished_at,
    updatedAt: row.updated_at,
  };
}

type ObjectiveSetRow = {
  id: string;
  owner_user_id: string;
  kind: string;
  title: string;
  source_name: string | null;
  repo: string | null;
  branch_name: string | null;
  created_at: string;
  updated_at: string;
};

function mapObjectiveSetHeader(row: ObjectiveSetRow): Omit<CloudObjectiveSet, "items"> {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    kind: row.kind as CloudObjectiveSet["kind"],
    title: row.title,
    sourceName: row.source_name,
    repo: row.repo,
    branchName: row.branch_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapObjectiveItem(row: {
  id: string;
  set_id: string;
  text: string;
  status: string;
  jira_issue_key: string | null;
  jira_url: string | null;
  sort_order: number;
}): ObjectiveItem & { setId: string; sortOrder: number } {
  return {
    id: row.id,
    setId: row.set_id,
    text: row.text,
    status: row.status as ObjectiveItem["status"],
    jiraIssueKey: row.jira_issue_key,
    jiraUrl: row.jira_url,
    sortOrder: row.sort_order,
  };
}

async function readSupabaseStore(): Promise<StoreData> {
  const sb = getSupabase();
  const [users, sessions, projects, memberships, reports, recommendations, tasks, objectiveSets, objectiveItems] =
    await Promise.all([
      sb.from("vantage_users").select("*"),
      sb.from("vantage_sessions").select("*"),
      sb.from("vantage_projects").select("*"),
      sb.from("vantage_memberships").select("*"),
      sb.from("vantage_reports").select("*"),
      sb.from("vantage_recommendations").select("*"),
      sb.from("vantage_tasks").select("*"),
      sb.from("vantage_objective_sets").select("*"),
      sb.from("vantage_objective_items").select("*").order("sort_order", { ascending: true }),
    ]);

  const itemRows = unwrap(objectiveItems.data, objectiveItems.error, []).map(mapObjectiveItem);
  const itemsBySet = new Map<string, ObjectiveItem[]>();
  for (const { setId, sortOrder: _sortOrder, ...item } of itemRows) {
    const list = itemsBySet.get(setId) ?? [];
    list.push(item);
    itemsBySet.set(setId, list);
  }

  return {
    users: unwrap(users.data, users.error, []).map(mapUser),
    sessions: unwrap(sessions.data, sessions.error, []).map((row) => ({
      token: row.token as string,
      userId: row.user_id as string,
      expiresAt: row.expires_at as string,
    })),
    projects: unwrap(projects.data, projects.error, []).map(mapProject),
    memberships: unwrap(memberships.data, memberships.error, []).map(mapMembership),
    reports: unwrap(reports.data, reports.error, []).map(mapReport),
    recommendations: unwrap(recommendations.data, recommendations.error, []).map(mapRecommendation),
    tasks: unwrap(tasks.data, tasks.error, []).map(mapTask),
    objectiveSets: unwrap(objectiveSets.data, objectiveSets.error, []).map((row: ObjectiveSetRow) => ({
      ...mapObjectiveSetHeader(row),
      items: itemsBySet.get(row.id) ?? [],
    })),
  };
}

function ids(rows: { id: string }[]) {
  return new Set(rows.map((row) => row.id));
}

async function deleteMissing(
  table: string,
  column: string,
  prevIds: string[],
  nextIds: Set<string>,
) {
  const removed = prevIds.filter((id) => !nextIds.has(id));
  if (!removed.length) return;
  const { error } = await getSupabase().from(table).delete().in(column, removed);
  if (error) throw new HttpError(502, `Supabase: ${error.message}`);
}

async function writeSupabaseStore(prev: StoreData, next: StoreData) {
  const sb = getSupabase();

  if (next.users.length) {
    const { error } = await sb.from("vantage_users").upsert(
      next.users.map((user) => ({
        id: user.id,
        github_id: user.githubId,
        login: user.login,
        name: user.name,
        avatar_url: user.avatarUrl,
        github_token_enc: user.githubTokenEnc ?? null,
      })),
    );
    if (error) throw new HttpError(502, `Supabase: ${error.message}`);
  }

  if (next.projects.length) {
    const { error } = await sb.from("vantage_projects").upsert(
      next.projects.map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        lead_user_id: project.leadUserId,
        created_at: project.createdAt,
      })),
    );
    if (error) throw new HttpError(502, `Supabase: ${error.message}`);
  }

  if (next.memberships.length) {
    const { error } = await sb.from("vantage_memberships").upsert(
      next.memberships.map((membership) => ({
        id: membership.id,
        project_id: membership.projectId,
        user_id: membership.userId,
        github_login: membership.githubLogin,
        role: membership.role,
        status: membership.status,
        invited_at: membership.invitedAt,
      })),
    );
    if (error) throw new HttpError(502, `Supabase: ${error.message}`);
  }

  if (next.reports.length) {
    const { error } = await sb.from("vantage_reports").upsert(
      next.reports.map((report) => ({
        id: report.id,
        project_id: report.projectId,
        author_user_id: report.authorUserId,
        year: report.year,
        month: report.month,
        markdown: report.markdown,
        stats: report.stats,
        merged_prs: report.mergedPrs,
        submitted_at: report.submittedAt,
      })),
    );
    if (error) throw new HttpError(502, `Supabase: ${error.message}`);
  }

  if (next.recommendations.length) {
    const { error } = await sb.from("vantage_recommendations").upsert(
      next.recommendations.map((rec) => ({
        id: rec.id,
        project_id: rec.projectId,
        author_user_id: rec.authorUserId,
        target_user_id: rec.targetUserId,
        report_id: rec.reportId,
        year: rec.year,
        month: rec.month,
        body: rec.body,
        created_at: rec.createdAt,
        updated_at: rec.updatedAt,
      })),
    );
    if (error) throw new HttpError(502, `Supabase: ${error.message}`);
  }

  if (next.sessions.length) {
    const { error } = await sb.from("vantage_sessions").upsert(
      next.sessions.map((session) => ({
        token: session.token,
        user_id: session.userId,
        expires_at: session.expiresAt,
      })),
    );
    if (error) throw new HttpError(502, `Supabase: ${error.message}`);
  }

  if (next.tasks.length) {
    const { error } = await sb.from("vantage_tasks").upsert(
      next.tasks.map((task) => ({
        id: task.id,
        owner_user_id: task.ownerUserId,
        title: task.title,
        description: task.description,
        status: task.status,
        repo: task.repo,
        branch_name: task.branchName,
        source: task.source,
        issue_key: task.issueKey,
        created_at: task.createdAt,
        expected_finish_at: task.expectedFinishAt,
        finished_at: task.finishedAt,
        updated_at: task.updatedAt,
      })),
    );
    if (error) throw new HttpError(502, `Supabase: ${error.message}`);
  }

  if (next.objectiveSets.length) {
    const { error } = await sb.from("vantage_objective_sets").upsert(
      next.objectiveSets.map((set) => ({
        id: set.id,
        owner_user_id: set.ownerUserId,
        kind: set.kind,
        title: set.title,
        source_name: set.sourceName,
        repo: set.repo,
        branch_name: set.branchName,
        created_at: set.createdAt,
        updated_at: set.updatedAt,
      })),
    );
    if (error) throw new HttpError(502, `Supabase: ${error.message}`);
  }

  const nextItemRows = next.objectiveSets.flatMap((set) =>
    set.items.map((item, index) => ({
      id: item.id,
      set_id: set.id,
      text: item.text,
      status: item.status,
      jira_issue_key: item.jiraIssueKey ?? null,
      jira_url: item.jiraUrl ?? null,
      sort_order: index,
    })),
  );
  if (nextItemRows.length) {
    const { error } = await sb.from("vantage_objective_items").upsert(nextItemRows);
    if (error) throw new HttpError(502, `Supabase: ${error.message}`);
  }
  const prevItemIds = prev.objectiveSets.flatMap((set) => set.items.map((item) => item.id));
  await deleteMissing(
    "vantage_objective_items",
    "id",
    prevItemIds,
    new Set(nextItemRows.map((row) => row.id)),
  );

  await deleteMissing("vantage_sessions", "token", prev.sessions.map((row) => row.token), new Set(next.sessions.map((row) => row.token)));
  await deleteMissing("vantage_recommendations", "id", prev.recommendations.map((row) => row.id), ids(next.recommendations));
  await deleteMissing("vantage_reports", "id", prev.reports.map((row) => row.id), ids(next.reports));
  await deleteMissing("vantage_memberships", "id", prev.memberships.map((row) => row.id), ids(next.memberships));
  await deleteMissing("vantage_projects", "id", prev.projects.map((row) => row.id), ids(next.projects));
  await deleteMissing("vantage_users", "id", prev.users.map((row) => row.id), ids(next.users));
  await deleteMissing("vantage_tasks", "id", prev.tasks.map((row) => row.id), ids(next.tasks));
  await deleteMissing("vantage_objective_sets", "id", prev.objectiveSets.map((row) => row.id), ids(next.objectiveSets));
}

export async function readStore(): Promise<StoreData> {
  if (supabaseConfigured()) return readSupabaseStore();
  return readJsonStore();
}

export async function mutateStore<T>(fn: (data: StoreData) => T): Promise<T> {
  if (!supabaseConfigured()) {
    const data = readJsonStore();
    const result = fn(data);
    writeJsonStore(data);
    return result;
  }
  const prev = await readSupabaseStore();
  const next: StoreData = {
    users: [...prev.users],
    sessions: [...prev.sessions],
    projects: [...prev.projects],
    memberships: [...prev.memberships],
    reports: [...prev.reports],
    recommendations: [...prev.recommendations],
    tasks: [...prev.tasks],
    objectiveSets: prev.objectiveSets.map((set) => ({ ...set, items: [...set.items] })),
  };
  const result = fn(next);
  await writeSupabaseStore(prev, next);
  return result;
}
