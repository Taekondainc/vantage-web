import type { PrReportItem, PushCommit, PushGroup } from "../../shared/types";

export type FlatCommit = PushCommit & { repo: string };

/** Timestamp used to place a PR on a timeline: when it merged, or was opened. */
export function prStamp(pr: PrReportItem) {
  return pr.mergedAt ?? pr.createdAt;
}

/** Oldest-to-newest, with PR number as a stable tiebreaker for same-day items. */
export function sortPrs(items: PrReportItem[]): PrReportItem[] {
  return [...items].sort((a, b) => {
    const byDate = prStamp(a).localeCompare(prStamp(b));
    return byDate !== 0 ? byDate : a.number - b.number;
  });
}

/** Oldest-to-newest, with repo name as a stable tiebreaker for same-day pushes. */
export function sortPushes(items: PushGroup[]): PushGroup[] {
  return [...items].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    return byDate !== 0 ? byDate : a.repo.localeCompare(b.repo);
  });
}

/** One row per commit instead of repo+date push groups. */
export function flattenCommits(pushes: PushGroup[]): FlatCommit[] {
  return pushes
    .flatMap((group) => group.commits.map((commit) => ({ ...commit, repo: group.repo })))
    .sort((a, b) => a.date.localeCompare(b.date) || a.repo.localeCompare(b.repo));
}

export function formatLines(additions: number, deletions: number) {
  const add = additions >= 1000 ? `${(additions / 1000).toFixed(1)}k` : String(additions);
  const del = deletions >= 1000 ? `${(deletions / 1000).toFixed(1)}k` : String(deletions);
  return `+${add} / −${del}`;
}

export function formatDay(iso: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...options,
  });
}
