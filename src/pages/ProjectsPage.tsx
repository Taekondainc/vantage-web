import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { acceptInvite, createProject, listProjects, loadMe } from "../api";
import { colorFor } from "../lib/colors";
import { getSession } from "../lib/session";
import type { CloudInvite, CloudProjectSummary } from "../../shared/types";

export function ProjectsPage() {
  const session = getSession();
  const [projects, setProjects] = useState<CloudProjectSummary[]>([]);
  const [invites, setInvites] = useState<CloudInvite[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [nextProjects, me] = await Promise.all([listProjects(), loadMe()]);
    setProjects(nextProjects);
    setInvites(me.invites);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void refresh()
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load projects.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const leading = useMemo(() => projects.filter((project) => project.role === "lead"), [projects]);
  const memberOf = useMemo(() => projects.filter((project) => project.role !== "lead"), [projects]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const title = name.trim();
    if (!title) return;
    setBusy(true);
    setError(null);
    try {
      await createProject(title, description.trim());
      setName("");
      setDescription("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the project.");
    } finally {
      setBusy(false);
    }
  }

  async function onAccept(id: string) {
    setBusy(true);
    setError(null);
    try {
      await acceptInvite(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept the invite.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="workspace-top">
        <div>
          <p className="eyebrow">
            <span className="account-dot" style={{ background: colorFor(session?.login || "guest") }} aria-hidden="true" />
            @{session?.login || "guest"}
          </p>
          <h1>Projects</h1>
          <p className="lede">Review monthly reports, invite the team, and leave recommendations.</p>
        </div>
      </header>

      {error ? <p className="error inline-error">{error}</p> : null}

      {invites.length > 0 ? (
        <section className="card-panel tasks-card invite-banner">
          <h2>Pending invites</h2>
          <ul className="invite-list">
            {invites.map((invite) => (
              <li key={invite.id}>
                <div>
                  <strong>{invite.projectName}</strong>
                  <small>Invited as {invite.role}</small>
                </div>
                <button type="button" className="btn-primary" disabled={busy} onClick={() => void onAccept(invite.id)}>
                  Accept
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card-panel tasks-card">
        <h2>New project</h2>
        <p className="hint">You become the project lead. Invite GitHub usernames after you create it.</p>
        <form className="project-create" onSubmit={(event) => void onCreate(event)}>
          <label className="pill-field">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Platform team" disabled={busy} />
          </label>
          <label className="pill-field">
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Monthly review for this squad"
              disabled={busy}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={busy || !name.trim()}>
            {busy ? "Saving..." : "Create project"}
          </button>
        </form>
      </section>

      {loading ? <p className="hint">Loading projects...</p> : null}

      <ProjectGroup title="You lead" projects={leading} empty="Create a project to review reports as lead." />
      <ProjectGroup title="Member of" projects={memberOf} empty="Accept an invite to join a project." />
    </>
  );
}

function ProjectGroup({
  title,
  projects,
  empty,
}: {
  title: string;
  projects: CloudProjectSummary[];
  empty: string;
}) {
  return (
    <section className="card-panel tasks-card">
      <h2>{title}</h2>
      {projects.length === 0 ? (
        <p className="empty">{empty}</p>
      ) : (
        <ul className="project-grid">
          {projects.map((project) => (
            <li key={project.id}>
              <Link to={`/app/projects/${project.id}`} className="project-card">
                <strong>{project.name}</strong>
                <small>
                  {project.role} � {project.memberCount} {project.memberCount === 1 ? "member" : "members"}
                </small>
                {project.description ? <p>{project.description}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
