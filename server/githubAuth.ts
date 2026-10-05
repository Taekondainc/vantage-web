import type { GithubProfileActivity } from "./github";

// GitHub's public Events API only covers ~90 days of public activity. An
// authenticated token (with repo/read:org) can see further back via Search,
// so we widen the window instead of being stuck with "recent" only.
const WINDOW_DAYS = 400;
const TTL_MS = 120_000;

const cache = new Map<string, { at: number; data: GithubProfileActivity }>();

function headers(token: string) {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "vantage-web",
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `Bearer ${token}`,
  };
}

async function gh<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, { headers: headers(token) });
  if (res.status === 401 || res.status === 403) throw new Error("GitHub rejected that token.");
  if (!res.ok) throw new Error(`GitHub request failed (${res.status}).`);
  return (await res.json()) as T;
}

async function searchAll<T>(token: string, path: string, maxPages = 3): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await gh<{ items: T[] }>(token, `${path}&per_page=100&page=${page}`);
    items.push(...(batch.items ?? []));
    if (!batch.items || batch.items.length < 100) break;
  }
  return items;
}

function repoFromApiUrl(url: string) {
  return url.replace("https://api.github.com/repos/", "");
}

type SearchCommitItem = {
  sha: string;
  html_url: string;
  commit: { message: string; author: { date: string } };
  repository: { full_name: string };
};

type SearchIssueItem = {
  number: number;
  title: string;
  html_url: string;
  state: string;
  created_at: string;
  repository_url: string;
  pull_request?: { merged_at: string | null };
};

/**
 * Same shape as loadPublicProfile, but pulls from the authenticated user's
 * full repo access (private + org) via Search instead of the public,
 * public-repos-only Events API. Only ever call this with the signed-in
 * user's own token for their own username — never for another account.
 */
export async function loadAuthedProfile(token: string, username: string): Promise<GithubProfileActivity> {
  const cacheKey = `${username}:${token.slice(-8)}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [user, commits, prs] = await Promise.all([
    gh<{ login: string; name: string | null; avatar_url: string }>(token, "/user"),
    searchAll<SearchCommitItem>(
      token,
      `/search/commits?q=${encodeURIComponent(`author:${username} author-date:>=${since}`)}&sort=author-date&order=desc`,
    ),
    searchAll<SearchIssueItem>(
      token,
      `/search/issues?q=${encodeURIComponent(`is:pr author:${username} created:>=${since}`)}&sort=created&order=desc`,
    ),
  ]);

  const commitItems: GithubProfileActivity["items"] = commits.map((item) => ({
    id: `commit-${item.sha}`,
    type: "push",
    repo: item.repository.full_name,
    title: item.commit.message.split("\n")[0] || "Pushed a commit",
    createdAt: item.commit.author.date,
    url: item.html_url,
  }));

  const prItems: GithubProfileActivity["items"] = prs.map((item) => {
    const mergedAt = item.pull_request?.merged_at ?? null;
    const merged = Boolean(mergedAt);
    const action = merged ? "merged" : item.state === "open" ? "opened" : "closed";
    return {
      id: `pr-${repoFromApiUrl(item.repository_url)}-${item.number}`,
      type: merged ? "pr-merged" : "pr",
      repo: repoFromApiUrl(item.repository_url),
      title: `${action} #${item.number} ${item.title}`,
      createdAt: mergedAt ?? item.created_at,
      url: item.html_url,
    };
  });

  const data: GithubProfileActivity = {
    username: user.login,
    name: user.name ?? user.login,
    avatarUrl: user.avatar_url,
    items: [...commitItems, ...prItems],
    truncated: commits.length >= 300 || prs.length >= 300,
  };
  cache.set(cacheKey, { at: Date.now(), data });
  return data;
}
