// Real AI code review grounded in actual PR diffs, as an alternative to the
// always-available heuristic in src/lib/analysis.ts (which only looks at PR
// metadata — added/deleted line counts, description length, staleness — and
// never reads a line of code). Ported from vantagedestkop/electron/aiCodeAnalysis.ts,
// adapted to server/ai.ts's Groq-only generateAiText (no AiRuntime abstraction).

import type { CodeRecommendation } from "../../shared/types";
import { extractJsonObject, generateAiText } from "../ai";

export type CodeAnalysisPr = {
  repo: string;
  number: number;
  title: string;
  body: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  files: Array<{ filename: string; patch: string | null }>;
};

export type CodeAnalysisScope = {
  username: string;
  mergedCount: number;
  openCount: number;
};

export type AiCodeRisk = { message: string; prLabels: string[] };

export type AiCodeAnalysisResult = {
  summary: string;
  strengths: string[];
  risks: AiCodeRisk[];
  recommendations: CodeRecommendation[];
};

const MAX_PRS = 6;
const MAX_FILES_PER_PR = 4;
const MAX_PATCH_CHARS = 900;
const MAX_BODY_CHARS = 400;
const MAX_TITLE_CHARS = 120;
const VALID_SEVERITIES = new Set(["info", "suggestion", "important"]);

function prLabel(pr: { repo: string; number: number }) {
  return `${pr.repo}#${pr.number}`;
}

function buildPrompt(scope: CodeAnalysisScope, prs: CodeAnalysisPr[]): string {
  const prSections = prs
    .map((pr) => {
      const files = pr.files
        .slice(0, MAX_FILES_PER_PR)
        .map((file) =>
          file.patch
            ? `  --- ${file.filename} ---\n${file.patch.slice(0, MAX_PATCH_CHARS)}`
            : `  --- ${file.filename} --- (no patch available)`,
        )
        .join("\n");
      return [
        `PR ${prLabel(pr)}: ${pr.title.slice(0, MAX_TITLE_CHARS)} (+${pr.additions}/-${pr.deletions}, ${pr.changedFiles} files)`,
        pr.body ? `Description: ${pr.body.slice(0, MAX_BODY_CHARS)}` : "",
        files || "  (no diff available)",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return [
    `You are a senior engineer reviewing ${scope.username}'s actual code changes (real diffs below), not just PR stats.`,
    `They merged ${scope.mergedCount} PR(s) and have ${scope.openCount} open in this selection; the diffs below are a sample of the largest/most significant merged PRs.`,
    "Read the real patches: judge code structure, naming, duplication, error handling, test coverage, and any risky patterns you can actually see in the diff — not line counts.",
    "Respond with a single JSON object only. No markdown fences, no commentary.",
    'Shape: {"summary":"2-3 sentence overview of code quality/structure across these diffs","strengths":["strength 1",...],"risks":[{"message":"specific risk grounded in the diff","prLabels":["repo#number",...]}],"recommendations":[{"title":"short title","severity":"info"|"suggestion"|"important","detail":"concrete, specific advice referencing what you saw in the code","relatedPrs":["repo#number",...]}]}',
    "Write every summary, strength, risk message, and recommendation detail as a complete, natural sentence with a subject and a verb — not a sentence fragment, keyword list, or hyphen/dash-joined clause. A recommendation title may be a short noun phrase, but its detail must still be a full sentence.",
    "Every risk and recommendation MUST be grounded in something actually visible in the diffs below — cite specifics (function/file names, patterns) rather than generic advice. Do not invent issues that aren't in the diff.",
    `Only reference PR labels from this exact set: ${prs.map(prLabel).join(", ") || "(none)"}.`,
    "Aim for 2-4 strengths, 1-4 risks, and 2-5 recommendations ordered most important first.",
    "",
    "=== Pull requests with diffs ===",
    prSections || "(no diffs available)",
  ].join("\n");
}

function sanitizeLabels(labels: unknown, valid: Set<string>): string[] {
  if (!Array.isArray(labels)) return [];
  return labels.filter((label): label is string => typeof label === "string" && valid.has(label));
}

function parseResponse(raw: string, validLabels: Set<string>): AiCodeAnalysisResult {
  const parsed = JSON.parse(extractJsonObject(raw)) as {
    summary?: string;
    strengths?: string[];
    risks?: Array<{ message?: string; prLabels?: string[] }>;
    recommendations?: Array<{ title?: string; severity?: string; detail?: string; relatedPrs?: string[] }>;
  };

  const strengths = Array.isArray(parsed.strengths)
    ? parsed.strengths.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean)
    : [];

  const risks: AiCodeRisk[] = Array.isArray(parsed.risks)
    ? parsed.risks
        .map((risk) => ({
          message: typeof risk.message === "string" ? risk.message.trim() : "",
          prLabels: sanitizeLabels(risk.prLabels, validLabels),
        }))
        .filter((risk) => risk.message)
    : [];

  const recommendations: CodeRecommendation[] = Array.isArray(parsed.recommendations)
    ? parsed.recommendations
        .map((rec) => ({
          title: typeof rec.title === "string" ? rec.title.trim() : "",
          severity: (VALID_SEVERITIES.has(rec.severity as string)
            ? rec.severity
            : "suggestion") as CodeRecommendation["severity"],
          detail: typeof rec.detail === "string" ? rec.detail.trim() : "",
          relatedPrs: sanitizeLabels(rec.relatedPrs, validLabels),
        }))
        .filter((rec) => rec.title && rec.detail)
    : [];

  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  // Only the summary is truly required — a small, clean diff can legitimately
  // come back with zero recommendations, and that isn't a parse failure.
  if (!summary) throw new Error("empty");

  return { summary, strengths, risks, recommendations };
}

export async function generateAiCodeAnalysis(
  scope: CodeAnalysisScope,
  prs: CodeAnalysisPr[],
): Promise<AiCodeAnalysisResult> {
  if (prs.length === 0) {
    throw new Error("No merged pull requests with diffs to review in this selection.");
  }
  const trimmed = prs.slice(0, MAX_PRS);
  const validLabels = new Set(trimmed.map(prLabel));
  const prompt = buildPrompt(scope, trimmed);

  // The underlying model can occasionally return truncated or malformed JSON
  // (small open models don't always honor "JSON only", and long reviews of
  // 6 PRs can run past the token budget) — one retry clears most of these
  // transient failures rather than surfacing an error on the first hiccup.
  let lastRaw = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    lastRaw = await generateAiText(prompt, { maxTokens: 3000 });
    try {
      return parseResponse(lastRaw, validLabels);
    } catch {
      // fall through to retry
    }
  }
  console.error("[codeAnalysisAi] could not parse AI response after retry:", lastRaw.slice(0, 2000));
  throw new Error("AI could not produce a code review from these diffs. Try again.");
}
