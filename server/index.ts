import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ObjectiveKind } from "../shared/types";
import { pauseForGroqTpm } from "./ai";
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
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    ai: Boolean(process.env.GROQ_API_KEY?.trim()),
  }),
);

app.post("/api/resolve-scope", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { text?: string } | null;
  const text = String(body?.text || "").trim();
  if (!text) return c.json({ error: "text is required" }, 400);
  if (!process.env.GROQ_API_KEY?.trim()) {
    const { extractScopeFromText } = await import("../shared/extractScope");
    return c.json(extractScopeFromText(text));
  }
  const scope = await resolveScopeFromText(text);
  return c.json(scope);
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

  let repo = body?.repo?.trim() || null;
  let branchName = body?.branchName?.trim() || null;

  if (!repo || !branchName) {
    const resolved = await resolveScopeFromText(text);
    repo = repo || resolved.repo;
    branchName = branchName || resolved.branchName;
    await pauseForGroqTpm();
  }

  const draft = await draftObjectivesFromText(text, kind);
  return c.json({
    title: draft.title || (kind === "target" ? "Targets" : "Objectives"),
    items: draft.items,
    repo,
    branchName,
  });
});

const port = Number(process.env.PORT || 8787);

serve({ fetch: app.fetch, port }, () => {
  console.log(`vantage-web API listening on http://127.0.0.1:${port}`);
});

export default app;
