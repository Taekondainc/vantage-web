import type { ExtractedScope } from "../shared/types";
import { extractScopeFromText } from "../shared/extractScope";
import { generateAiText } from "./ai";
import { extractJsonObject } from "./ai";

export function scopeHeaderForAi(text: string): string {
  const lines = text.trim().split("\n");
  const header: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (header.length >= 2 && /^\d+(\.\d+)*\s+\S/.test(trimmed)) break;
    if (!trimmed && header.length >= 4) break;
    header.push(line);
    if (header.length >= 30) break;
  }

  const joined = header.join("\n").trim();
  return joined || text.trim().slice(0, 2500);
}

function normalizeRepo(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(trimmed)) return trimmed;
  if (/^[A-Za-z0-9_.-]+$/.test(trimmed)) return trimmed;
  return null;
}

function normalizeBranch(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  return trimmed;
}

async function extractScopeWithAi(text: string): Promise<ExtractedScope> {
  const header = scopeHeaderForAi(text);
  const prompt = [
    "Read the opening lines of a project brief and extract the GitHub repository and git branch/ref the author wants.",
    "Authors use arbitrary labels — infer intent, do NOT require specific words.",
    "Typical patterns at the TOP of the document (labels vary widely):",
    "- A line naming WHERE code lives → repo (e.g. Source tree, Codebase, Repository, Project, Git repo, Service name)",
    "- A line naming WHICH ref to work on → branchName (e.g. Ref, Branch, Workline, Feature branch, Git ref)",
    'Example: "Source tree: intent-registry-service" + "Ref: dev/eoi-intake-flow"',
    '→ {"repo":"intent-registry-service","branchName":"dev/eoi-intake-flow"}',
    "Respond with a single JSON object only. No markdown fences, no commentary.",
    'Shape: {"repo":"owner/repo or short-new-repo-slug or null","branchName":"branch-or-ref or null"}',
    "Rules:",
    "- Only use the header/preamble — ignore numbered sections and requirement text (T1, T2, …).",
    "- branchName may contain slashes (feature/foo, dev/bar).",
    "- Return null when a field is not specified — never invent from the spec body.",
    "",
    "=== Document header ===",
    header,
  ].join("\n");

  const raw = await generateAiText(prompt, { maxTokens: 300, temperature: 0.15 });
  try {
    const parsed = JSON.parse(extractJsonObject(raw)) as { repo?: unknown; branchName?: unknown };
    const repo = typeof parsed.repo === "string" ? normalizeRepo(parsed.repo) : null;
    const branchName = typeof parsed.branchName === "string" ? normalizeBranch(parsed.branchName) : null;
    return { repo, branchName };
  } catch {
    return { repo: null, branchName: null };
  }
}

function extractDefinitiveScope(text: string): ExtractedScope {
  const treeMatch = text.match(
    /github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/tree\/([^\s/?#]+)/i,
  );
  if (treeMatch) {
    return {
      repo: treeMatch[1]!,
      branchName: decodeURIComponent(treeMatch[2]!.replace(/\/$/, "")),
    };
  }
  const repoUrlMatch = text.match(/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/i);
  if (repoUrlMatch) return { repo: repoUrlMatch[1]!, branchName: null };
  return { repo: null, branchName: null };
}

export async function resolveScopeFromText(text: string): Promise<ExtractedScope> {
  const trimmed = String(text || "").trim();
  if (!trimmed) return { repo: null, branchName: null };

  const definitive = extractDefinitiveScope(trimmed);
  let repo = definitive.repo;
  let branchName = definitive.branchName;

  try {
    const ai = await extractScopeWithAi(trimmed);
    if (ai.repo) repo = ai.repo;
    if (ai.branchName) branchName = ai.branchName;
  } catch {
    const fallback = extractScopeFromText(trimmed);
    repo = repo || fallback.repo;
    branchName = branchName || fallback.branchName;
  }

  return { repo, branchName };
}
