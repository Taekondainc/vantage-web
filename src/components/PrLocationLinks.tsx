import type { PrReportItem } from "../../shared/types";

function repoUrl(repo: string) {
  return `https://github.com/${repo}`;
}

function branchUrl(repo: string, branch: string) {
  return `https://github.com/${repo}/tree/${encodeURIComponent(branch)}`;
}

function openExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

type PrTableItem = { pr: PrReportItem } | { label: string };

/**
 * Renders a compact table of PR locations (repo, PR number, branch → target).
 * Accepts a mix of resolved PRs and plain fallback labels, since callers
 * (e.g. recommendations) sometimes can't match a related-PR label to a PR.
 */
export function PrLocationTable({
  items,
  showTargetBranch = true,
}: {
  items: PrTableItem[];
  showTargetBranch?: boolean;
}) {
  if (items.length === 0) return null;

  const prs = items.flatMap((item) => ("pr" in item ? [item.pr] : []));
  const hasTargets = showTargetBranch && prs.some((pr) => pr.baseBranch !== pr.headBranch);

  return (
    <table className="pr-location-table">
      <thead>
        <tr>
          <th>Repo</th>
          <th>PR</th>
          <th>Branch</th>
          {hasTargets ? <th>Target</th> : null}
        </tr>
      </thead>
      <tbody>
        {items.map((item, index) =>
          "pr" in item ? (
            <tr key={item.pr.url}>
              <td>
                <button type="button" className="inline-link" onClick={() => openExternal(repoUrl(item.pr.repo))}>
                  {item.pr.repo}
                </button>
              </td>
              <td>
                <button type="button" className="inline-link" onClick={() => openExternal(item.pr.url)}>
                  #{item.pr.number}
                </button>
              </td>
              <td className="pr-location-branch-cell">
                <button
                  type="button"
                  className="inline-link"
                  onClick={() => openExternal(branchUrl(item.pr.repo, item.pr.headBranch))}
                >
                  {item.pr.headBranch}
                </button>
              </td>
              {hasTargets ? (
                <td className="pr-location-branch-cell">
                  {item.pr.baseBranch !== item.pr.headBranch ? (
                    <button
                      type="button"
                      className="inline-link"
                      onClick={() => openExternal(branchUrl(item.pr.repo, item.pr.baseBranch))}
                    >
                      {item.pr.baseBranch}
                    </button>
                  ) : (
                    <span className="pr-location-fallback">—</span>
                  )}
                </td>
              ) : null}
            </tr>
          ) : (
            <tr key={`label-${index}`}>
              <td className="pr-location-fallback" colSpan={hasTargets ? 4 : 3}>
                {item.label}
              </td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}
