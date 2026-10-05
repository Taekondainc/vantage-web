import type { CodeAnalysis, CodeRecommendation, PrReportItem } from "../../shared/types";

const LARGE_LINES = 400;
const LARGE_FILES = 15;
const STALE_OPEN_DAYS = 14;

type ScopedReport = {
  username: string;
  mergedPrs: PrReportItem[];
  openPrs: PrReportItem[];
};

function daysOpen(pr: PrReportItem): number {
  return Math.round((Date.now() - new Date(pr.createdAt).getTime()) / 86_400_000);
}

function prLabel(pr: PrReportItem) {
  return `${pr.repo}#${pr.number}`;
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Aggregates the same non-AI heuristics used per-PR (server/summarize.ts)
 * into a report-level review: strengths, risks, and concrete recommendations.
 * Pure and synchronous — no network calls, no external service, nothing to
 * break or run out of credits.
 */
export function analyzeReport(report: ScopedReport): CodeAnalysis {
  const merged = report.mergedPrs;
  const open = report.openPrs;

  if (merged.length === 0 && open.length === 0) {
    return {
      summary: `No pull request activity recorded for ${report.username} in this selection, so there isn't code to analyze yet.`,
      strengths: [],
      risks: [],
      recommendations: [],
    };
  }

  const totalLines = merged.reduce((sum, pr) => sum + pr.additions + pr.deletions, 0);
  const avgLines = merged.length ? Math.round(totalLines / merged.length) : 0;
  const repos = new Set(merged.map((pr) => pr.repo));

  const large = merged.filter((pr) => pr.additions + pr.deletions > LARGE_LINES || pr.changedFiles > LARGE_FILES);
  const thin = merged.filter((pr) => !pr.hasDescription);
  const staleOpen = open.filter((pr) => daysOpen(pr) > STALE_OPEN_DAYS);
  const reverts = merged.filter((pr) => /^revert/i.test(pr.title));

  const strengths: string[] = [];
  if (merged.length > 0) {
    strengths.push(
      `Shipped ${plural(merged.length, "merged pull request")}${repos.size > 1 ? ` across ${plural(repos.size, "repository", "repositories")}` : ""}.`,
    );
  }
  if (merged.length > 0 && large.length / merged.length < 0.3) {
    strengths.push("Most PRs were a reviewable size, which keeps code review fast and safe.");
  }
  if (merged.length > 0 && thin.length / merged.length < 0.3) {
    strengths.push("Most PRs included a clear description of the change.");
  }
  if (open.length > 0 && staleOpen.length === 0) {
    strengths.push("Open PRs are being kept fresh rather than left stale.");
  }
  if (strengths.length === 0) {
    strengths.push("There is shipped work this period, which is the important part.");
  }

  const risks: CodeAnalysis["risks"] = [];
  if (large.length > 0) {
    risks.push({
      message: `${plural(large.length, "PR")} ${large.length === 1 ? "was" : "were"} unusually large (over ${LARGE_LINES} changed lines or ${LARGE_FILES} files), which raises review risk.`,
      prs: large,
    });
  }
  if (thin.length > 0) {
    risks.push({
      message: `${plural(thin.length, "PR")} had little or no description, making the "why" hard to recover later.`,
      prs: thin,
    });
  }
  if (staleOpen.length > 0) {
    risks.push({
      message: `${plural(staleOpen.length, "open PR")} have been sitting for ${STALE_OPEN_DAYS}+ days.`,
      prs: staleOpen,
    });
  }
  if (reverts.length > 0) {
    risks.push({
      message: `${plural(reverts.length, "revert")} landed, which usually points at an earlier regression worth a root-cause note.`,
      prs: reverts,
    });
  }
  if (avgLines > LARGE_LINES + 100) {
    risks.push({
      message: `Average PR size was ${avgLines.toLocaleString()} changed lines, well above a comfortably reviewable range.`,
      prs: [],
    });
  }
  if (risks.length === 0) {
    risks.push({
      message: "No notable risk signals found in this selection.",
      prs: [],
    });
  }

  const recommendations: CodeRecommendation[] = [];
  if (large.length > 0) {
    recommendations.push({
      title: "Split oversized PRs",
      severity: large.length / merged.length > 0.4 ? "important" : "suggestion",
      detail:
        "Break large changes into smaller, vertically-sliced PRs (e.g. by feature step or file group) so reviewers can actually reason about them.",
      relatedPrs: large.slice(0, 5).map(prLabel),
    });
  }
  if (thin.length > 0) {
    recommendations.push({
      title: "Write a real PR description",
      severity: thin.length / merged.length > 0.4 ? "important" : "suggestion",
      detail: "Add a short why/what/impact note on each PR (not just the title) so this report — and future debugging — stays useful.",
      relatedPrs: thin.slice(0, 5).map(prLabel),
    });
  }
  if (staleOpen.length > 0) {
    recommendations.push({
      title: "Clear out stale open PRs",
      severity: "suggestion",
      detail: "Rebase, request review, or close PRs that have been open for more than two weeks so they don't rot.",
      relatedPrs: staleOpen.slice(0, 5).map(prLabel),
    });
  }
  if (reverts.length > 0) {
    recommendations.push({
      title: "Document what broke",
      severity: "info",
      detail: "When reverting, leave a note on the follow-up PR/issue about the root cause so the same regression doesn't slip back in.",
      relatedPrs: reverts.slice(0, 5).map(prLabel),
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      title: "Keep up the current habits",
      severity: "info",
      detail: "PR sizing and descriptions look healthy for this period — no changes needed.",
      relatedPrs: [],
    });
  }

  const summary = `${report.username} merged ${plural(merged.length, "pull request")}${
    open.length ? ` and has ${plural(open.length, "PR")} open` : ""
  } in this selection, averaging ${avgLines.toLocaleString()} changed lines per merged PR.`;

  return { summary, strengths, risks, recommendations };
}
