import type {
  CloudMe,
  CloudMemberView,
  CloudObjectiveSet,
  CodeAnalysis,
  CloudProjectDetail,
  CloudProjectSummary,
  CloudRecommendationView,
  CloudReportView,
  CloudFileView,
  CloudTask,
  CloudTaskInput,
  ExtractedScope,
  GenerateResponse,
  GithubMonthActivity,
  GithubProfileActivity,
  MonthReport,
  ObjectiveItemStatus,
  ObjectiveKind,
  SubmittedReportPr,
  SubmittedReportStats,
  TaskStatus,
} from "../shared/types";
import type { PaymentRecord } from "../shared/billing";
import { authHeaders, clearSession } from "./lib/session";

async function parseError(res: Response) {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error || res.statusText || "Request failed";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const auth = authHeaders();
  if ("Authorization" in auth) headers.set("Authorization", (auth as { Authorization: string }).Authorization);

  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    clearSession();
    throw new Error("Session expired. Sign in again.");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText || "Request failed");
  return data;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function resolveScope(text: string): Promise<ExtractedScope> {
  return postJson("/api/resolve-scope", { text });
}

export function generateObjectives(
  text: string,
  kind: ObjectiveKind,
  repo: string | null,
  branchName: string | null,
): Promise<GenerateResponse> {
  return postJson("/api/generate", { text, kind, repo, branchName });
}

export async function checkHealth(): Promise<{
  ok: boolean;
  ai: boolean;
  oauth: boolean;
  oauthMode: "redirect" | "device" | null;
  supabaseConfigured: boolean;
  supabase: boolean;
  polar: boolean;
}> {
  try {
    const res = await fetch("/api/health");
    const data = (await res.json()) as {
      ok?: boolean;
      ai?: boolean;
      oauth?: boolean;
      oauthMode?: "redirect" | "device" | null;
      supabaseConfigured?: boolean;
      supabase?: boolean;
      polar?: boolean;
    };
    return {
      ok: Boolean(res.ok && data.ok),
      ai: Boolean(data.ai),
      oauth: Boolean(data.oauth),
      oauthMode: data.oauthMode === "redirect" || data.oauthMode === "device" ? data.oauthMode : null,
      supabaseConfigured: Boolean(data.supabaseConfigured),
      supabase: Boolean(data.supabase),
      polar: Boolean(data.polar),
    };
  } catch {
    return { ok: false, ai: false, oauth: false, oauthMode: null, supabaseConfigured: false, supabase: false, polar: false };
  }
}

export async function startGithubDeviceFlow(next: string): Promise<{
  id: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}> {
  const res = await fetch("/api/auth/github/device", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ next }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    userCode?: string;
    verificationUri?: string;
    expiresIn?: number;
    interval?: number;
    error?: string;
  };
  if (!res.ok || !data.id || !data.userCode || !data.verificationUri) {
    throw new Error(data.error || "Could not start GitHub sign-in.");
  }
  return {
    id: data.id,
    userCode: data.userCode,
    verificationUri: data.verificationUri,
    expiresIn: data.expiresIn || 900,
    interval: data.interval || 5,
  };
}

export async function pollGithubDeviceFlow(id: string): Promise<
  | { status: "pending" }
  | { status: "slow_down"; interval: number }
  | { status: "ok"; token: string; user: { id: string; login: string; name: string | null; avatarUrl: string | null }; next: string }
  | { status: "error"; error: string }
> {
  const res = await fetch("/api/auth/github/device/poll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    status?: string;
    interval?: number;
    token?: string;
    user?: { id: string; login: string; name: string | null; avatarUrl: string | null };
    next?: string;
    error?: string;
  };
  if (data.status === "ok" && data.token && data.user) {
    return { status: "ok", token: data.token, user: data.user, next: data.next || "/app" };
  }
  if (data.status === "slow_down") return { status: "slow_down", interval: Number(data.interval) || 10 };
  if (data.status === "pending") return { status: "pending" };
  return { status: "error", error: data.error || "GitHub sign-in failed." };
}

export async function loadGithubProfile(username: string): Promise<GithubProfileActivity> {
  const res = await fetch(`/api/github/${encodeURIComponent(username)}`);
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as GithubProfileActivity;
}

export async function loadGithubMonth(
  username: string,
  year: number,
  month: number,
): Promise<GithubMonthActivity> {
  const res = await fetch(`/api/github/${encodeURIComponent(username)}/${year}/${month}`);
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as GithubMonthActivity;
}

/** Full authenticated report (private repos included) for the signed-in
 * user's own account — same shape vantagedestkop builds. */
export function loadMonthReport(year: number, month: number): Promise<MonthReport> {
  return request(`/api/reports/${year}/${month}`);
}

/** AI code review of the month's largest merged PRs' real diffs — generated
 * once per (account, month) and cached server-side, so this is safe to call
 * automatically right after the report loads. */
export function generateCodeAnalysis(year: number, month: number, force = false): Promise<CodeAnalysis> {
  const query = force ? "?force=true" : "";
  return request(`/api/reports/${year}/${month}/code-analysis${query}`, { method: "POST" });
}

export function loadMe(): Promise<CloudMe> {
  return request("/api/me");
}

export function startBillingCheckout(): Promise<{ url: string }> {
  return request("/api/billing/checkout", { method: "POST" });
}

export function openBillingPortal(): Promise<{ url: string }> {
  return request("/api/billing/portal", { method: "POST" });
}

export function listPayments(): Promise<PaymentRecord[]> {
  return request("/api/billing/payments");
}

export function saveBillingEmail(email: string): Promise<{ email: string }> {
  return request("/api/billing/email", { method: "PATCH", body: JSON.stringify({ email }) });
}

export function paymentDocumentUrl(id: string): Promise<{ url: string; name: string; mime: string }> {
  return request(`/api/billing/documents/${encodeURIComponent(id)}/url`);
}

export function logoutCloud(): Promise<{ ok: boolean }> {
  return request("/api/auth/logout", { method: "POST" });
}

export function acceptInvite(id: string): Promise<CloudProjectSummary> {
  return request(`/api/invites/${encodeURIComponent(id)}/accept`, { method: "POST" });
}

export function listProjects(): Promise<CloudProjectSummary[]> {
  return request("/api/projects");
}

export function createProject(name: string, description: string): Promise<CloudProjectDetail> {
  return postJson("/api/projects", { name, description });
}

export function loadProject(id: string): Promise<CloudProjectDetail> {
  return request(`/api/projects/${encodeURIComponent(id)}`);
}

export function updateProject(id: string, input: { name?: string; description?: string }): Promise<CloudProjectDetail> {
  return request(`/api/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function inviteMember(projectId: string, githubLogin: string): Promise<CloudMemberView> {
  return postJson(`/api/projects/${encodeURIComponent(projectId)}/members`, { githubLogin });
}

export function removeMember(projectId: string, login: string): Promise<{ ok: boolean }> {
  return request(`/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(login)}`, {
    method: "DELETE",
  });
}

export function listProjectReports(
  projectId: string,
  year?: number,
  month?: number,
): Promise<CloudReportView[]> {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  if (month) params.set("month", String(month));
  const query = params.toString();
  return request(`/api/projects/${encodeURIComponent(projectId)}/reports${query ? `?${query}` : ""}`);
}

export function submitProjectReport(
  projectId: string,
  input: {
    year: number;
    month: number;
    markdown: string;
    stats: SubmittedReportStats;
    mergedPrs: SubmittedReportPr[];
  },
): Promise<CloudReportView> {
  return postJson(`/api/projects/${encodeURIComponent(projectId)}/reports`, input);
}

export function listProjectRecommendations(
  projectId: string,
  query: { year?: number; month?: number; targetUserId?: string } = {},
): Promise<CloudRecommendationView[]> {
  const params = new URLSearchParams();
  if (query.year) params.set("year", String(query.year));
  if (query.month) params.set("month", String(query.month));
  if (query.targetUserId) params.set("targetUserId", query.targetUserId);
  const qs = params.toString();
  return request(`/api/projects/${encodeURIComponent(projectId)}/recommendations${qs ? `?${qs}` : ""}`);
}

export function createRecommendation(
  projectId: string,
  input: {
    targetUserId: string;
    year: number;
    month: number;
    body: string;
    reportId?: string | null;
  },
): Promise<CloudRecommendationView> {
  return postJson(`/api/projects/${encodeURIComponent(projectId)}/recommendations`, input);
}

export function updateRecommendation(id: string, body: string): Promise<CloudRecommendationView> {
  return request(`/api/recommendations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });
}

export function deleteRecommendation(id: string): Promise<{ ok: boolean }> {
  return request(`/api/recommendations/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function listProjectFiles(projectId: string): Promise<CloudFileView[]> {
  return request(`/api/projects/${encodeURIComponent(projectId)}/files`);
}

export function uploadProjectFile(
  projectId: string,
  input: { name: string; mime?: string; contentBase64: string; year?: number | null; month?: number | null; reportId?: string | null },
): Promise<CloudFileView> {
  return postJson(`/api/projects/${encodeURIComponent(projectId)}/files`, input);
}

export function fileDownloadUrl(id: string): Promise<{ url: string; name: string; mime: string }> {
  return request(`/api/files/${encodeURIComponent(id)}/url`);
}

export function deleteProjectFile(id: string): Promise<{ ok: boolean }> {
  return request(`/api/files/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function listTasks(): Promise<CloudTask[]> {
  return request("/api/tasks");
}

export function createTask(input: CloudTaskInput): Promise<CloudTask> {
  return postJson("/api/tasks", input);
}

export function createGithubBranch(
  repo: string,
  branchName: string,
): Promise<{ created: boolean; branch: string; baseBranch: string }> {
  return postJson("/api/github/branches", { repo, branchName });
}

export function updateTaskStatus(id: string, status: TaskStatus): Promise<CloudTask> {
  return request(`/api/tasks/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export function deleteTask(id: string): Promise<{ ok: boolean }> {
  return request(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function listObjectiveSets(): Promise<CloudObjectiveSet[]> {
  return request("/api/objectives");
}

export function createObjectiveSet(input: {
  kind: ObjectiveKind;
  title: string;
  sourceName: string | null;
  items: string[];
  repo?: string | null;
  branchName?: string | null;
}): Promise<CloudObjectiveSet> {
  return postJson("/api/objectives", input);
}

export function setObjectiveScope(
  id: string,
  repo: string | null,
  branchName: string | null,
): Promise<CloudObjectiveSet> {
  return request(`/api/objectives/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ repo, branchName }),
  });
}

export function updateObjectiveItemStatus(
  setId: string,
  itemId: string,
  status: ObjectiveItemStatus,
): Promise<CloudObjectiveSet> {
  return request(`/api/objectives/${encodeURIComponent(setId)}`, {
    method: "PATCH",
    body: JSON.stringify({ itemUpdates: [{ id: itemId, status }] }),
  });
}

export function deleteObjectiveItem(setId: string, itemId: string): Promise<{ ok: boolean }> {
  return request(
    `/api/objectives/${encodeURIComponent(setId)}/items/${encodeURIComponent(itemId)}`,
    { method: "DELETE" },
  );
}

export function deleteObjectiveSet(id: string): Promise<{ ok: boolean }> {
  return request(`/api/objectives/${encodeURIComponent(id)}`, { method: "DELETE" });
}
