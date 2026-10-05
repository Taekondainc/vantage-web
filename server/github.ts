import type { GithubMonthActivity } from "../shared/types";

export type GithubProfileActivity = {
  username: string;
  name: string;
  avatarUrl: string;
  items: GithubMonthActivity["items"];
  truncated: boolean;
};

const cache = new Map<string, { at: number; data: GithubProfileActivity }>();
const TTL_MS = 120_000;

type GhUser = {
  login: string;
  name: string | null;
  avatar_url: string;
};

type GhEvent = {
  id: string;
  type: string;
  created_at: string;
  repo: { name: string };
  payload: {
    action?: string;
    ref?: string;
    size?: number;
    commits?: Array<{ message: string }>;
    pull_request?: {
      number: number;
      title: string;
      html_url: string;
      merged?: boolean;
    };
  };
};

function headers() {
  const token = process.env.GITHUB_TOKEN?.trim();
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "vantage-web",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function gh<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, { headers: headers() });
  if (res.status === 404) throw new Error("GitHub user not found.");
  if (res.status === 403) throw new Error("GitHub rate limit reached. Try again in a minute.");
  if (!res.ok) throw new Error(`GitHub request failed (${res.status}).`);
  return (await res.json()) as T;
}

function itemFromEvent(event: GhEvent): GithubMonthActivity["items"][number] | null {
  const repo = event.repo?.name ?? "";
  const url = `https://github.com/${repo}`;
  if (event.type === "PushEvent") {
    const first = event.payload.commits?.[0]?.message?.split("\n")[0] ?? "Pushed commits";
    const count = event.payload.size ?? event.payload.commits?.length ?? 1;
    return {
      id: event.id,
      type: "push",
      repo,
      title: count > 1 ? `${first} (+${count - 1} more)` : first,
      createdAt: event.created_at,
      url,
    };
  }
  if (event.type === "PullRequestEvent" && event.payload.pull_request) {
    const pr = event.payload.pull_request;
    const action = event.payload.action === "closed" && pr.merged ? "merged" : event.payload.action ?? "updated";
    return {
      id: event.id,
      type: action === "merged" ? "pr-merged" : "pr",
      repo,
      title: `${action} #${pr.number} ${pr.title}`,
      createdAt: event.created_at,
      url: pr.html_url,
    };
  }
  if (event.type === "CreateEvent" && event.payload.ref) {
    return {
      id: event.id,
      type: "create",
      repo,
      title: `Created ${event.payload.ref}`,
      createdAt: event.created_at,
      url,
    };
  }
  return null;
}

export function activityForMonth(
  profile: GithubProfileActivity,
  year: number,
  month: number,
): GithubMonthActivity {
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const end = new Date(Date.UTC(year, month, 1)).toISOString();
  const items = profile.items.filter((item) => item.createdAt >= start && item.createdAt < end);
  const repos = new Set(items.map((item) => item.repo));
  return {
    username: profile.username,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    year,
    month,
    stats: {
      commits: items.filter((item) => item.type === "push").length,
      pushes: items.filter((item) => item.type === "push").length,
      prsOpened: items.filter((item) => item.type === "pr" && item.title.startsWith("opened")).length,
      prsMerged: items.filter((item) => item.type === "pr-merged").length,
      repos: repos.size,
    },
    items,
    truncated: profile.truncated,
  };
}

export async function loadPublicProfile(username: string): Promise<GithubProfileActivity> {
  const handle = username.replace(/^@/, "").trim();
  if (!/^[A-Za-z0-9-]{1,39}$/.test(handle)) {
    throw new Error("Enter a valid GitHub username.");
  }
  const hit = cache.get(handle);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const user = await gh<GhUser>(`/users/${encodeURIComponent(handle)}`);
  const events: GhEvent[] = [];
  for (let page = 1; page <= 3; page += 1) {
    const batch = await gh<GhEvent[]>(
      `/users/${encodeURIComponent(handle)}/events/public?per_page=100&page=${page}`,
    );
    events.push(...batch);
    if (batch.length < 100) break;
  }

  const data: GithubProfileActivity = {
    username: user.login,
    name: user.name ?? user.login,
    avatarUrl: user.avatar_url,
    items: events.map(itemFromEvent).filter((item): item is NonNullable<typeof item> => Boolean(item)),
    truncated: events.length >= 300,
  };
  cache.set(handle, { at: Date.now(), data });
  return data;
}

export async function loadPublicMonth(
  username: string,
  year: number,
  month: number,
): Promise<GithubMonthActivity> {
  return activityForMonth(await loadPublicProfile(username), year, month);
}
