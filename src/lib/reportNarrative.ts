import type { MonthReport, PrReportItem, YearReport } from "../../shared/types";
import { plainText } from "../../shared/stripHtml";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/** Close a sentence with a period, unless it already ends in terminal
 * punctuation (e.g. a truncated list item ending in "…") — avoids "…." */
function closeSentence(text: string) {
  return /[.…!?]$/.test(text) ? text : `${text}.`;
}

function listNames(names: string[], limit = 4) {
  const unique = [...new Set(names.filter(Boolean))];
  if (unique.length === 0) return "";
  const shown = unique.slice(0, limit);
  const extra = unique.length - shown.length;
  if (shown.length === 1) return shown[0];
  if (shown.length === 2) return `${shown[0]} and ${shown[1]}`;
  const head = shown.slice(0, -1).join(", ");
  const tail = shown[shown.length - 1];
  return extra > 0 ? `${head}, and ${tail}, plus ${extra} more` : `${head}, and ${tail}`;
}

/** Prefer the human "what was done" sentence from the PR blurb/title. */
export function whatWasDone(pr: PrReportItem) {
  const line = plainText(pr.line1 || pr.title).replace(/[.]+$/g, "").trim();
  return stripDanglingEnd(line) || line;
}

const CONVENTIONAL_TITLE_RE = /^(\w+)(?:\([^)]+\))?\s*:\s*(.+)$/;
const LEADING_VERB_RE =
  /^(add|adds|added|create|creates|created|implement|implements|implemented|build|builds|built|make|makes|made|update|updates|updated|fix|fixes|fixed|improve|improves|improved|enhance|enhances|enhanced|support|supports|refactor|refactors|refactored|revert|reverts|reverted|ship|ships|shipped)\s+/i;
const LEADING_ARTICLE_RE = /^(a|an|the)\s+/i;
// Matches a leading ticket id in any of its real-world shapes: "NV-158-",
// "NV-158: ", "NV-158 ", or "Nv 158 " — the letters and number can be joined
// by a dash OR a space (some tooling renders a PR title by turning the
// branch name's dashes into spaces and lowercasing everything but the first
// letter, so "NV-158" becomes "Nv 158" before it ever reaches this code).
const LEADING_TICKET_RE = /^[A-Za-z]{1,10}[\s-]\d+\s*[:-]?\s*/;

/** Turn a PR title into a short plain-language phrase for use inside a list
 * item, e.g. "NV-158-lot-selection-at-eoi" -> "lot selection at eoi", or
 * "fix: session timeout" -> "session timeout". Unlike pr.line1 (a
 * pre-truncated standalone sentence meant for its own line), this always
 * starts from the raw, untruncated title so list items never inherit a
 * mid-word "…" from an unrelated 110-char cutoff. */
function humanizeTitle(title: string) {
  let subject = plainText(title).trim();
  subject = subject.replace(LEADING_TICKET_RE, "");

  const conventional = subject.match(CONVENTIONAL_TITLE_RE);
  if (conventional) subject = conventional[2]!;

  const looksLikeSlug = !/\s/.test(subject) && /[-_]/.test(subject);
  if (looksLikeSlug) {
    subject = subject.replace(/[-_]+/g, " ");
  }

  subject = subject.replace(LEADING_VERB_RE, "").replace(LEADING_ARTICLE_RE, "").replace(/[.]+$/g, "").trim();
  return subject || plainText(title).trim();
}

// Dangling connectors that read as an unfinished sentence when a truncated
// phrase happens to end on one, e.g. "...server local time so…" instead of
// the cleaner "...server local time…".
const TRAILING_WEAK_WORD_RE =
  /\s+(a|an|the|to|of|in|on|at|by|for|with|from|and|or|but|so|as|that|which|when|is|are|was|were|be|been|being)$/i;

// PR/branch titles are sometimes themselves authored as an unfinished
// fragment (e.g. someone typed "carry-forward to Appli..." as a WIP branch
// name) — strip any pre-existing trailing "..."/"…" and dangling connector
// before we ever decide whether OUR truncation needs to add its own "…".
function stripDanglingEnd(text: string): string {
  let out = text.replace(/(?:\.{2,}|…)+\s*$/g, "").trimEnd();
  let prev: string;
  do {
    prev = out;
    out = out.replace(TRAILING_WEAK_WORD_RE, "");
  } while (out !== prev && out.length > 0);
  return out;
}

/** Cap a list item's own length, built word-by-word so a partial word can
 * never leak through (a slice-then-trim approach can, at certain lengths) —
 * kept short enough that several of these joined together still reads as one
 * sentence. Also strips any dangling ellipsis/connector already present in
 * the source title, and (when truncating) any left dangling by the cut, so
 * the result never ends on "so", "to", "and…", etc. */
function shortLabel(text: string, max = 70) {
  const clean = text.trim();
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

function workLabel(pr: PrReportItem) {
  return shortLabel(humanizeTitle(pr.title));
}

export function filterReport(report: MonthReport, repo: string): MonthReport {
  if (repo === "all") return report;
  const mergedPrs = report.mergedPrs.filter((pr) => pr.repo === repo);
  const openPrs = report.openPrs.filter((pr) => pr.repo === repo);
  const closedPrs = report.closedPrs.filter((pr) => pr.repo === repo);
  const pushes = report.pushes.filter((group) => group.repo === repo);
  const commits = pushes.reduce((sum, group) => sum + group.commits.length, 0);
  return {
    ...report,
    mergedPrs,
    openPrs,
    closedPrs,
    pushes,
    stats: {
      prsMerged: mergedPrs.length,
      prsOpen: openPrs.length,
      prsClosed: closedPrs.length,
      commits,
      repos: mergedPrs.length || openPrs.length || closedPrs.length || pushes.length ? 1 : 0,
      additions: mergedPrs.reduce((sum, pr) => sum + pr.additions, 0),
      deletions: mergedPrs.reduce((sum, pr) => sum + pr.deletions, 0),
    },
  };
}

export type NarrativeVoice = "third" | "first";

function who(username: string, voice: NarrativeVoice) {
  return voice === "first" ? "I" : username;
}

function allReposLabel(voice: NarrativeVoice, year: boolean) {
  if (voice === "first") return "across my repositories";
  return year ? "across all tracked repositories" : "across their repositories";
}

export function buildMonthNarrative(
  report: MonthReport,
  repo = "all",
  voice: NarrativeVoice = "third",
): string {
  const scoped = filterReport(report, repo);
  const monthName = MONTHS[scoped.month - 1];
  const scopeLabel = repo === "all" ? allReposLabel(voice, false) : `in ${repo}`;
  const person = who(scoped.username, voice);
  const sentences: string[] = [];

  if (
    scoped.stats.prsMerged === 0 &&
    scoped.stats.commits === 0 &&
    scoped.stats.prsOpen === 0 &&
    scoped.stats.prsClosed === 0
  ) {
    return `In ${monthName} ${scoped.year}, ${person} had no pull requests or commits recorded ${scopeLabel}.`;
  }

  if (scoped.mergedPrs.length > 0) {
    const done = scoped.mergedPrs.map(workLabel);
    sentences.push(
      scoped.mergedPrs.length === 1
        ? `In ${monthName} ${scoped.year}, ${person} mainly worked on ${done[0]} ${scopeLabel}.`
        : `In ${monthName} ${scoped.year}, ${person} worked on ${listNames(done, 4)} ${scopeLabel}.`,
    );
    sentences.push(
      `Those changes shipped as ${plural(scoped.mergedPrs.length, "pull request")} with ${scoped.stats.additions.toLocaleString()} lines added and ${scoped.stats.deletions.toLocaleString()} removed.`,
    );
  } else {
    sentences.push(
      `In ${monthName} ${scoped.year}, ${person} pushed ${plural(scoped.stats.commits, "commit")} ${scopeLabel}, but no pull requests were merged.`,
    );
  }

  if (scoped.openPrs.length > 0) {
    const openWork = scoped.openPrs.map(workLabel);
    sentences.push(closeSentence(`Work still in progress includes ${listNames(openWork, 4)}`));
  }

  if (scoped.closedPrs.length > 0) {
    sentences.push(`${plural(scoped.closedPrs.length, "pull request")} closed without merging.`);
  }

  if (scoped.stats.commits > 0) {
    sentences.push(`Push activity for the month totaled ${plural(scoped.stats.commits, "commit")}.`);
  }

  return sentences.join(" ");
}

export function buildWorkList(report: MonthReport, repo = "all"): Array<{
  label: string;
  detail: string;
  repo: string;
  number: number;
  url: string;
}> {
  const scoped = filterReport(report, repo);
  return scoped.mergedPrs.map((pr) => ({
    label: whatWasDone(pr),
    detail: plainText(pr.line2),
    repo: pr.repo,
    number: pr.number,
    url: pr.url,
  }));
}

export function buildYearNarrative(
  report: YearReport,
  repo = "all",
  voice: NarrativeVoice = "third",
): string {
  const scopeLabel = repo === "all" ? allReposLabel(voice, true) : `in ${repo}`;
  const person = who(report.username, voice);
  const sentences: string[] = [];

  if (report.stats.prsMerged === 0 && report.stats.commits === 0 && report.stats.prsClosed === 0) {
    return `In ${report.year}, ${person} had no pull requests or commits recorded ${scopeLabel}.`;
  }

  if (report.mergedPrs.length > 0) {
    const done = report.mergedPrs.map(workLabel);
    sentences.push(
      `In ${report.year}, ${person} shipped work including ${listNames(done, 5)} ${scopeLabel}.`,
    );
  } else {
    sentences.push(
      `In ${report.year}, ${person} pushed ${plural(report.stats.commits, "commit")} ${scopeLabel}.`,
    );
  }

  sentences.push(
    `That covered ${plural(report.stats.prsMerged, "merged pull request")}, ${plural(report.stats.commits, "commit")}, and ${plural(report.stats.monthsActive, "active month")} in ${plural(report.stats.repos, "repository", "repositories")}.`,
  );

  const activeMonths = report.months.filter((month) => month.stats.prsMerged + month.stats.commits > 0);
  if (activeMonths.length > 0) {
    const peak = [...activeMonths].sort(
      (a, b) => b.stats.prsMerged + b.stats.commits - (a.stats.prsMerged + a.stats.commits),
    )[0]!;
    sentences.push(`${MONTHS[peak.month - 1]} was the busiest month.`);
  }

  return sentences.join(" ");
}
