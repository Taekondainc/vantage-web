import { useState } from "react";
import type { CodeAnalysis, CodeRecommendation, PrReportItem } from "../../shared/types";
import { findPrByLabel } from "../lib/prLookup";
import { PrLocationTable } from "./PrLocationLinks";
import { createGithubBranch, createTask } from "../api";

const SEVERITY_LABEL: Record<string, string> = {
  info: "Info",
  suggestion: "Suggestion",
  important: "Important",
};

function todayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Turn text into a short branch-name slug, e.g. "Code review action items" ->
 * "code-review-action-items". */
function slugify(text: string, max = 50) {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return slug || "task";
}

/** One task covering every recommendation, listed as its own checklist line
 * — not one row per recommendation. */
function buildChecklistDescription(recommendations: CodeRecommendation[]) {
  return recommendations
    .map((rec) => `- [ ] (${SEVERITY_LABEL[rec.severity] ?? rec.severity}) ${rec.title}: ${rec.detail}`)
    .join("\n");
}

type TaskCreationState = "idle" | "working" | "done" | "error";

/**
 * Renders a code review — the heuristic (non-AI) one from src/lib/analysis.ts.
 * Ported from the desktop app's CodeAnalysisPanel.tsx (the AI-review variant
 * there is a follow-up phase for the web app).
 */
export function CodeAnalysisPanel({
  analysis,
  embedded,
  prs = [],
  source = "heuristic",
}: {
  analysis: CodeAnalysis;
  embedded?: boolean;
  prs?: PrReportItem[];
  source?: "heuristic" | "ai";
}) {
  const [taskState, setTaskState] = useState<TaskCreationState>("idle");
  const [taskMessage, setTaskMessage] = useState("");

  const recommendations = analysis.recommendations;
  const repoPr = recommendations
    .flatMap((rec) => rec.relatedPrs)
    .map((label) => findPrByLabel(prs, label))
    .find((pr): pr is PrReportItem => Boolean(pr));

  async function createTaskFromRecommendations() {
    if (!repoPr) {
      setTaskState("error");
      setTaskMessage("No repo linked to any recommendation to branch from.");
      return;
    }

    setTaskState("working");
    setTaskMessage("");
    try {
      const branchName = `${slugify("code review action items")}-${todayDate()}`;
      const branchResult = await createGithubBranch(repoPr.repo, branchName);
      await createTask({
        title: `Code review action items (${recommendations.length})`,
        description: buildChecklistDescription(recommendations),
        branchName,
        repo: repoPr.repo,
        source: "local",
        createdAt: todayDate(),
      });
      setTaskState("done");
      setTaskMessage(
        branchResult.created
          ? `Task created on ${repoPr.repo} (new branch ${branchResult.branch}).`
          : `Task created on ${repoPr.repo} (${branchResult.branch} already existed).`,
      );
    } catch (err) {
      setTaskState("error");
      setTaskMessage(err instanceof Error ? err.message : "Could not create the task.");
    }
  }

  const hasDetail =
    analysis.strengths.length > 0 || analysis.risks.length > 0 || analysis.recommendations.length > 0;

  const content = (
    <>
      <p className="narrative prose">{analysis.summary}</p>
      <p className="chart-description">
        {source === "ai"
          ? "AI review of the actual PR diffs — grounded in what changed in the code, not just PR stats. Verify before acting on it."
          : "Heuristic review (not AI). Strengths, risks, and recommendations are computed from PR size, descriptions, staleness, and reverts."}{" "}
        Related items link to the repo and branch on GitHub.
      </p>

      {hasDetail ? (
        <div className="analysis-grid">
          {analysis.strengths.length > 0 ? (
            <div className="analysis-group analysis-strengths">
              <h4>Strengths</h4>
              <ul>
                {analysis.strengths.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {analysis.risks.length > 0 ? (
            <div className="analysis-group analysis-risks">
              <h4>Risks</h4>
              <ul>
                {analysis.risks.map((risk, index) => (
                  <li key={index}>
                    <p>{risk.message}</p>
                    {risk.prs.length > 0 ? (
                      <PrLocationTable items={risk.prs.slice(0, 4).map((pr) => ({ pr }))} />
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {recommendations.length > 0 ? (
        <div className="analysis-group analysis-recommendations">
          <div className="recommendations-head">
            <h4>Recommendations</h4>
            <div className="recommendation-actions">
              <button
                type="button"
                className="ghost"
                disabled={!repoPr || taskState === "working"}
                title={repoPr ? undefined : "No repo linked to any recommendation"}
                onClick={() => void createTaskFromRecommendations()}
              >
                {taskState === "working"
                  ? "Creating…"
                  : taskState === "done"
                    ? "Task created ✓"
                    : `Create task (${recommendations.length})`}
              </button>
              {taskMessage ? (
                <small className={taskState === "error" ? "recommendation-task-error" : "hint"}>{taskMessage}</small>
              ) : null}
            </div>
          </div>
          <ul className="recommendation-list">
            {recommendations.map((rec, index) => (
              <li key={index} className={`recommendation severity-${rec.severity}`}>
                <div className="recommendation-head">
                  <strong>{rec.title}</strong>
                  <span className={`severity-badge severity-${rec.severity}`}>
                    {SEVERITY_LABEL[rec.severity] ?? rec.severity}
                  </span>
                </div>
                <p>{rec.detail}</p>
                {rec.relatedPrs.length > 0 ? (
                  <PrLocationTable
                    items={rec.relatedPrs.map((label) => {
                      const pr = findPrByLabel(prs, label);
                      return pr ? { pr } : { label };
                    })}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );

  if (embedded) return content;

  return (
    <section className="panel card-panel">
      <h3>Code analysis</h3>
      {content}
    </section>
  );
}
