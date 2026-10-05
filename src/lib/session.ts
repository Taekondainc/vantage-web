import { readJson, writeJson } from "./storage";

export type SessionUser = {
  id: string;
  login: string;
  name?: string | null;
  avatarUrl?: string | null;
  signedInAt: string;
  token: string;
  auth: "oauth";
};

const KEY = "oauth-session";

export function getSession(): SessionUser | null {
  const raw = readJson<Partial<SessionUser> | null>(KEY, null);
  if (!raw?.login?.trim() || !raw.token?.trim() || raw.auth !== "oauth") return null;
  return {
    id: raw.id || "",
    login: raw.login.trim(),
    name: raw.name ?? null,
    avatarUrl: raw.avatarUrl ?? null,
    signedInAt: raw.signedInAt || new Date().toISOString(),
    token: raw.token,
    auth: "oauth",
  };
}

export function setSession(user: Omit<SessionUser, "auth"> & { auth?: "oauth" }) {
  writeJson(KEY, {
    id: user.id,
    login: user.login.trim(),
    name: user.name ?? null,
    avatarUrl: user.avatarUrl ?? null,
    signedInAt: user.signedInAt || new Date().toISOString(),
    token: user.token,
    auth: "oauth",
  } satisfies SessionUser);
}

export function clearSession() {
  writeJson(KEY, null);
  writeJson("session", null);
}

export function isSignedIn() {
  return Boolean(getSession()?.token);
}

export function authHeaders(): HeadersInit {
  const token = getSession()?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
