export type MetricDef = {
  label: string;
  description: string;
  source: string;
  unit: string;
};

export type ChartDef = {
  title: string;
  description: string;
  source: string;
  unit: string;
};

export const METRICS = {
  prsMerged: {
    label: "PRs merged",
    description: "Pull requests merged into the default branch during this period.",
    source: "GitHub API — search merged PRs by author",
    unit: "pull requests",
  },
  commits: {
    label: "Commits",
    description: "Commits pushed to tracked repositories (from push events, not squash-only merges).",
    source: "GitHub API — repository push events",
    unit: "commits",
  },
  repos: {
    label: "Repositories",
    description: "Distinct repositories with merged PRs or commits in this selection.",
    source: "GitHub API — activity grouped by repository",
    unit: "repositories",
  },
  linesChanged: {
    label: "Lines changed",
    description: "Total additions and deletions across merged pull requests in this selection.",
    source: "GitHub API — PR diff stats on merged PRs",
    unit: "lines (+ additions, − deletions)",
  },
  prsOpen: {
    label: "PRs in flight",
    description: "Open pull requests still awaiting review or merge.",
    source: "GitHub API — open PRs by author",
    unit: "pull requests",
  },
  prsClosed: {
    label: "Closed unmerged",
    description: "Pull requests closed without being merged.",
    source: "GitHub API — closed PRs by author",
    unit: "pull requests",
  },
} satisfies Record<string, MetricDef>;

export const CHARTS = {
  activityMix: {
    title: "Activity mix",
    description:
      "How work split across merged PRs, open PRs, closed-without-merge PRs, and direct commits. Compare volume types at a glance.",
    source: "GitHub API — PR states and push events",
    unit: "count per activity type",
  },
  prsByRepo: {
    title: "PRs merged by repository",
    description:
      "Repositories that received merged pull requests. Taller bars mean more merged PRs. Click a bar to open the repo on GitHub.",
    source: "GitHub API — merged PRs grouped by repository",
    unit: "merged pull requests",
  },
  linesByRepo: {
    title: "Lines changed by repository",
    description:
      "Total additions + deletions on merged PRs per repository. Reflects code churn, not net growth. Click a bar to open the repo.",
    source: "GitHub API — PR diff stats on merged PRs",
    unit: "lines changed",
  },
  errorCategories: {
    title: "Issue categories",
    description:
      "Fixes merged, reverts, closed-unmerged work, open fix PRs, and PRs flagged by review heuristics.",
    source: "GitHub API + Vantage PR heuristics",
    unit: "count per category",
  },
  errorRisks: {
    title: "Risk signals",
    description:
      "Heuristic risks from PR size, descriptions, staleness, and reverts. Bar height = number of related PRs.",
    source: "Vantage code analysis (src/lib/analysis.ts)",
    unit: "related pull requests",
  },
} satisfies Record<string, ChartDef>;
