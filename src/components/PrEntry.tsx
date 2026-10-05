import type { PrReportItem } from "../../shared/types";
import { plainText } from "../../shared/stripHtml";
import { formatLines, prStamp, formatDay } from "../lib/reportSort";

/** Full PR card — title, meta (branch/lines/files), heuristic what/why
 * description, and any heuristic advice. Ported from vantagedestkop's
 * ReportEntries.tsx PrEntry so PR descriptions are as in-depth on the web
 * app as on desktop, instead of a bare title link. */
export function PrEntry({ pr }: { pr: PrReportItem }) {
  return (
    <article className="entry-card pr-card">
      <header className="entry-card-head">
        <a href={pr.url} target="_blank" rel="noreferrer">
          #{pr.number} · {plainText(pr.title)}
        </a>
        <span>{formatDay(prStamp(pr))}</span>
      </header>
      <div className="entry-card-meta">
        <span className="task-branch">{pr.baseBranch}</span>
        <span>{formatLines(pr.additions, pr.deletions)}</span>
        <span>
          {pr.changedFiles} file{pr.changedFiles === 1 ? "" : "s"}
        </span>
      </div>
      <p className="line">{plainText(pr.line1)}</p>
      <p className="line muted">{plainText(pr.line2)}</p>
      {pr.advice ? <p className="line pr-advice">💡 {plainText(pr.advice)}</p> : null}
    </article>
  );
}
