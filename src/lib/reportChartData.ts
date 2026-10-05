import type { MonthReport, PrReportItem } from "../../shared/types";
import { analyzeReport } from "./analysis";

const FIX_TITLE_RE =
  /\b(fix|fixes|fixed|bug|bugfix|hotfix|patch|error|crash|broken|regression|revert|incident|outage|defect)\b/i;

export type ChartDatum = {
  label: string;
  value: number;
  color?: string;
  /** Full label for tooltips and accessibility (e.g. owner/repo). */
  fullLabel?: string;
  /** Opens in browser when the chart item is clicked. */
  href?: string;
};

// Fixed hue order, validated for CVD-safe adjacent-pair separation (see the
// dataviz skill) — never cycle or reassign by rank.
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

function isFixPr(pr: PrReportItem): boolean {
  return FIX_TITLE_RE.test(pr.title) || /^revert/i.test(pr.title);
}

export function repoPrChartData(report: MonthReport): ChartDatum[] {
  const byRepo = new Map<string, number>();
  for (const pr of report.mergedPrs) {
    byRepo.set(pr.repo, (byRepo.get(pr.repo) ?? 0) + 1);
  }
  return [...byRepo.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([repo, value], index) => ({
      label: repo.split("/").pop() ?? repo,
      fullLabel: repo,
      href: `https://github.com/${repo}`,
      value,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
}

export function repoLinesChartData(report: MonthReport): ChartDatum[] {
  const byRepo = new Map<string, number>();
  for (const pr of report.mergedPrs) {
    byRepo.set(pr.repo, (byRepo.get(pr.repo) ?? 0) + pr.additions + pr.deletions);
  }
  return [...byRepo.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([repo, value], index) => ({
      label: repo.split("/").pop() ?? repo,
      fullLabel: repo,
      href: `https://github.com/${repo}`,
      value,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
}

export function performanceMixChartData(report: MonthReport): ChartDatum[] {
  // Colors assigned in the same order as CHART_COLORS (slots 1-4) so the ring
  // chart's actual adjacent pairs match what the palette was validated on.
  return [
    { label: "Merged PRs", value: report.stats.prsMerged, color: "var(--chart-1)" },
    { label: "Open PRs", value: report.stats.prsOpen, color: "var(--chart-2)" },
    { label: "Closed", value: report.stats.prsClosed, color: "var(--chart-3)" },
    { label: "Commits", value: report.stats.commits, color: "var(--chart-4)" },
  ].filter((item) => item.value > 0);
}

export function errorCategoryChartData(report: MonthReport): ChartDatum[] {
  const fixes = report.mergedPrs.filter(isFixPr).length;
  const reverts = report.mergedPrs.filter((pr) => /^revert/i.test(pr.title)).length;
  const closed = report.closedPrs.length;
  const openFixes = report.openPrs.filter(isFixPr).length;
  const flagged = [...report.mergedPrs, ...report.openPrs, ...report.closedPrs].filter(
    (pr) => pr.advice && !/^Well-scoped/i.test(pr.advice),
  ).length;

  // Sequential slots 1-5 in listed order, same reasoning as performanceMixChartData.
  return [
    { label: "Fixes merged", value: fixes, color: "var(--chart-1)" },
    { label: "Reverts", value: reverts, color: "var(--chart-2)" },
    { label: "Closed unmerged", value: closed, color: "var(--chart-3)" },
    { label: "Open fix work", value: openFixes, color: "var(--chart-4)" },
    { label: "Review flags", value: flagged, color: "var(--chart-5)" },
  ].filter((item) => item.value > 0);
}

/** Where fix/revert PRs concentrate — a repo-by-repo breakdown of the same
 * merged-PR set errorCategoryChartData's "Fixes merged" slice counts. */
export function errorRepoChartData(report: MonthReport): ChartDatum[] {
  const byRepo = new Map<string, number>();
  for (const pr of report.mergedPrs.filter(isFixPr)) {
    byRepo.set(pr.repo, (byRepo.get(pr.repo) ?? 0) + 1);
  }
  return [...byRepo.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([repo, value], index) => ({
      label: repo.split("/").pop() ?? repo,
      fullLabel: repo,
      href: `https://github.com/${repo}`,
      value,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
}

export function errorRiskChartData(report: MonthReport): ChartDatum[] {
  const analysis = analyzeReport(report);
  return analysis.risks
    .filter((risk) => risk.prs.length > 0)
    .slice(0, 6)
    .map((risk, index) => ({
      label: risk.message.length > 42 ? `${risk.message.slice(0, 40)}…` : risk.message,
      fullLabel: risk.message,
      value: risk.prs.length,
      color: index < 2 ? "var(--chart-1)" : "var(--chart-2)",
    }));
}

/** ASCII bar chart for markdown / PDF text exports. */
export function asciiBarChart(data: ChartDatum[], maxBars = 12, width = 24): string {
  if (data.length === 0) return "_No data for this period._";
  const slice = data.slice(0, maxBars);
  const max = Math.max(...slice.map((d) => d.value), 1);
  return slice
    .map((item) => {
      const filled = Math.max(1, Math.round((item.value / max) * width));
      const bar = "█".repeat(filled) + "░".repeat(Math.max(0, width - filled));
      return `${item.label.padEnd(14)} ${bar} ${item.value}`;
    })
    .join("\n");
}
