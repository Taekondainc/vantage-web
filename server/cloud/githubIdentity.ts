export type GithubProfile = {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  email: string | null;
};

async function githubHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "Vantage",
  };
}

async function githubEmailFromToken(accessToken: string): Promise<string | null> {
  const res = await fetch("https://api.github.com/user/emails", {
    headers: await githubHeaders(accessToken),
  });
  if (!res.ok) return null;
  const rows = (await res.json().catch(() => [])) as Array<{
    email?: string;
    primary?: boolean;
    verified?: boolean;
    visibility?: string | null;
  }>;
  if (!Array.isArray(rows)) return null;
  const verified = rows.filter((row) => row.verified && row.email);
  const primary = verified.find((row) => row.primary) || verified[0] || rows.find((row) => row.email);
  return primary?.email?.trim() || null;
}

export async function githubUserFromToken(accessToken: string): Promise<GithubProfile> {
  const token = accessToken.trim();
  if (!token) throw new Error("A GitHub access token is required.");

  const res = await fetch("https://api.github.com/user", {
    headers: await githubHeaders(token),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error("GitHub rejected that token.");
  }
  if (!res.ok) {
    throw new Error("Could not verify the GitHub account.");
  }

  const data = (await res.json()) as {
    id?: number;
    login?: string;
    name?: string | null;
    avatar_url?: string | null;
    email?: string | null;
  };

  if (!data.id || !data.login) {
    throw new Error("GitHub did not return a user profile.");
  }

  const email = (data.email || "").trim() || (await githubEmailFromToken(token));

  return {
    id: data.id,
    login: data.login,
    name: data.name ?? null,
    avatarUrl: data.avatar_url ?? null,
    email: email || null,
  };
}

export function oauthClientId() {
  return process.env.GITHUB_OAUTH_CLIENT_ID?.trim() || "";
}

export function oauthConfigured() {
  return Boolean(oauthClientId());
}

export function oauthRedirectConfigured() {
  return Boolean(oauthClientId() && process.env.GITHUB_OAUTH_CLIENT_SECRET?.trim());
}

export function oauthCallbackUrl() {
  return (
    process.env.OAUTH_CALLBACK_URL?.trim() || "http://localhost:5175/api/auth/github/callback"
  );
}

export function appOrigin() {
  return process.env.APP_ORIGIN?.trim() || "http://localhost:5175";
}
