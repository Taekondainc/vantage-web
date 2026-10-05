import { Hono } from "hono";
import { randomBytes } from "node:crypto";
import {
  appOrigin,
  githubUserFromToken,
  oauthCallbackUrl,
  oauthClientId,
  oauthConfigured,
  oauthRedirectConfigured,
} from "./githubIdentity";
import { clearSessionCookie, readAccessToken, setSessionCookie } from "./auth";
import { issueSession, revokeSession, upsertUserFromGithub } from "./users";
import { HttpError } from "./store";
import type { CloudAuthResponse } from "../../shared/types";

const oauthStates = new Map<string, { next: string; expiresAt: number }>();
const devicePending = new Map<
  string,
  { deviceCode: string; intervalMs: number; expiresAt: number; next: string }
>();

function pruneMaps() {
  const now = Date.now();
  for (const [key, value] of oauthStates) {
    if (value.expiresAt <= now) oauthStates.delete(key);
  }
  for (const [key, value] of devicePending) {
    if (value.expiresAt <= now) devicePending.delete(key);
  }
}

function safeNext(raw: string | null | undefined) {
  const next = String(raw || "").trim() || "/app";
  if (!next.startsWith("/app")) return "/app";
  if (next.startsWith("//")) return "/app";
  return next;
}

async function sessionFromGithubToken(accessToken: string): Promise<CloudAuthResponse> {
  const profile = await githubUserFromToken(accessToken);
  const user = await upsertUserFromGithub(profile, accessToken);
  return issueSession(user);
}

// Matches the desktop app's scope so an org that has already approved this
// OAuth app (same client ID) for desktop doesn't need a second approval for web.
const GITHUB_SCOPE = "repo read:user user:email read:org";

export const authRoutes = new Hono();

authRoutes.get("/github", (c) => {
  const next = safeNext(c.req.query("next"));
  if (!oauthRedirectConfigured()) {
    const origin = appOrigin();
    if (!oauthConfigured()) {
      return c.redirect(
        `${origin}/app/sign-in?error=${encodeURIComponent("GitHub OAuth is not configured on this server.")}`,
      );
    }
    return c.redirect(`${origin}/app/sign-in?next=${encodeURIComponent(next)}&start=github`);
  }
  pruneMaps();
  const state = randomBytes(16).toString("hex");
  oauthStates.set(state, {
    next,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", oauthClientId());
  url.searchParams.set("redirect_uri", oauthCallbackUrl());
  url.searchParams.set("scope", GITHUB_SCOPE);
  url.searchParams.set("state", state);
  return c.redirect(url.toString());
});

authRoutes.get("/github/callback", async (c) => {
  const origin = appOrigin();
  const fail = (message: string) =>
    c.redirect(`${origin}/app/sign-in?error=${encodeURIComponent(message)}`);

  if (!oauthRedirectConfigured()) return fail("GitHub OAuth is not configured on this server.");

  const error = c.req.query("error_description") || c.req.query("error");
  if (error) return fail(error);

  const code = c.req.query("code") || "";
  const state = c.req.query("state") || "";
  pruneMaps();
  const pending = oauthStates.get(state);
  oauthStates.delete(state);
  if (!code || !pending) return fail("Sign-in expired. Try again.");

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: oauthClientId(),
        client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET!.trim(),
        code,
        redirect_uri: oauthCallbackUrl(),
      }),
    });
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!tokenRes.ok || !tokenData.access_token) {
      return fail(tokenData.error_description || tokenData.error || "GitHub did not return an access token.");
    }

    const session = await sessionFromGithubToken(tokenData.access_token);
    setSessionCookie(c, session.token);
    const next = encodeURIComponent(pending.next);
    return c.redirect(`${origin}/app/auth/complete?token=${encodeURIComponent(session.token)}&next=${next}`);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not complete GitHub sign-in.");
  }
});

authRoutes.post("/github/device", async (c) => {
  if (!oauthConfigured()) {
    return c.json({ error: "GitHub OAuth is not configured on this server." }, 503);
  }
  pruneMaps();
  const body = (await c.req.json().catch(() => null)) as { next?: string } | null;
  const clientId = oauthClientId();
  const res = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Vantage",
    },
    body: new URLSearchParams({ client_id: clientId, scope: GITHUB_SCOPE }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    device_code?: string;
    user_code?: string;
    verification_uri?: string;
    verification_uri_complete?: string;
    expires_in?: number;
    interval?: number;
    error?: string;
    error_description?: string;
  };
  if (res.status === 404 || !data.device_code || !data.user_code || !data.verification_uri) {
    return c.json(
      {
        error:
          data.error_description ||
          data.error ||
          "Device Flow is not enabled on this GitHub OAuth app. Open github.com/settings/developers, enable Device Flow, then try again.",
      },
      502,
    );
  }

  const id = randomBytes(16).toString("hex");
  devicePending.set(id, {
    deviceCode: data.device_code,
    intervalMs: Math.max(Number(data.interval) || 5, 5) * 1000,
    expiresAt: Date.now() + (Number(data.expires_in) || 900) * 1000,
    next: safeNext(body?.next),
  });

  return c.json({
    id,
    userCode: data.user_code,
    verificationUri: data.verification_uri_complete || data.verification_uri,
    expiresIn: Number(data.expires_in) || 900,
    interval: Number(data.interval) || 5,
  });
});

authRoutes.post("/github/device/poll", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { id?: string } | null;
  const id = String(body?.id || "").trim();
  const pending = devicePending.get(id);
  if (!pending) return c.json({ status: "error", error: "Sign-in expired. Try again." }, 400);
  if (Date.now() > pending.expiresAt) {
    devicePending.delete(id);
    return c.json({ status: "error", error: "GitHub sign-in timed out. Try again." }, 408);
  }

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "Vantage",
    },
    body: JSON.stringify({
      client_id: oauthClientId(),
      device_code: pending.deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (data.access_token) {
    devicePending.delete(id);
    try {
      const session = await sessionFromGithubToken(data.access_token);
      setSessionCookie(c, session.token);
      return c.json({ status: "ok", ...session, next: pending.next });
    } catch (err) {
      return c.json(
        { status: "error", error: err instanceof Error ? err.message : "Could not finish GitHub sign-in." },
        502,
      );
    }
  }

  if (data.error === "authorization_pending") return c.json({ status: "pending" });
  if (data.error === "slow_down") return c.json({ status: "slow_down", interval: pending.intervalMs / 1000 + 5 });
  devicePending.delete(id);
  return c.json(
    { status: "error", error: data.error_description || data.error || "GitHub sign-in failed." },
    400,
  );
});

authRoutes.post("/github-token", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { accessToken?: string } | null;
  const accessToken = String(body?.accessToken || "").trim();
  if (!accessToken) return c.json({ error: "accessToken is required" }, 400);
  try {
    const session = await sessionFromGithubToken(accessToken);
    setSessionCookie(c, session.token);
    return c.json(session);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not verify the GitHub account.";
    const status = err instanceof HttpError ? err.status : /rejected/i.test(message) ? 401 : 502;
    return c.json({ error: message }, status as 400);
  }
});

authRoutes.post("/logout", async (c) => {
  const token = readAccessToken(c);
  if (token) await revokeSession(token);
  clearSessionCookie(c);
  return c.json({ ok: true });
});
