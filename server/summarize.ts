import type { PrState } from "../shared/types";

const TITLE_PREFIX: Record<string, string> = {
  feat: "Built",
  feature: "Built",
  fix: "Fixed",
  bugfix: "Fixed",
  chore: "Did maintenance on",
  docs: "Documented",
  doc: "Documented",
  refactor: "Refactored",
  style: "Polished",
  test: "Added tests for",
  tests: "Added tests for",
  perf: "Improved performance of",
  ci: "Updated CI for",
  build: "Updated the build for",
  revert: "Reverted",
  enhance: "Improved",
  enhancement: "Improved",
  update: "Updated",
  add: "Added",
};

export type SummarizeInput = {
  title: string;
  body: string | null;
  repo: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  base: string;
  state: PrState;
};

import { stripHtml } from "../shared/stripHtml";

function collapse(text: string) {
  return stripHtml(text).replace(/\s+/g, " ").trim();
}

// Dangling connectors that read as an unfinished sentence when a truncated
// phrase happens to end on one (e.g. "...server local time so…").
const TRAILING_WEAK_WORD_RE =
  /\s+(a|an|the|to|of|in|on|at|by|for|with|from|and|or|but|so|as|that|which|when|is|are|was|were|be|been|being)$/i;

// PR/branch titles are sometimes themselves authored as an unfinished
// fragment (e.g. "carry-forward to Appli..." as a WIP branch name) — strip
// any pre-existing trailing "..."/"…" and dangling connector before deciding
// whether OUR truncation needs to add its own "…".
function stripDanglingEnd(text: string): string {
  let out = text.replace(/(?:\.{2,}|…)+\s*$/g, "").trimEnd();
  let prev: string;
  do {
    prev = out;
    out = out.replace(TRAILING_WEAK_WORD_RE, "");
  } while (out !== prev && out.length > 0);
  return out;
}

/** Cap a line's length, built word-by-word so a partial word can never leak
 * through. Also strips any dangling ellipsis/connector already present in
 * the source text, and (when truncating) any left dangling by the cut. */
function capLine(text: string, max = 110) {
  const clean = collapse(text);
  if (clean.length <= max) {
    const cleaned = stripDanglingEnd(clean);
    return cleaned || clean;
  }

  const words = clean.split(/\s+/);
  let fit = "";
  for (const word of words) {
    const next = fit ? `${fit} ${word}` : word;
    if (next.length > max) break;
    fit = next;
  }
  if (!fit) fit = clean.slice(0, max);

  const trimmed = stripDanglingEnd(fit);
  return `${trimmed || fit}…`;
}

function cleanBody(body: string) {
  return stripHtml(body)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s*\|.*\|$/gm, "")
    .replace(/^\s*[-*+]\s*\[[ xX]\]\s*/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_`>]/g, "")
    .replace(/\r/g, "")
    .trim();
}

/** True when a PR body has real explanatory content beyond boilerplate/template noise. */
export function hasUsefulDescription(body: string | null): boolean {
  if (!body) return false;
  return usefulLines(cleanBody(body)).join(" ").length >= 40;
}

function usefulLines(text: string) {
  return text
    .split("\n")
    .map((line) => collapse(line))
    .filter((line) => line.length >= 18)
    .filter(
      (line) =>
        !/^(summary|description|overview|changes?|todo|wip|checklist|test plan)$/i.test(line),
    );
}

function firstUsefulSentence(text: string) {
  const lines = usefulLines(text);
  if (!lines.length) return null;
  const match = lines[0].match(/^(.+?[.!?])(\s|$)/);
  const sentence = collapse(match ? match[1] : lines[0]).replace(/[.]+$/, "");
  if (!sentence) return null;
  return `${sentence[0].toUpperCase()}${sentence.slice(1)}.`;
}

/** Turn a PR title into a plain work phrase like "drawer creator". */
export function workSubject(title: string) {
  let subject = collapse(title);
  const conventional = subject.match(/^(\w+)(?:\([^)]+\))?\s*:\s*(.+)$/);
  if (conventional) {
    subject = conventional[2];
  }

  subject = subject
    .replace(
      /^(add|adds|added|create|creates|created|implement|implements|implemented|build|builds|built|make|makes|made|update|updates|updated|fix|fixes|fixed|improve|improves|improved|enhance|enhances|enhanced|support|supports)\s+/i,
      "",
    )
    .replace(/^(a|an|the)\s+/i, "")
    .replace(/[.]+$/g, "")
    .trim();

  return subject || collapse(title);
}

function workSentence(title: string) {
  const conventional = collapse(title).match(/^(\w+)(?:\([^)]+\))?\s*:\s*(.+)$/);
  const subject = workSubject(title);

  if (conventional) {
    const verb = TITLE_PREFIX[conventional[1].toLowerCase()] || "Shipped";
    return `${verb} ${subject}.`;
  }

  if (/^(add|fix|update|create|implement|improve|enhance)/i.test(collapse(title))) {
    const cleaned = collapse(title).replace(/[.]+$/g, "");
    return `${cleaned[0].toUpperCase()}${cleaned.slice(1)}.`;
  }

  return `Shipped ${subject}.`;
}

function whyLine(input: SummarizeInput) {
  const body = input.body ? firstUsefulSentence(cleanBody(input.body)) : null;
  if (body && !body.toLowerCase().includes(workSubject(input.title).toLowerCase().slice(0, 12))) {
    return body;
  }

  const files = input.changedFiles;
  const hasStats = files > 0 || input.additions > 0 || input.deletions > 0;
  const stats = `+${input.additions} / -${input.deletions}`;
  if (input.state === "open") {
    if (!hasStats) {
      return `This change is still open in ${input.repo}.`;
    }
    return `This change is still open against ${input.base} in ${input.repo}, touching ${files} file${files === 1 ? "" : "s"} (${stats}).`;
  }
  if (!hasStats) {
    return `This landed in ${input.repo}.`;
  }
  return `This landed in ${input.repo} on ${input.base}, touching ${files} file${files === 1 ? "" : "s"} (${stats}).`;
}

export function explainPr(input: SummarizeInput): [string, string] {
  const what = workSentence(input.title);
  const why = whyLine(input);
  return [capLine(what), capLine(why)];
}

const ISSUE_LINK_RE = /#\d+/;
const VAGUE_TITLE_RE = /^(wip|fix|fixes|fixup|update|updates|misc|stuff|changes?|test|tmp|cleanup)[.:!]*$/i;
const STALE_OPEN_DAYS = 14;
const LARGE_LINES = 400;
const LARGE_FILES = 15;

/**
 * Heuristic, non-AI code-review nudge for a single PR. Looks only at metadata
 * we already have (title, description, diff stats, age) — no extra API calls,
 * no external service, so it never breaks or costs anything.
 */
export function advisePr(input: SummarizeInput & { createdAt?: string }): string | null {
  const title = collapse(input.title).replace(/[.:!]+$/, "");
  const totalLines = input.additions + input.deletions;
  const bodyText = input.body ? cleanBody(input.body) : "";
  const notes: string[] = [];

  if (!hasUsefulDescription(input.body)) {
    notes.push("add a short description of why the change was made, not just what changed");
  }

  if (totalLines > LARGE_LINES || input.changedFiles > LARGE_FILES) {
    notes.push(
      `this touched ${input.changedFiles} file${input.changedFiles === 1 ? "" : "s"} (+${input.additions}/-${input.deletions}) — consider splitting large changes like this into smaller, focused PRs`,
    );
  } else if (totalLines > 800 && input.changedFiles <= 3) {
    notes.push("a huge line count across very few files often means a generated or vendored file slipped in — worth double-checking");
  }

  if (totalLines > 30 && !ISSUE_LINK_RE.test(title) && !ISSUE_LINK_RE.test(bodyText)) {
    notes.push('link the related issue (e.g. "Closes #123") so the change is easy to trace later');
  }

  if (VAGUE_TITLE_RE.test(title)) {
    notes.push("a more descriptive title would make this easier to find later");
  }

  if (/^revert/i.test(title)) {
    notes.push("since this reverts earlier work, a note on what broke helps avoid reintroducing the same issue");
  }

  if (input.state === "open" && input.createdAt) {
    const ageDays = Math.round((Date.now() - new Date(input.createdAt).getTime()) / 86_400_000);
    if (ageDays > STALE_OPEN_DAYS) {
      notes.push(`this has been open for ${ageDays} days — worth rebasing, requesting review, or closing it if it's stale`);
    }
  }

  if (notes.length === 0) {
    if (hasUsefulDescription(input.body) && totalLines > 0 && totalLines <= LARGE_LINES) {
      return capLine("Well-scoped change with a clear description — good practice to keep up.");
    }
    return null;
  }

  const sentence = `Consider: ${notes[0]}${notes[1] ? `; also ${notes[1]}` : ""}.`;
  return capLine(sentence, 220);
}
