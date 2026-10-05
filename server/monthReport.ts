// Full authenticated month report — ported from vantagedestkop/electron/github.ts's
// loadMonthReport, using the caller's own GitHub token against the Search API so
// private repos are included (unlike server/github.ts's public-Events-API path,
// which stays as the signed-out/no-token fallback).
import type { DailyCount, MonthReport, PrReportItem, PrState, PushCommit, PushGroup } from "../shared/types";
import { advisePr, explainPr, hasUsefulDescription } from "./summarize";

const API = "https://api.github.com";

type GhUser = {
  login: string;
  name: string | null;
  avatar_url: string;
};

type SearchIssues = {
  items: Array<{
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    created_at: string;
    closed_at: string | null;
    pull_request?: { merged_at?: string | null };
    repository_url: string;
  }>;
};

type SearchCommits = {
  items: Array<{
    sha: string;
    html_url: string;
    commit: { message: string; author: { date: string } };
    repository: { full_name: string };
  }>;
};

type PullDetail = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  created_at: string;
  merged_at: string | null;
  additions: number;
  deletions: number;
  changed_files: number;
  base: { ref: string; repo: { full_name: string } };
  head: { ref: string };
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function monthBounds(year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

function daysInMonth(year: number, month: number) {
  const last = new Date(year, month, 0).getDate();
  return Array.from({ length: last }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`);
}

function repoFromApiUrl(url: string) {
  const parts = url.split("/repos/")[1];
  return parts ?? url;
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The /search/* endpoints have their own much stricter limit (~30 req/min for
// an authenticated token) than the rest of the API (5,000/hour). Keep a single
// shared queue so every concurrent loadMonthReport() call (across users) still
// gets serialized here, same reasoning as the desktop app's copy of this file.
const SEARCH_MIN_INTERVAL_MS = 2800;
let lastSearchAt = 0;
let searchQueue: Promise<void> = Promise.resolve();

let coolDownUntil = 0;

function throttleSearch(): Promise<void> {
  const turn = searchQueue.then(async () => {
    const wait = Math.max(0, lastSearchAt + SEARCH_MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await sleep(wait);
    lastSearchAt = Date.now();
  });
  searchQueue = turn.catch(() => {});
  return turn;
}

async function respectCoolDown() {
  const wait = coolDownUntil - Date.now();
  if (wait > 0) await sleep(wait);
}

function noteRateLimitCoolDown(waitMs: number) {
  coolDownUntil = Math.max(coolDownUntil, Date.now() + waitMs);
}

const MAX_RATE_LIMIT_RETRIES = 6;

function isRateLimitError(status: number, detail: string, retryAfterHeader: string | null) {
  if (status !== 403 && status !== 429) return false;
  return retryAfterHeader !== null || /rate.?limit|abuse.?detection|secondary rate/i.test(detail);
}

function isSecondaryRateLimit(detail: string) {
  return /secondary rate|abuse.?detection/i.test(detail);
}

function rateLimitWaitMs(detail: string, retryAfterHeader: string | null, attempt: number) {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1000);
  }
  if (isSecondaryRateLimit(detail)) {
    return Math.min(180_000, 60_000 * 2 ** attempt);
  }
  return Math.min(90_000, 5_000 * 2 ** attempt);
}

async function gh<T>(
  token: string,
  path: string,
  attempt = 0,
): Promise<T> {
  await respectCoolDown();
  if (path.startsWith("/search/")) await throttleSearch();

  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "vantage-web",
    },
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) detail = body.message;
    } catch {
      /* keep statusText */
    }

    const retryAfterHeader = res.headers.get("retry-after");
    const rateLimited = isRateLimitError(res.status, detail, retryAfterHeader);

    if (rateLimited && attempt < MAX_RATE_LIMIT_RETRIES) {
      const waitMs = rateLimitWaitMs(detail, retryAfterHeader, attempt);
      noteRateLimitCoolDown(waitMs);
      await sleep(waitMs);
      return gh<T>(token, path, attempt + 1);
    }

    if (rateLimited) {
      throw new Error(
        `GitHub is rate-limiting requests right now. Wait a couple of minutes, then try again.${
          isSecondaryRateLimit(detail) ? " (secondary rate limit)" : ""
        }`,
      );
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error("Your GitHub session expired or was revoked. Sign in again to continue.");
    }
    throw new Error(`GitHub ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

async function searchAll<T extends { items: unknown[] }>(token: string, pathBase: string): Promise<T["items"]> {
  const items: T["items"] = [];
  for (let page = 1; page <= 5; page += 1) {
    const data = await gh<T>(token, `${pathBase}&per_page=100&page=${page}`);
    items.push(...data.items);
    if (data.items.length < 100) break;
  }
  return items;
}

async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>) {
  const results: R[] = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => worker()));
  return results;
}

function toPrItemFromSearch(item: SearchIssues["items"][number], state: PrState): PrReportItem {
  const repo = repoFromApiUrl(item.repository_url);
  const mergedAt = state === "merged" ? item.pull_request?.merged_at ?? item.closed_at : null;
  const summarizeInput = {
    title: item.title,
    body: item.body,
    repo: repo.split("/")[1] ?? repo,
    additions: 0,
    deletions: 0,
    changedFiles: 0,
    base: "main",
    state,
  };
  const [line1, line2] = explainPr(summarizeInput);
  const advice = advisePr({ ...summarizeInput, createdAt: item.created_at });
  return {
    number: item.number,
    title: item.title,
    body: item.body,
    repo,
    url: item.html_url,
    mergedAt: mergedAt ?? null,
    createdAt: item.created_at,
    state,
    additions: 0,
    deletions: 0,
    changedFiles: 0,
    hasDescription: hasUsefulDescription(item.body),
    line1,
    line2,
    advice,
    baseBranch: "main",
    headBranch: "",
  };
}

function toPrItem(detail: PullDetail, state: PrState): PrReportItem {
  const repo = detail.base.repo.full_name;
  const summarizeInput = {
    title: detail.title,
    body: detail.body,
    repo: repo.split("/")[1] ?? repo,
    additions: detail.additions,
    deletions: detail.deletions,
    changedFiles: detail.changed_files,
    base: detail.base.ref,
    state,
  };
  const [line1, line2] = explainPr(summarizeInput);
  const advice = advisePr({ ...summarizeInput, createdAt: detail.created_at });
  return {
    number: detail.number,
    title: detail.title,
    body: detail.body,
    repo,
    url: detail.html_url,
    mergedAt: detail.merged_at,
    createdAt: detail.created_at,
    state,
    additions: detail.additions,
    deletions: detail.deletions,
    changedFiles: detail.changed_files,
    hasDescription: hasUsefulDescription(detail.body),
    line1,
    line2,
    advice,
    baseBranch: detail.base.ref,
    headBranch: detail.head.ref,
  };
}

export type PrFileChange = {
  filename: string;
  status: string;
  patch: string | null;
};

const AI_PATCH_CHARS = 350;
const AI_MAX_FILES = 4;

/** Only called for AI code review — the heuristic report path never fetches diffs. */
export async function fetchPrFiles(token: string, repo: string, number: number): Promise<PrFileChange[]> {
  const files = await gh<Array<{ filename: string; status: string; patch?: string }>>(
    token,
    `/repos/${repo}/pulls/${number}/files?per_page=${AI_MAX_FILES}`,
  );
  return files.slice(0, AI_MAX_FILES).map((file) => ({
    filename: file.filename,
    status: file.status,
    patch: file.patch ? file.patch.slice(0, AI_PATCH_CHARS) : null,
  }));
}

export async function loadMonthReport(
  token: string,
  username: string,
  year: number,
  month: number,
): Promise<MonthReport> {
  const { start, end } = monthBounds(year, month);
  const range = `${start}..${end}`;

  const user = await gh<GhUser>(token, `/users/${encodeURIComponent(username)}`);

  // Run searches one after another (shared throttle still applies) — parallel
  // bursts trip GitHub's secondary rate limit.
  const mergedSearch = await searchAll<SearchIssues>(
    token,
    `/search/issues?q=${encodeURIComponent(`is:pr author:${username} merged:${range}`)}`,
  );
  const openSearch = await searchAll<SearchIssues>(
    token,
    `/search/issues?q=${encodeURIComponent(`is:pr author:${username} is:open created:${range}`)}`,
  );
  const closedSearch = await searchAll<SearchIssues>(
    token,
    `/search/issues?q=${encodeURIComponent(`is:pr author:${username} is:unmerged closed:${range}`)}`,
  );
  const commitSearch = await searchAll<SearchCommits>(
    token,
    `/search/commits?q=${encodeURIComponent(`author:${username} author-date:${range}`)}`,
  );

  const fetchMergedDetail = async (item: SearchIssues["items"][number]) => {
    const repo = repoFromApiUrl(item.repository_url);
    const detail = await gh<PullDetail>(token, `/repos/${repo}/pulls/${item.number}`);
    return toPrItem(detail, "merged");
  };

  const stamp = (pr: { mergedAt: string | null; createdAt: string }) => pr.mergedAt ?? pr.createdAt;

  // Keep PR-detail concurrency low — secondary rate limits are triggered by
  // concurrent REST bursts more than by total request count.
  const mergedPrs = (await mapPool(mergedSearch, 2, fetchMergedDetail)).sort((a, b) =>
    stamp(a).localeCompare(stamp(b)),
  );

  const openPrs = openSearch
    .filter((item) => !mergedSearch.some((m) => m.html_url === item.html_url))
    .map((item) => toPrItemFromSearch(item, "open"))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const closedPrs = closedSearch
    .filter((item) => !mergedSearch.some((m) => m.html_url === item.html_url))
    .map((item) => toPrItemFromSearch(item, "closed"))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const pushMap = new Map<string, PushGroup>();
  const countByDay = new Map<string, number>();

  for (const item of commitSearch) {
    const date = dayKey(item.commit.author.date);
    const message = item.commit.message.split("\n")[0] ?? "";
    const commit: PushCommit = {
      sha: item.sha.slice(0, 7),
      message,
      url: item.html_url,
      date: item.commit.author.date,
    };
    countByDay.set(date, (countByDay.get(date) ?? 0) + 1);

    const key = `${item.repository.full_name}|${date}`;
    const existing = pushMap.get(key);
    if (existing) {
      existing.commits.push(commit);
    } else {
      pushMap.set(key, { repo: item.repository.full_name, date, commits: [commit] });
    }
  }

  for (const group of pushMap.values()) {
    group.commits.sort((a, b) => a.date.localeCompare(b.date));
  }

  const pushes = [...pushMap.values()].sort((a, b) => {
    if (a.date === b.date) return a.repo.localeCompare(b.repo);
    return a.date.localeCompare(b.date);
  });

  const dailyCommits: DailyCount[] = daysInMonth(year, month).map((date) => ({
    date,
    count: countByDay.get(date) ?? 0,
  }));

  const repos = new Set<string>([
    ...mergedPrs.map((pr) => pr.repo),
    ...openPrs.map((pr) => pr.repo),
    ...closedPrs.map((pr) => pr.repo),
    ...pushes.map((push) => push.repo),
  ]);

  return {
    year,
    month,
    username: user.login,
    avatarUrl: user.avatar_url,
    name: user.name ?? user.login,
    stats: {
      prsMerged: mergedPrs.length,
      prsOpen: openPrs.length,
      prsClosed: closedPrs.length,
      commits: commitSearch.length,
      repos: repos.size,
      additions: mergedPrs.reduce((sum, pr) => sum + pr.additions, 0),
      deletions: mergedPrs.reduce((sum, pr) => sum + pr.deletions, 0),
    },
    dailyCommits,
    mergedPrs,
    openPrs,
    closedPrs,
    pushes,
  };
}
