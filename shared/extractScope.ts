export type ExtractedScope = {
  repo: string | null;
  branchName: string | null;
};

/** Labels people use for the GitHub repository / codebase name. */
const REPO_LABEL =
  /\b(?:git\s*)?(?:repo(?:sitory)?|codebase|project|code\s*base)\b\s*(?:[:=]|is)\s*([^\s,;\n]+)/i;

/** Labels people use for the git branch / workline name. */
const BRANCH_LABEL =
  /\b(?:git\s*)?(?:branch(?:\s*name)?|workline|work\s*line|feature\s*branch|line\s*of\s*development)\b\s*(?:[:=]|is)\s*([^\s,;\n]+)/i;

function cleanScopeValue(value: string): string {
  return value.replace(/[,;.]+$/, "").trim();
}

function firstLabeledValue(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  if (!match?.[1]) return null;
  const value = cleanScopeValue(match[1]);
  return value || null;
}

/** True when the text contains explicit repo/branch instructions (not just inferred headings). */
export function hasExplicitScopeLabels(text: string): boolean {
  return REPO_LABEL.test(text) || BRANCH_LABEL.test(text) || /github\.com\/[^\s]+/i.test(text);
}

function extractLabeledValue(text: string, kind: "repo" | "branch"): string | null {
  const patterns =
    kind === "repo"
      ? [
          REPO_LABEL,
          /\bcreate\s+(?:a\s+)?(?:new\s+)?(?:repo(?:sitory)?|codebase|project)\s+(?:called\s+|named\s+)?([^\s,;\n]+)/i,
        ]
      : [
          BRANCH_LABEL,
          /\bcreate\s+(?:a\s+)?(?:branch|workline)\s+(?:called\s+|named\s+)?([^\s,;\n]+)/i,
        ];

  for (const pattern of patterns) {
    const value = firstLabeledValue(text, pattern);
    if (value) return value;
  }
  return null;
}

/** Pull GitHub/Jira-style repo + branch hints out of free-form text. */
export function extractScopeFromText(text: string, knownRepos: string[] = []): ExtractedScope {
  const trimmed = text.trim();
  if (!trimmed) return { repo: null, branchName: null };

  const treeMatch = trimmed.match(
    /github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/tree\/([^\s/?#]+)/i,
  );
  if (treeMatch) {
    return {
      repo: treeMatch[1]!,
      branchName: decodeURIComponent(treeMatch[2]!.replace(/\/$/, "")),
    };
  }

  const repoUrlMatch = trimmed.match(/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/i);
  let repo = extractLabeledValue(trimmed, "repo");
  let branchName = extractLabeledValue(trimmed, "branch");

  if (!repo && knownRepos.length) {
    const lower = trimmed.toLowerCase();
    const hit = knownRepos.find((name) => lower.includes(name.toLowerCase()));
    if (hit) repo = hit;
  }
  if (!repo && repoUrlMatch) {
    repo = repoUrlMatch[1]!;
  }
  if (!repo) {
    for (const match of trimmed.matchAll(/\b([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\b/g)) {
      const candidate = match[1]!;
      if (knownRepos.includes(candidate)) {
        repo = candidate;
        break;
      }
      if (!repo && candidate.includes("/") && !candidate.startsWith("http")) {
        repo = candidate;
      }
    }
  }

  if (!branchName) {
    const jiraBranch = trimmed.match(/\b([A-Z][A-Z0-9]+-\d+(?:-[A-Za-z0-9][A-Za-z0-9_-]*)?)\b/);
    if (jiraBranch) branchName = jiraBranch[1]!;
  }

  if (repo && !branchName) branchName = repo.includes("/") ? null : repo;
  if (branchName && !repo) repo = branchName.includes("/") ? null : branchName;

  return { repo, branchName };
}

export function extractJiraIssueKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const match of text.matchAll(/\b([A-Z][A-Z0-9]+-\d+)\b/g)) {
    keys.add(match[1]!);
  }
  return [...keys];
}

/** Kebab-case branch slug from a title or heading when nothing else matches. */
export function suggestBranchFromTitle(title: string): string | null {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
  return slug || null;
}

function isScopeMetaLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/^\d+(\.\d+)*\s/.test(trimmed)) return true;
  return REPO_LABEL.test(trimmed) || BRANCH_LABEL.test(trimmed);
}

export function scopeHeadingFromText(text: string): string {
  const line =
    text
      .trim()
      .split("\n")
      .map((entry) => entry.trim())
      .find((entry) => entry && !isScopeMetaLine(entry)) ?? text.trim();
  return line;
}

/** Best-effort match of a project title against known repo names. */
export function matchRepoFromTitle(title: string, knownRepos: string[]): string | null {
  const slug = suggestBranchFromTitle(title);
  if (!slug || knownRepos.length === 0) return null;

  const tokens = slug.split("-").filter((token) => token.length > 2);
  let best: { repo: string; score: number } | null = null;

  for (const repo of knownRepos) {
    const name = repo.split("/").pop()?.toLowerCase() ?? "";
    const haystack = repo.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (name.includes(token) || haystack.includes(token)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { repo, score };
  }

  return best?.repo ?? null;
}

export function suggestRepoSlugFromTitle(title: string): string | null {
  return suggestBranchFromTitle(title);
}

export function isScopeFieldEmpty(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return trimmed.toLowerCase().startsWith("pick an existing repo");
}
