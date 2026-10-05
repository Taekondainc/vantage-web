import { FormEvent, useEffect, useMemo, useState } from "react";
import { ShareMenu } from "../components/ShareMenu";
import { TabPanel, Tabs } from "../components/Tabs";
import { Select } from "../components/ui/Select";
import { BarChart } from "../components/charts/BarChart";
import { DonutChart } from "../components/charts/DonutChart";
import { CodeAnalysisPanel } from "../components/CodeAnalysisPanel";
import { PrEntry } from "../components/PrEntry";
import { generateCodeAnalysis, loadGithubProfile, loadMe, loadMonthReport } from "../api";
import type { PlanId } from "../../shared/billing";
import { colorFor } from "../lib/colors";
import { activityForMonth, monthNarrative, reportMarkdown } from "../lib/githubActivity";
import { analyzeReport } from "../lib/analysis";
import { buildMonthNarrative, filterReport } from "../lib/reportNarrative";
import { buildFullReportMarkdown } from "../lib/reportExport";
import { flattenCommits, sortPrs, sortPushes } from "../lib/reportSort";
import { performanceMixChartData, repoLinesChartData, repoPrChartData } from "../lib/reportChartData";
import { CHARTS } from "../lib/metricDefinitions";
import { collectReportPrs } from "../lib/prLookup";
import { getSession } from "../lib/session";
import { readJson, writeJson } from "../lib/storage";
import type { CodeAnalysis, GithubMonthActivity, GithubProfileActivity, MonthReport } from "../../shared/types";

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

/** Full-fidelity report modal body (private repos included) for the signed-in
 * user's own account — mirrors vantagedestkop/src/ReportModal.tsx's structure
 * using the shared analysis/narrative/chart-data functions. */
function FullReportBody({
  report,
  repoFilter,
  plan,
}: {
  report: MonthReport;
  repoFilter: string;
  plan: PlanId | null;
}) {
  const scoped = useMemo(() => filterReport(report, repoFilter), [report, repoFilter]);
  const narrative = useMemo(() => buildMonthNarrative(report, repoFilter), [report, repoFilter]);
  const heuristicAnalysis = useMemo(() => analyzeReport(scoped), [scoped]);
  const mergedPrs = useMemo(() => sortPrs(scoped.mergedPrs), [scoped.mergedPrs]);
  const openPrs = useMemo(() => sortPrs(scoped.openPrs), [scoped.openPrs]);
  const closedPrs = useMemo(() => sortPrs(scoped.closedPrs), [scoped.closedPrs]);
  const pushes = useMemo(() => sortPushes(scoped.pushes), [scoped.pushes]);
  const flatCommits = useMemo(() => flattenCommits(pushes), [pushes]);
  const reportPrs = useMemo(() => collectReportPrs(scoped), [scoped]);
  const allReportPrs = useMemo(() => collectReportPrs(report), [report]);
  const [tab, setTab] = useState("overview");

  // AI code review — generated automatically once per month opened for paid
  // accounts (not per repo-filter change: the server always reviews the
  // month's largest merged PRs regardless of the client-side repo filter)
  // and cached server-side, so re-opening the same month doesn't re-spend AI
  // quota. Free accounts have a limited monthly AI quota, so they trigger it
  // manually instead of burning it on every report open.
  const [aiAnalysis, setAiAnalysis] = useState<CodeAnalysis | null>(null);
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);

  function runAiAnalysis() {
    setAiAnalysisError(null);
    setAiAnalysisLoading(true);
    // force=true: a manual click always means "run it again", even though
    // the result is normally cached server-side once generated.
    void generateCodeAnalysis(report.year, report.month, true)
      .then((result) => setAiAnalysis(result))
      .catch((err) => setAiAnalysisError(err instanceof Error ? err.message : "Could not run the AI code review."))
      .finally(() => setAiAnalysisLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    setAiAnalysis(null);
    setAiAnalysisError(null);
    setAiAnalysisLoading(false);
    if (plan !== "paid" || report.mergedPrs.length === 0) return;
    setAiAnalysisLoading(true);
    void generateCodeAnalysis(report.year, report.month)
      .then((result) => {
        if (!cancelled) setAiAnalysis(result);
      })
      .catch((err) => {
        if (!cancelled) setAiAnalysisError(err instanceof Error ? err.message : "Could not run the AI code review.");
      })
      .finally(() => {
        if (!cancelled) setAiAnalysisLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.year, report.month, plan]);

  const analysis = aiAnalysis ?? heuristicAnalysis;

  const activityMix = useMemo(() => performanceMixChartData(scoped), [scoped]);
  const byRepo = useMemo(() => repoPrChartData(scoped), [scoped]);
  const byLines = useMemo(() => repoLinesChartData(scoped), [scoped]);

  const exportMarkdown = useMemo(
    () => buildFullReportMarkdown(report, repoFilter, narrative, analysis),
    [report, repoFilter, narrative, analysis],
  );

  return (
    <>
      <div className="modal-export-bar">
        <ShareMenu title={`${report.name || report.username} — ${report.year}-${String(report.month).padStart(2, "0")}`} markdown={exportMarkdown} />
      </div>

      <div className="dashboard-kpi-grid metrics-row">
        <div className="kpi-card">
          <strong>{scoped.stats.prsMerged}</strong>
          <span>Merged</span>
        </div>
        <div className="kpi-card">
          <strong>{scoped.stats.prsOpen}</strong>
          <span>Open</span>
        </div>
        <div className="kpi-card">
          <strong>{scoped.stats.commits}</strong>
          <span>Commits</span>
        </div>
        <div className="kpi-card">
          <strong>{scoped.stats.repos}</strong>
          <span>Repos</span>
        </div>
        <div className="kpi-card">
          <strong>
            +{scoped.stats.additions.toLocaleString()} / -{scoped.stats.deletions.toLocaleString()}
          </strong>
          <span>Lines changed</span>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "activity", label: "PRs & work", badge: mergedPrs.length + openPrs.length + closedPrs.length || undefined },
          { id: "commits", label: "Commits", badge: flatCommits.length || undefined },
          { id: "insights", label: "Code analysis" },
        ]}
        active={tab}
        onChange={setTab}
      >
        <TabPanel id="overview" active={tab}>
          <p className="narrative">{narrative}</p>
          <div className="chart-grid">
            <DonutChart data={activityMix} chart={CHARTS.activityMix} emptyLabel="No activity this month" />
            <BarChart data={byRepo} chart={CHARTS.prsByRepo} emptyLabel="No merged PRs to chart by repository" />
            <BarChart data={byLines} chart={CHARTS.linesByRepo} emptyLabel="No line-change data from merged PRs" />
          </div>
        </TabPanel>

        <TabPanel id="activity" active={tab}>
          {mergedPrs.length === 0 && openPrs.length === 0 && closedPrs.length === 0 ? (
            <p className="empty">No pull requests in this selection.</p>
          ) : (
            <>
              {mergedPrs.length > 0 ? (
                <>
                  <h4 className="tasks-tab-title">Merged</h4>
                  <div className="entry-list">
                    {mergedPrs.map((pr) => (
                      <PrEntry key={pr.url} pr={pr} />
                    ))}
                  </div>
                </>
              ) : null}
              {openPrs.length > 0 ? (
                <>
                  <h4 className="tasks-tab-title">Open</h4>
                  <div className="entry-list">
                    {openPrs.map((pr) => (
                      <PrEntry key={pr.url} pr={pr} />
                    ))}
                  </div>
                </>
              ) : null}
              {closedPrs.length > 0 ? (
                <>
                  <h4 className="tasks-tab-title">Closed without merging</h4>
                  <div className="entry-list">
                    {closedPrs.map((pr) => (
                      <PrEntry key={pr.url} pr={pr} />
                    ))}
                  </div>
                </>
              ) : null}
            </>
          )}
        </TabPanel>

        <TabPanel id="commits" active={tab}>
          {flatCommits.length === 0 ? (
            <p className="empty">No commits in this selection.</p>
          ) : (
            <ul className="activity-list">
              {flatCommits.map((commit) => (
                <li key={commit.sha}>
                  <span className="repo-chip" style={{ color: colorFor(commit.repo) }}>
                    {commit.repo}
                  </span>
                  <a href={commit.url} target="_blank" rel="noreferrer">
                    {commit.message}
                  </a>
                  <time dateTime={commit.date}>
                    {new Date(commit.date).toLocaleString(undefined, { month: "short", day: "numeric" })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </TabPanel>

        <TabPanel id="insights" active={tab}>
          {plan !== "paid" && report.mergedPrs.length > 0 ? (
            <div className="panel-head">
              <button type="button" className="btn-primary" disabled={aiAnalysisLoading} onClick={runAiAnalysis}>
                {aiAnalysisLoading ? "Reviewing…" : aiAnalysis ? "Re-run AI review" : "Run AI code review"}
              </button>
            </div>
          ) : null}
          {aiAnalysisLoading ? <p className="hint">Running AI code review on your largest merged PRs...</p> : null}
          {aiAnalysisError ? (
            <p className="hint">AI code review unavailable ({aiAnalysisError}) — showing the heuristic review instead.</p>
          ) : null}
          <CodeAnalysisPanel
            analysis={analysis}
            embedded
            prs={aiAnalysis ? allReportPrs : reportPrs}
            source={aiAnalysis ? "ai" : "heuristic"}
          />
        </TabPanel>
      </Tabs>
    </>
  );
}

export function ReportsPage() {
  const now = new Date();
  const session = getSession();
  const [username, setUsername] = useState(() => session?.login || readJson("github-user", ""));
  const [profile, setProfile] = useState<GithubProfileActivity | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [modalMonth, setModalMonth] = useState<number | null>(null);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoFilter, setRepoFilter] = useState("all");

  // Full authenticated report — only ever for the signed-in user's own account.
  const [fullReport, setFullReport] = useState<MonthReport | null>(null);
  const [fullReportLoading, setFullReportLoading] = useState(false);
  const [fullReportError, setFullReportError] = useState<string | null>(null);

  const isOwnAccount = Boolean(session && username.trim() && session.login.toLowerCase() === username.trim().toLowerCase());

  const [plan, setPlan] = useState<PlanId | null>(null);
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void loadMe()
      .then((me) => {
        if (!cancelled) setPlan(me.billing?.plan ?? "free");
      })
      .catch(() => {
        if (!cancelled) setPlan("free");
      });
    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  const maxMonth = year === now.getFullYear() ? now.getMonth() + 1 : year > now.getFullYear() ? 0 : 12;
  const statsMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;

  const snapshot = useMemo(
    () => (profile ? activityForMonth(profile, year, statsMonth) : null),
    [profile, year, statsMonth],
  );

  const report: GithubMonthActivity | null = useMemo(() => {
    if (!profile || modalMonth === null) return null;
    const full = activityForMonth(profile, year, modalMonth);
    if (repoFilter === "all") return full;
    const items = full.items.filter((item) => item.repo === repoFilter);
    const repos = new Set(items.map((item) => item.repo));
    return {
      ...full,
      items,
      stats: {
        commits: items.filter((item) => item.type === "push").length,
        pushes: items.filter((item) => item.type === "push").length,
        prsOpened: items.filter((item) => item.type === "pr" && item.title.startsWith("opened")).length,
        prsMerged: items.filter((item) => item.type === "pr-merged").length,
        repos: repos.size,
      },
    };
  }, [profile, modalMonth, year, repoFilter]);

  const repos = useMemo(() => {
    if (isOwnAccount) {
      if (!fullReport) return [];
      const names = new Set<string>();
      for (const pr of [...fullReport.mergedPrs, ...fullReport.openPrs, ...fullReport.closedPrs]) names.add(pr.repo);
      for (const group of fullReport.pushes) names.add(group.repo);
      return [...names].sort();
    }
    if (!profile || modalMonth === null) return [];
    return [...new Set(activityForMonth(profile, year, modalMonth).items.map((item) => item.repo))].sort();
  }, [isOwnAccount, fullReport, profile, modalMonth, year]);

  async function lookup(handle = username) {
    const trimmed = handle.replace(/^@/, "").trim();
    if (!trimmed) {
      setError("Enter a GitHub username first.");
      return;
    }
    writeJson("github-user", trimmed);
    setUsername(trimmed);
    setLoading(true);
    setError(null);
    try {
      const next = await loadGithubProfile(trimmed);
      setProfile(next);
    } catch (err) {
      setProfile(null);
      setError(err instanceof Error ? err.message : "Could not load GitHub activity.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (username) void lookup(username);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openMonth(month: number) {
    setTab("overview");
    setRepoFilter("all");
    setModalMonth(month);
    setFullReportError(null);

    if (isOwnAccount) {
      setFullReportLoading(true);
      setFullReport(null);
      try {
        setFullReport(await loadMonthReport(year, month));
      } catch (err) {
        setFullReportError(err instanceof Error ? err.message : "Could not load the report.");
      } finally {
        setFullReportLoading(false);
      }
      return;
    }

    if (!profile) {
      await lookup();
    }
  }

  function onLookup(event: FormEvent) {
    event.preventDefault();
    void lookup();
  }

  const prs = report?.items.filter((item) => item.type === "pr" || item.type === "pr-merged") ?? [];
  const commits = report?.items.filter((item) => item.type === "push") ?? [];

  return (
    <>
      <header className="workspace-top">
        <div>
          <p className="eyebrow">
            <span className="account-dot" style={{ background: colorFor(username || "guest") }} aria-hidden="true" />
            @{username || "guest"}
          </p>
          <h1>Submission reports</h1>
          <p className="lede">Pick a month and export proof of work.</p>
        </div>
        <form className="workspace-controls" onSubmit={onLookup}>
          <label className="pill-field">
            GitHub username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="octocat"
              autoCapitalize="off"
              spellCheck={false}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={loading || !username.trim()}>
            {loading ? "Loading..." : profile ? "Refresh" : "Look up"}
          </button>
        </form>
      </header>

      {error ? <p className="error inline-error">{error}</p> : null}

      <section className="dashboard-stats">
        <div className="dashboard-stats-head">
          <h2>Task analysis</h2>
          <span className="dashboard-period">
            {MONTHS[statsMonth - 1]} {year}
          </span>
        </div>
        <p className="dashboard-stats-lede">
          {isOwnAccount
            ? "Full activity snapshot, private repos included."
            : "Public GitHub snapshot for the selected month. Sign in to see private repos and the full report."}
        </p>
        <div className="dashboard-kpi-grid">
          <div className="kpi-card">
            <strong>{snapshot?.stats.prsMerged ?? " - "}</strong>
            <span>PRs merged</span>
          </div>
          <div className="kpi-card">
            <strong>{snapshot?.stats.pushes ?? " - "}</strong>
            <span>Pushes</span>
          </div>
          <div className="kpi-card">
            <strong>{snapshot?.stats.repos ?? " - "}</strong>
            <span>Repos</span>
          </div>
          <div className="kpi-card">
            <strong>{snapshot?.stats.prsOpened ?? " - "}</strong>
            <span>PRs opened</span>
          </div>
        </div>
      </section>

      <section className="month-picker card-panel">
        <div className="month-year">
          <button type="button" className="icon" aria-label="Previous year" onClick={() => setYear((value) => value - 1)}>
            ‹
          </button>
          <h2>{year}</h2>
          <button
            type="button"
            className="icon"
            aria-label="Next year"
            disabled={year >= now.getFullYear()}
            onClick={() => setYear((value) => Math.min(now.getFullYear(), value + 1))}
          >
            ›
          </button>
        </div>
        <div className="month-grid">
          {MONTHS.map((name, index) => {
            const month = index + 1;
            return (
              <button
                key={name}
                type="button"
                className="month-cell"
                disabled={month > maxMonth || loading}
                onClick={() => void openMonth(month)}
              >
                <span className="month-cell-name">{name}</span>
                <span className="month-cell-arrow" aria-hidden="true">
                  ↗
                </span>
              </button>
            );
          })}
        </div>
        <p className="hint">
          {isOwnAccount
            ? "Open a month for your full report - private repos included - then share or export."
            : "Open a month for public PRs and pushes  -  then share. GitHub only returns a recent public-event window."}
        </p>
      </section>

      {modalMonth !== null && (isOwnAccount || report) ? (
        <div className="modal-backdrop" onClick={() => setModalMonth(null)} role="presentation">
          <div className="modal modal-report" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <header className="modal-head">
              <div>
                <p className="eyebrow">
                  <span className="account-dot" style={{ background: colorFor(username) }} />
                  {username} - {repoFilter === "all" ? "All repos" : repoFilter}
                </p>
                <h2>
                  {MONTHS[modalMonth - 1]} {year}
                </h2>
              </div>
              <button type="button" className="modal-close" onClick={() => setModalMonth(null)} aria-label="Close">
                ×
              </button>
            </header>

            <div className="modal-export-bar">
              {!isOwnAccount && report ? (
                <ShareMenu title={`${MONTHS[modalMonth - 1]} ${year}`} markdown={reportMarkdown(report)} />
              ) : null}
              {repos.length > 0 ? (
                <label className="pill-field">
                  Repository
                  <Select
                    aria-label="Repository"
                    value={repoFilter}
                    onValueChange={setRepoFilter}
                    options={[
                      { value: "all", label: "All repos" },
                      ...repos.map((name) => ({ value: name, label: name })),
                    ]}
                  />
                </label>
              ) : null}
            </div>

            {isOwnAccount ? (
              fullReportLoading ? (
                <p className="hint">Loading your full report...</p>
              ) : fullReportError ? (
                <p className="error inline-error">{fullReportError}</p>
              ) : fullReport ? (
                <FullReportBody report={fullReport} repoFilter={repoFilter} plan={plan} />
              ) : null
            ) : report ? (
              <>
                <div className="dashboard-kpi-grid metrics-row">
                  <div className="kpi-card">
                    <strong>{report.stats.prsMerged}</strong>
                    <span>Merged</span>
                  </div>
                  <div className="kpi-card">
                    <strong>{report.stats.prsOpened}</strong>
                    <span>Opened</span>
                  </div>
                  <div className="kpi-card">
                    <strong>{report.stats.pushes}</strong>
                    <span>Pushes</span>
                  </div>
                  <div className="kpi-card">
                    <strong>{report.stats.repos}</strong>
                    <span>Repos</span>
                  </div>
                </div>

                <Tabs
                  tabs={[
                    { id: "overview", label: "Overview" },
                    { id: "activity", label: "PRs & work", badge: prs.length || undefined },
                    { id: "commits", label: "Commits", badge: commits.length || undefined },
                  ]}
                  active={tab}
                  onChange={setTab}
                >
                  <TabPanel id="overview" active={tab}>
                    <p className="narrative">{monthNarrative(report)}</p>
                    {report.truncated ? (
                      <p className="hint">Public events are truncated to GitHub's recent window.</p>
                    ) : null}
                  </TabPanel>
                  <TabPanel id="activity" active={tab}>
                    {prs.length === 0 ? (
                      <p className="empty">No public pull-request events this month.</p>
                    ) : (
                      <ol className="work-list">
                        {prs.map((item) => (
                          <li key={item.id}>
                            {item.url ? (
                              <a href={item.url} target="_blank" rel="noreferrer">
                                {item.title}
                              </a>
                            ) : (
                              item.title
                            )}
                            <small style={{ color: colorFor(item.repo) }}>{item.repo}</small>
                          </li>
                        ))}
                      </ol>
                    )}
                  </TabPanel>
                  <TabPanel id="commits" active={tab}>
                    {commits.length === 0 ? (
                      <p className="empty">No public pushes this month.</p>
                    ) : (
                      <ul className="activity-list">
                        {commits.map((item) => (
                          <li key={item.id}>
                            <span className="repo-chip" style={{ color: colorFor(item.repo) }}>
                              {item.repo}
                            </span>
                            {item.url ? (
                              <a href={item.url} target="_blank" rel="noreferrer">
                                {item.title}
                              </a>
                            ) : (
                              <span>{item.title}</span>
                            )}
                            <time dateTime={item.createdAt}>
                              {new Date(item.createdAt).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </time>
                          </li>
                        ))}
                      </ul>
                    )}
                  </TabPanel>
                </Tabs>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
