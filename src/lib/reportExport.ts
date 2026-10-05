import type { CodeAnalysis, MonthReport } from "../../shared/types";
import { plainText } from "../../shared/stripHtml";
import { filterReport, whatWasDone } from "./reportNarrative";
import { flattenCommits } from "./reportSort";

function formatWorkItem(pr: MonthReport["mergedPrs"][number], index: number) {
  const lines = [`${index}. ${whatWasDone(pr)}`];
  const line2 = plainText(pr.line2);
  if (line2) lines.push(`   ${line2}`);
  lines.push(`   ${pr.repo}#${pr.number} · ${pr.baseBranch} — ${pr.url}`);
  return lines.join("\n");
}

function formatOpenOrClosed(pr: MonthReport["openPrs"][number]) {
  return `- ${whatWasDone(pr)} (${pr.repo}#${pr.number} · ${pr.baseBranch} — ${pr.url})`;
}

function formatCommitLine(commit: { repo: string; sha: string; message: string; url: string; date: string }) {
  return `- ${commit.message} (\`${commit.sha}\` · ${commit.repo} · ${commit.date.slice(0, 10)} — ${commit.url})`;
}

function section(title: string, body: string | null) {
  if (!body) return "";
  return `## ${title}\n\n${body}\n`;
}

/** Full report as Markdown — narrative, totals, PRs (with heuristic what/why
 * descriptions), commits, and code analysis. Used for the web app's
 * download/share options, mirroring vantagedestkop's buildMonthSubmitMarkdown
 * at a reduced scope (no submission templates or task/objective sections —
 * those are separate features on the web app). */
export function buildFullReportMarkdown(
  report: MonthReport,
  repoFilter: string,
  narrative: string,
  analysis: CodeAnalysis,
): string {
  const scoped = filterReport(report, repoFilter);
  const scopeLabel = repoFilter === "all" ? "All repositories" : repoFilter;
  const title = `${scoped.name || scoped.username} — monthly work report`;

  const shipped = scoped.mergedPrs.map((pr, i) => formatWorkItem(pr, i + 1)).join("\n\n");
  const inProgress = scoped.openPrs.map(formatOpenOrClosed).join("\n");
  const closed = scoped.closedPrs.map(formatOpenOrClosed).join("\n");
  const commitLines = flattenCommits(scoped.pushes).map(formatCommitLine).join("\n");

  const totals = [
    `- Pull requests merged: ${scoped.stats.prsMerged}`,
    `- Pull requests open: ${scoped.stats.prsOpen}`,
    `- Pull requests closed: ${scoped.stats.prsClosed}`,
    `- Commits: ${scoped.stats.commits}`,
    `- Repositories: ${scoped.stats.repos}`,
    `- Lines in merged PRs: +${scoped.stats.additions.toLocaleString()} / −${scoped.stats.deletions.toLocaleString()}`,
  ].join("\n");

  const analysisBody = [
    analysis.summary,
    analysis.strengths.length ? `\n**Strengths**\n${analysis.strengths.map((s) => `- ${s}`).join("\n")}` : "",
    analysis.risks.length ? `\n**Risks**\n${analysis.risks.map((r) => `- ${r.message}`).join("\n")}` : "",
    analysis.recommendations.length
      ? `\n**Recommendations**\n${analysis.recommendations.map((r) => `- **${r.title}** — ${r.detail}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const parts = [
    `# ${title}`,
    "",
    `@${scoped.username} · ${scopeLabel}`,
    "",
    section("Summary", narrative),
    section("What shipped", shipped || null),
    section("Still in progress", inProgress || null),
    section("Closed (not merged)", closed || null),
    section("Commits", commitLines || null),
    section("Totals", totals),
    section("Code analysis", analysisBody || null),
  ];

  return parts.filter(Boolean).join("\n").trim() + "\n";
}
