import { Hono } from "hono";
import type { CodeAnalysis, PrReportItem } from "../../shared/types";
import { requireAuth, type AuthEnv } from "./auth";
import { getUserGithubToken } from "./users";
import { consumeUsage } from "./billing";
import { HttpError } from "./store";
import { loadMonthReport, fetchPrFiles } from "../monthReport";
import { generateAiCodeAnalysis } from "./codeAnalysisAi";
import { getCachedAnalysis, getCachedReport, saveAnalysis, saveReport } from "./reportCache";

// Full authenticated month report (private repos included) for the signed-in
// user's own account — never for another username. Persisted in Supabase
// (server/cloud/reportCache.ts) so it survives restarts/deploys instead of
// living only in memory; past months are treated as immutable.

export const reportRoutes = new Hono<AuthEnv>();

reportRoutes.use("/reports/*", requireAuth);

function invalidPeriod(year: number, month: number) {
  return !Number.isInteger(year) || year < 2000 || year > 2100 || month < 1 || month > 12;
}

async function getReport(userId: string, login: string, token: string, year: number, month: number) {
  const cached = await getCachedReport(userId, year, month);
  if (cached) return cached;
  const report = await loadMonthReport(token, login, year, month);
  await saveReport(userId, year, month, report);
  return report;
}

reportRoutes.get("/reports/:year/:month", async (c) => {
  const user = c.get("user");
  const year = Number(c.req.param("year"));
  const month = Number(c.req.param("month"));
  if (invalidPeriod(year, month)) return c.json({ error: "Invalid year or month." }, 400);

  const token = await getUserGithubToken(user.id);
  if (!token) {
    return c.json({ error: "Connect GitHub with full access first — sign in again to grant it." }, 400);
  }

  try {
    return c.json(await getReport(user.id, user.login, token, year, month));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load the report.";
    return c.json({ error: message }, 502 as 400);
  }
});

reportRoutes.post("/reports/:year/:month/code-analysis", async (c) => {
  const user = c.get("user");
  const year = Number(c.req.param("year"));
  const month = Number(c.req.param("month"));
  if (invalidPeriod(year, month)) return c.json({ error: "Invalid year or month." }, 400);

  const force = c.req.query("force") === "true";
  if (!force) {
    const cached = await getCachedAnalysis(user.id, year, month);
    if (cached) return c.json(cached);
  }

  const token = await getUserGithubToken(user.id);
  if (!token) {
    return c.json({ error: "Connect GitHub with full access first — sign in again to grant it." }, 400);
  }

  try {
    const report = await getReport(user.id, user.login, token, year, month);

    await consumeUsage(user.id, "ai");

    const candidates = [...report.mergedPrs]
      .sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions))
      .slice(0, 6);

    const prsWithDiffs = await Promise.all(
      candidates.map(async (pr) => {
        const files = await fetchPrFiles(token, pr.repo, pr.number).catch(() => []);
        return {
          repo: pr.repo,
          number: pr.number,
          title: pr.title,
          body: pr.body,
          additions: pr.additions,
          deletions: pr.deletions,
          changedFiles: pr.changedFiles,
          files: files.map((file) => ({ filename: file.filename, patch: file.patch })),
        };
      }),
    );

    const result = await generateAiCodeAnalysis(
      { username: user.login, mergedCount: report.mergedPrs.length, openCount: report.openPrs.length },
      prsWithDiffs,
    );

    const allPrs = [...report.mergedPrs, ...report.openPrs, ...report.closedPrs];
    const resolvePr = (label: string) => {
      const match = label.match(/^(.+)#(\d+)$/);
      if (!match) return undefined;
      const repo = match[1]!;
      const number = Number(match[2]);
      return allPrs.find((pr) => pr.repo === repo && pr.number === number);
    };

    const analysis: CodeAnalysis = {
      summary: result.summary,
      strengths: result.strengths,
      risks: result.risks.map((risk) => ({
        message: risk.message,
        prs: risk.prLabels.map(resolvePr).filter((pr): pr is PrReportItem => Boolean(pr)),
      })),
      recommendations: result.recommendations,
    };

    await saveAnalysis(user.id, year, month, analysis);
    return c.json(analysis);
  } catch (err) {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status as 400);
    const message = err instanceof Error ? err.message : "Could not generate the AI code review.";
    return c.json({ error: message }, 502 as 400);
  }
});
