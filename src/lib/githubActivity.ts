import type { GithubMonthActivity, GithubProfileActivity } from "../../shared/types";

export function activityForMonth(
  profile: GithubProfileActivity,
  year: number,
  month: number,
): GithubMonthActivity {
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const end = new Date(Date.UTC(year, month, 1)).toISOString();
  const items = profile.items.filter((item) => item.createdAt >= start && item.createdAt < end);
  const repos = new Set(items.map((item) => item.repo));
  return {
    username: profile.username,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    year,
    month,
    stats: {
      commits: items.filter((item) => item.type === "push").length,
      pushes: items.filter((item) => item.type === "push").length,
      prsOpened: items.filter((item) => item.type === "pr" && item.title.startsWith("opened")).length,
      prsMerged: items.filter((item) => item.type === "pr-merged").length,
      repos: repos.size,
    },
    items,
    truncated: profile.truncated,
  };
}

export function monthNarrative(report: GithubMonthActivity): string {
  const month = new Date(report.year, report.month - 1, 1).toLocaleString(undefined, { month: "long" });
  if (report.items.length === 0) {
    return `No public GitHub events for @${report.username} in ${month} ${report.year}. GitHub only keeps a short window of public events, and private work never appears here.`;
  }
  return `In ${month} ${report.year}, @${report.username} had ${report.stats.pushes} public push${report.stats.pushes === 1 ? "" : "es"}, ${report.stats.prsOpened} PR${report.stats.prsOpened === 1 ? "" : "s"} opened, and ${report.stats.prsMerged} merged, across ${report.stats.repos} ${report.stats.repos === 1 ? "repo" : "repos"}.`;
}

export function reportMarkdown(report: GithubMonthActivity): string {
  const month = new Date(report.year, report.month - 1, 1).toLocaleString(undefined, { month: "long" });
  const lines = [
    `# ${month} ${report.year}  -  @${report.username}`,
    "",
    monthNarrative(report),
    "",
    `Pushes: ${report.stats.pushes}`,
    `PRs opened: ${report.stats.prsOpened}`,
    `PRs merged: ${report.stats.prsMerged}`,
    `Repos: ${report.stats.repos}`,
    "",
    ...report.items.map((item) => `- ${item.repo}  -  ${item.title}`),
    "",
  ];
  return lines.join("\n");
}
