import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { CloudUser } from "../../shared/types";
import { findSession, findUser, readStore } from "./store";

export const SESSION_COOKIE = "vantage_session";

export type AuthEnv = {
  Variables: {
    user: CloudUser;
    sessionToken: string;
  };
};

export function readAccessToken(c: Context) {
  const header = c.req.header("Authorization") || "";
  if (header.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    if (token) return token;
  }
  return getCookie(c, SESSION_COOKIE) || null;
}

export function setSessionCookie(c: Context, token: string) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.COOKIE_SECURE === "1",
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export async function optionalUser(c: Context): Promise<CloudUser | null> {
  const token = readAccessToken(c);
  if (!token) return null;
  const data = await readStore();
  const session = findSession(data, token);
  if (!session) return null;
  return findUser(data, session.userId);
}

export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const token = readAccessToken(c);
  if (!token) return c.json({ error: "Sign in required." }, 401);
  const data = await readStore();
  const session = findSession(data, token);
  if (!session) return c.json({ error: "Session expired. Sign in again." }, 401);
  const user = findUser(data, session.userId);
  if (!user) return c.json({ error: "Sign in required." }, 401);
  c.set("user", user);
  c.set("sessionToken", token);
  await next();
};
