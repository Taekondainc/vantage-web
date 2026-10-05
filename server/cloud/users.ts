import type { CloudAuthResponse, CloudInvite, CloudMe, CloudUser } from "../../shared/types";
import { getBillingState } from "./billing";
import { getSupabase, supabaseConfigured } from "./supabase";
import { decryptToken, encryptToken } from "./crypto";
import type { GithubProfile } from "./githubIdentity";
import {
  findUser,
  findUserByGithubId,
  mutateStore,
  newId,
  newToken,
  normalizeLogin,
  purgeExpiredSessions,
  readStore,
  SESSION_MS,
  type StoreData,
} from "./store";

function publicUser(user: CloudUser): CloudUser {
  return {
    id: user.id,
    githubId: user.githubId,
    login: user.login,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
}

function attachInvites(data: StoreData, user: CloudUser) {
  const login = normalizeLogin(user.login);
  for (const membership of data.memberships) {
    if (normalizeLogin(membership.githubLogin) !== login) continue;
    membership.userId = user.id;
  }
}

export async function upsertUserFromGithub(profile: GithubProfile, accessToken?: string): Promise<CloudUser> {
  const tokenEnc = accessToken ? encryptToken(accessToken) : null;
  const user = await mutateStore((data) => {
    const existing = findUserByGithubId(data, profile.id);
    if (existing) {
      existing.login = profile.login;
      existing.name = profile.name;
      existing.avatarUrl = profile.avatarUrl;
      if (tokenEnc) existing.githubTokenEnc = tokenEnc;
      attachInvites(data, existing);
      return existing;
    }

    const created: CloudUser = {
      id: newId(),
      githubId: profile.id,
      login: profile.login,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      githubTokenEnc: tokenEnc,
    };
    data.users.push(created);
    attachInvites(data, created);
    return created;
  });
  if (profile.email) await saveUserEmail(user.id, profile.email);
  return user;
}

/** Decrypted GitHub token for the user, if one was stored and TOKEN_ENCRYPTION_KEY is configured. */
export async function getUserGithubToken(userId: string): Promise<string | null> {
  const data = await readStore();
  const user = findUser(data, userId);
  return decryptToken(user?.githubTokenEnc);
}

export async function getUserBillingEmail(userId: string): Promise<string | null> {
  if (!supabaseConfigured()) return null;
  const { data, error } = await getSupabase().from("vantage_users").select("email").eq("id", userId).maybeSingle();
  if (error) return null;
  const email = typeof data?.email === "string" ? data.email.trim() : "";
  return email || null;
}

export async function saveUserEmail(userId: string, email: string) {
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes("@") || !supabaseConfigured()) return;
  await getSupabase().from("vantage_users").update({ email: trimmed }).eq("id", userId);
}

export async function issueSession(user: CloudUser): Promise<CloudAuthResponse> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_MS).toISOString();
  await mutateStore((data) => {
    purgeExpiredSessions(data);
    data.sessions.push({ token, userId: user.id, expiresAt });
  });
  return { token, user: publicUser(user) };
}

export async function revokeSession(token: string) {
  await mutateStore((data) => {
    data.sessions = data.sessions.filter((session) => session.token !== token);
  });
}

export function pendingInvitesFor(data: StoreData, user: CloudUser): CloudInvite[] {
  const login = normalizeLogin(user.login);
  return data.memberships
    .filter(
      (membership) =>
        membership.status === "invited" &&
        (membership.userId === user.id || normalizeLogin(membership.githubLogin) === login),
    )
    .map((membership) => {
      const project = data.projects.find((item) => item.id === membership.projectId);
      return {
        id: membership.id,
        projectId: membership.projectId,
        projectName: project?.name || "Project",
        githubLogin: membership.githubLogin,
        role: membership.role,
        invitedAt: membership.invitedAt,
      };
    });
}

export async function mePayload(user: CloudUser): Promise<CloudMe> {
  const data = await readStore();
  const billing = await getBillingState(user.id).catch(() => null);
  const email = await getUserBillingEmail(user.id);
  return {
    user: publicUser(findUser(data, user.id) ?? user),
    invites: pendingInvitesFor(data, user),
    billing,
    email,
  };
}
