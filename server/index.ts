import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ObjectiveKind } from "../shared/types";
import { pauseForGroqTpm } from "./ai";
import { optionalUser } from "./cloud/auth";
import { authRoutes } from "./cloud/authRoutes";
import { consumeUsage } from "./cloud/billing";
import { billingAuthRoutes, billingPublicRoutes } from "./cloud/billingRoutes";
import { oauthConfigured, oauthRedirectConfigured } from "./cloud/githubIdentity";
import { polarConfigured } from "./cloud/polar";
import { cloudRoutes } from "./cloud/routes";
import { reportRoutes } from "./cloud/reportRoutes";
import { HttpError, normalizeLogin } from "./cloud/store";
import { pingSupabase, supabaseConfigured } from "./cloud/supabase";
import { cloudinaryConfigured } from "./cloud/cloudinary";
import { getUserGithubToken } from "./cloud/users";
import { loadPublicMonth, loadPublicProfile } from "./github";
import { loadAuthedProfile } from "./githubAuth";
import { draftObjectivesFromText } from "./objectives";
import { resolveScopeFromText } from "./scope";

function loadEnvFile() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => origin ?? "*",
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.get("/api/health", async (c) => {
  let supabase = false;
  if (supabaseConfigured()) {
    try {
      supabase = await pingSupabase();
    } catch {
      supabase = false;
    }
  }
  return c.json({
    ok: true,
    ai: Boolean(process.env.GROQ_API_KEY?.trim()),
    oauth: oauthConfigured(),
    oauthMode: oauthRedirectConfigured() ? "redirect" : oauthConfigured() ? "device" : null,
    supabaseConfigured: supabaseConfigured(),
    supabase,
    cloudinary: cloudinaryConfigured(),
    polar: polarConfigured(),
  });
});

app.route("/api/auth", authRoutes);

app.post("/api/resolve-scope", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { text?: string } | null;
  const text = String(body?.text || "").trim();
  if (!text) return c.json({ error: "text is required" }, 400);
  if (!process.env.GROQ_API_KEY?.trim()) {
    const { extractScopeFromText } = await import("../shared/extractScope");
    return c.json(extractScopeFromText(text));
  }
  try {
    const scope = await resolveScopeFromText(text);
    return c.json(scope);
  } catch {
    const { extractScopeFromText } = await import("../shared/extractScope");
    return c.json(extractScopeFromText(text));
  }
});

app.post("/api/generate", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    text?: string;
    kind?: ObjectiveKind;
    repo?: string | null;
    branchName?: string | null;
  } | null;

  const text = String(body?.text || "").trim();
  const kind: ObjectiveKind = body?.kind === "target" ? "target" : "objective";
  if (!text) return c.json({ error: "text is required" }, 400);
  if (!process.env.GROQ_API_KEY?.trim()) {
    return c.json({ error: "AI is not configured on this server." }, 503);
  }

  try {
    const user = await optionalUser(c);
    if (user) await consumeUsage(user.id, "ai");
  } catch (err) {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status as 400);
    throw err;
  }

  let repo = body?.repo?.trim() || null;
  let branchName = body?.branchName?.trim() || null;

  if (!repo || !branchName) {
    const resolved = await resolveScopeFromText(text);
    repo = repo || resolved.repo;
    branchName = branchName || resolved.branchName;
    await pauseForGroqTpm();
  }

  try {
    const draft = await draftObjectivesFromText(text, kind);
    return c.json({
      title: draft.title || (kind === "target" ? "Targets" : "Objectives"),
      items: draft.items,
      repo,
      branchName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not draft objectives.";
    return c.json({ error: message }, 500);
  }
});

/**
 * Only enrich with private/org activity when the caller is signed in AND
 * looking up their own username — never for someone else's account.
 */
async function tryAuthedProfile(c: Parameters<typeof optionalUser>[0], username: string) {
  const user = await optionalUser(c);
  if (!user || normalizeLogin(user.login) !== normalizeLogin(username)) return null;
  const token = await getUserGithubToken(user.id);
  if (!token) return null;
  try {
    return await loadAuthedProfile(token, user.login);
  } catch {
    return null;
  }
}

app.get("/api/github/:username", async (c) => {
  const username = c.req.param("username");
  try {
    const authed = await tryAuthedProfile(c, username);
    return c.json(authed ?? (await loadPublicProfile(username)));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load GitHub activity.";
    const status = /not found/i.test(message) ? 404 : 502;
    return c.json({ error: message }, status);
  }
});

app.get("/api/github/:username/:year/:month", async (c) => {
  const username = c.req.param("username");
  const year = Number(c.req.param("year"));
  const month = Number(c.req.param("month"));
  if (!year || month < 1 || month > 12) return c.json({ error: "Invalid month." }, 400);
  try {
    return c.json(await loadPublicMonth(username, year, month));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load GitHub activity.";
    const status = /not found/i.test(message) ? 404 : 502;
    return c.json({ error: message }, status);
  }
});

app.route("/api", billingPublicRoutes);
app.route("/api", billingAuthRoutes);
app.route("/api", cloudRoutes);
app.route("/api", reportRoutes);

const port = Number(process.env.PORT || 8787);

serve({ fetch: app.fetch, port }, () => {
  console.log(`vantage-web API listening on http://127.0.0.1:${port}`);
});

export default app;
