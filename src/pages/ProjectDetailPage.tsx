import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  createRecommendation,
  deleteRecommendation,
  fileDownloadUrl,
  inviteMember,
  listProjectFiles,
  listProjectRecommendations,
  listProjectReports,
  loadGithubMonth,
  loadProject,
  removeMember,
  updateProject,
} from "../api";
import { TabPanel, Tabs } from "../components/Tabs";
import { Select } from "../components/ui/Select";
import { colorFor } from "../lib/colors";
import { getSession } from "../lib/session";
import type {
  CloudMemberView,
  CloudProjectDetail,
  CloudRecommendationView,
  CloudReportView,
  CloudFileView,
  GithubMonthActivity,
} from "../../shared/types";

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

type OpenMonth = {
  member: CloudMemberView;
  month: number;
};

export function ProjectDetailPage() {
  const { id = "" } = useParams();
  const session = getSession();
  const now = new Date();
  const [project, setProject] = useState<CloudProjectDetail | null>(null);
  const [reports, setReports] = useState<CloudReportView[]>([]);
  const [recs, setRecs] = useState<CloudRecommendationView[]>([]);
  const [files, setFiles] = useState<CloudFileView[]>([]);
  const [year, setYear] = useState(now.getFullYear());
  const [tab, setTab] = useState("reports");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLogin, setInviteLogin] = useState("");
  const [open, setOpen] = useState<OpenMonth | null>(null);
  const [publicActivity, setPublicActivity] = useState<GithubMonthActivity | null>(null);
  const [recBody, setRecBody] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const isLead = project?.role === "lead";
  const maxMonth = year === now.getFullYear() ? now.getMonth() + 1 : year > now.getFullYear() ? 0 : 12;

  async function refresh() {
    const [nextProject, nextReports, nextRecs, nextFiles] = await Promise.all([
      loadProject(id),
      listProjectReports(id, year),
      listProjectRecommendations(id, { year }),
      listProjectFiles(id).catch(() => [] as CloudFileView[]),
    ]);
    setProject(nextProject);
    setReports(nextReports);
    setRecs(nextRecs);
    setFiles(nextFiles);
    setName(nextProject.name);
    setDescription(nextProject.description);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void refresh()
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load this project.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, year]);

  const members = project?.members ?? [];
  const visibleMembers = useMemo(() => {
    if (!project) return [];
    if (isLead) return members.filter((member) => member.status === "active" || member.status === "invited");
    return members.filter((member) => member.userId === session?.id || member.githubLogin === session?.login);
  }, [project, members, isLead, session?.id, session?.login]);

  const openReport = useMemo(() => {
    if (!open) return null;
    return (
      reports.find(
        (report) =>
          report.year === year &&
          report.month === open.month &&
          (report.authorUserId === open.member.userId ||
            report.authorLogin.toLowerCase() === open.member.githubLogin.toLowerCase()),
      ) ?? null
    );
  }, [open, reports, year]);

  const openRecs = useMemo(() => {
    if (!open) return [];
    const targetId = open.member.userId;
    return recs.filter(
      (rec) =>
        rec.year === year &&
        rec.month === open.month &&
        (rec.targetUserId === targetId || rec.targetLogin.toLowerCase() === open.member.githubLogin.toLowerCase()),
    );
  }, [open, recs, year]);

  function reportFor(member: CloudMemberView, month: number) {
    return reports.find(
      (report) =>
        report.year === year &&
        report.month === month &&
        (report.authorUserId === member.userId ||
          report.authorLogin.toLowerCase() === member.githubLogin.toLowerCase()),
    );
  }

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    const login = inviteLogin.trim().replace(/^@/, "");
    if (!login) return;
    setBusy(true);
    setError(null);
    try {
      await inviteMember(id, login);
      setInviteLogin("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not invite that user.");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(login: string) {
    setBusy(true);
    setError(null);
    try {
      await removeMember(id, login);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that member.");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveMeta(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateProject(id, { name, description });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the project.");
    } finally {
      setBusy(false);
    }
  }

  async function onOpenMonth(member: CloudMemberView, month: number) {
    setOpen({ member, month });
    setPublicActivity(null);
    setRecBody("");
  }

  async function onLoadPublic() {
    if (!open) return;
    setBusy(true);
    setError(null);
    try {
      setPublicActivity(await loadGithubMonth(open.member.githubLogin, year, open.month));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load public GitHub activity.");
    } finally {
      setBusy(false);
    }
  }

  async function onAddRec(event: FormEvent) {
    event.preventDefault();
    if (!open?.member.userId || !recBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createRecommendation(id, {
        targetUserId: open.member.userId,
        year,
        month: open.month,
        body: recBody.trim(),
        reportId: openReport?.id ?? null,
      });
      setRecBody("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the recommendation.");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteRec(recId: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteRecommendation(recId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that note.");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !project) {
    return <p className="hint">Loading project...</p>;
  }

  if (!project) {
    return (
      <>
        <p className="error inline-error">{error || "Project not found."}</p>
        <Link to="/app/projects">Back to projects</Link>
      </>
    );
  }

  return (
    <>
      <header className="workspace-top">
        <div>
          <p className="eyebrow">
            <Link to="/app/projects">Projects</Link>
            {" � "}
            {project.role}
          </p>
          <h1>{project.name}</h1>
          <p className="lede">{project.description || "Monthly reports and lead recommendations for this team."}</p>
        </div>
        <div className="workspace-controls">
          <label className="pill-field">
            Year
            <Select
              aria-label="Year"
              value={String(year)}
              onValueChange={(value) => setYear(Number(value))}
              options={[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((value) => ({
                value: String(value),
                label: String(value),
              }))}
            />
          </label>
        </div>
      </header>

      {error ? <p className="error inline-error">{error}</p> : null}

      <Tabs
        tabs={[
          { id: "reports", label: "Monthly reports", badge: reports.length || undefined },
          { id: "members", label: "Members", badge: members.length || undefined },
          { id: "recommendations", label: "Recommendations", badge: recs.length || undefined },
          { id: "files", label: "Files", badge: files.length || undefined },
        ]}
        active={tab}
        onChange={setTab}
      >
        <TabPanel id="reports" active={tab}>
          {visibleMembers.filter((member) => member.status === "active").length === 0 ? (
            <p className="empty">No active members yet. Invite GitHub usernames from the Members tab.</p>
          ) : (
            visibleMembers
              .filter((member) => member.status === "active")
              .map((member) => (
                <section key={member.id} className="member-month-block">
                  <div className="member-heading">
                    <span className="account-dot" style={{ background: colorFor(member.githubLogin) }} />
                    <strong>@{member.githubLogin}</strong>
                    <small>{member.role}</small>
                  </div>
                  <div className="month-grid compact-month-grid">
                    {MONTHS.map((label, index) => {
                      const month = index + 1;
                      const submitted = reportFor(member, month);
                      return (
                        <button
                          key={label}
                          type="button"
                          className={submitted ? "month-cell submitted" : "month-cell"}
                          disabled={month > maxMonth}
                          onClick={() => void onOpenMonth(member, month)}
                        >
                          <span className="month-cell-name">{label.slice(0, 3)}</span>
                          <span className="month-cell-arrow">{submitted ? "in" : "?"}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
          )}
        </TabPanel>

        <TabPanel id="members" active={tab}>
          {isLead ? (
            <form className="project-create" onSubmit={(event) => void onInvite(event)}>
              <label className="pill-field">
                GitHub username
                <input
                  value={inviteLogin}
                  onChange={(e) => setInviteLogin(e.target.value)}
                  placeholder="octocat"
                  disabled={busy}
                />
              </label>
              <button type="submit" className="btn-primary" disabled={busy || !inviteLogin.trim()}>
                Invite
              </button>
            </form>
          ) : null}

          <ul className="member-list">
            {members.map((member) => (
              <li key={member.id} className="member-row">
                <div>
                  <strong>@{member.githubLogin}</strong>
                  <small>
                    {member.role} � {member.status}
                    {member.name ? ` � ${member.name}` : ""}
                  </small>
                </div>
                {isLead && member.role !== "lead" ? (
                  <button type="button" className="ghost" disabled={busy} onClick={() => void onRemove(member.githubLogin)}>
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>

          {isLead ? (
            <form className="project-create" onSubmit={(event) => void onSaveMeta(event)}>
              <label className="pill-field">
                Project name
                <input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
              </label>
              <label className="pill-field">
                Description
                <input value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} />
              </label>
              <button type="submit" className="ghost" disabled={busy || !name.trim()}>
                Save details
              </button>
            </form>
          ) : null}
        </TabPanel>

        <TabPanel id="recommendations" active={tab}>
          {recs.length === 0 ? (
            <p className="empty">No recommendations for {year} yet.</p>
          ) : (
            <ul className="rec-list">
              {recs.map((rec) => (
                <li key={rec.id} className="rec-item">
                  <header>
                    <strong>
                      @{rec.authorLogin} ? @{rec.targetLogin}
                    </strong>
                    <small>
                      {MONTHS[rec.month - 1]} {rec.year}
                    </small>
                  </header>
                  <p>{rec.body}</p>
                  {isLead || rec.authorLogin === session?.login ? (
                    <button type="button" className="ghost" disabled={busy} onClick={() => void onDeleteRec(rec.id)}>
                      Delete
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </TabPanel>

        <TabPanel id="files" active={tab}>
          {files.length === 0 ? (
            <p className="empty">No files yet. Saving or submitting a report from the desktop app uploads it here.</p>
          ) : (
            <ul className="rec-list">
              {files.map((file) => (
                <li key={file.id} className="rec-item">
                  <header>
                    <strong>{file.name}</strong>
                    <small>
                      @{file.authorLogin} · {new Date(file.createdAt).toLocaleString()} ·{" "}
                      {Math.max(1, Math.round(file.sizeBytes / 1024))} KB
                    </small>
                  </header>
                  <button
                    type="button"
                    className="ghost"
                    disabled={busy}
                    onClick={() => {
                      void fileDownloadUrl(file.id)
                        .then((next) => window.open(next.url, "_blank", "noopener,noreferrer"))
                        .catch((err: unknown) => {
                          setError(err instanceof Error ? err.message : "Could not open that file.");
                        });
                    }}
                  >
                    Download
                  </button>
                </li>
              ))}
            </ul>
          )}
        </TabPanel>
      </Tabs>

      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(null)} role="presentation">
          <div className="modal modal-report" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <header className="modal-head">
              <div>
                <p className="eyebrow">
                  @{open.member.githubLogin} � {openReport ? "Submitted" : "No submission yet"}
                </p>
                <h2>
                  {MONTHS[open.month - 1]} {year}
                </h2>
              </div>
              <button type="button" className="modal-close" onClick={() => setOpen(null)} aria-label="Close">
                �
              </button>
            </header>

            {openReport ? (
              <>
                <div className="dashboard-kpi-grid metrics-row">
                  <div className="kpi-card">
                    <strong>{openReport.stats.prsMerged}</strong>
                    <span>Merged</span>
                  </div>
                  <div className="kpi-card">
                    <strong>{openReport.stats.commits}</strong>
                    <span>Commits</span>
                  </div>
                  <div className="kpi-card">
                    <strong>{openReport.stats.repos}</strong>
                    <span>Repos</span>
                  </div>
                </div>
                <pre className="report-markdown">{openReport.markdown}</pre>
                {openReport.mergedPrs.length > 0 ? (
                  <ol className="work-list">
                    {openReport.mergedPrs.map((pr) => (
                      <li key={pr.url}>
                        <a href={pr.url} target="_blank" rel="noreferrer">
                          {pr.title}
                        </a>
                        <small>{pr.repo}</small>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </>
            ) : (
              <div className="empty-report">
                <p className="empty">This member has not submitted a desktop report for this month.</p>
                {isLead ? (
                  <button type="button" className="ghost" disabled={busy} onClick={() => void onLoadPublic()}>
                    Load public GitHub activity
                  </button>
                ) : null}
                {publicActivity ? (
                  <ul className="activity-list">
                    {publicActivity.items.slice(0, 40).map((item) => (
                      <li key={item.id}>
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noreferrer">
                            {item.title}
                          </a>
                        ) : (
                          item.title
                        )}
                        <small>{item.repo}</small>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}

            <section className="rec-thread">
              <h3>Lead notes</h3>
              {openRecs.length === 0 ? <p className="hint">No recommendations for this month yet.</p> : null}
              <ul className="rec-list">
                {openRecs.map((rec) => (
                  <li key={rec.id} className="rec-item">
                    <header>
                      <strong>@{rec.authorLogin}</strong>
                      <small>{new Date(rec.createdAt).toLocaleString()}</small>
                    </header>
                    <p>{rec.body}</p>
                  </li>
                ))}
              </ul>
              {isLead && open.member.userId ? (
                <form className="rec-composer" onSubmit={(event) => void onAddRec(event)}>
                  <textarea
                    value={recBody}
                    onChange={(e) => setRecBody(e.target.value)}
                    placeholder="Recommendation for this month..."
                    rows={4}
                    disabled={busy}
                  />
                  <button type="submit" className="btn-primary" disabled={busy || !recBody.trim()}>
                    Add recommendation
                  </button>
                </form>
              ) : isLead && !open.member.userId ? (
                <p className="hint">They need to sign in and accept the invite before you can leave notes.</p>
              ) : null}
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
