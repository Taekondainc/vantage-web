import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import type { CSSProperties } from "react";
import { loadMe, logoutCloud } from "../api";
import { colorFor } from "../lib/colors";
import { clearSession, getSession, setSession } from "../lib/session";
import { writeJson } from "../lib/storage";

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setLocalSession] = useState(() => getSession());
  const [checking, setChecking] = useState(Boolean(session));

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void loadMe()
      .then((me) => {
        if (cancelled) return;
        const next = {
          id: me.user.id,
          login: me.user.login,
          name: me.user.name,
          avatarUrl: me.user.avatarUrl,
          token: session.token,
          signedInAt: session.signedInAt,
          auth: "oauth" as const,
        };
        setSession(next);
        setLocalSession(next);
        writeJson("github-user", me.user.login);
      })
      .catch(() => {
        if (cancelled) return;
        clearSession();
        setLocalSession(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  if (checking) {
    return <div className="grid min-h-screen place-items-center bg-canvas font-mono text-sm text-muted">Loading...</div>;
  }

  if (!session) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/app/sign-in?next=${next}`} replace />;
  }

  const username = session.login;

  function signOut() {
    void logoutCloud().catch(() => undefined);
    clearSession();
    writeJson("github-user", "");
    navigate("/app/sign-in", { replace: true });
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img className="brand-mark brand-mark-sm" src="/icon.png" alt="" />
          <div>
            <p className="eyebrow">Vantage</p>
            <strong>Reports</strong>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main">
          <NavLink to="/app" end className={({ isActive }) => (isActive ? "nav-pill active" : "nav-pill")}>
            Reports
          </NavLink>
          <NavLink to="/app/tasks" className={({ isActive }) => (isActive ? "nav-pill active" : "nav-pill")}>
            Tasks
          </NavLink>
          <NavLink to="/app/projects" className={({ isActive }) => (isActive ? "nav-pill active" : "nav-pill")}>
            Projects
          </NavLink>
          <NavLink to="/app/billing" className={({ isActive }) => (isActive ? "nav-pill active" : "nav-pill")}>
            Billing
          </NavLink>
        </nav>

        <p className="sidebar-label">Accounts</p>
        <div className="account-list">
          <div className="account-item active" style={{ "--accent": colorFor(username) } as CSSProperties}>
            {session.avatarUrl ? (
              <img className="account-avatar" src={session.avatarUrl} alt="" />
            ) : (
              <span className="account-avatar fallback">{username.slice(0, 1).toUpperCase()}</span>
            )}
            <span>
              <strong>{username}</strong>
              <small>Signed in with GitHub</small>
            </span>
          </div>
        </div>

        <div className="sidebar-actions">
          <button type="button" className="ghost sidebar-btn" onClick={signOut}>
            Sign out
          </button>
          <NavLink to="/" className="ghost sidebar-btn">
            Public site
          </NavLink>
        </div>

        <div className="sidebar-footer">
          <a className="ghost" href="https://github.com/Taekondainc/vantage-releases">
            Get desktop
          </a>
        </div>
      </aside>
      <main className="workspace">
        <Outlet />
      </main>
    </div>
  );
}
