import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { checkHealth, pollGithubDeviceFlow, startGithubDeviceFlow } from "../api";
import { Button } from "../components/ui/Button";
import { getSession, setSession } from "../lib/session";
import { writeJson } from "../lib/storage";
import { SITE } from "../content/site";

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.269 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.295 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export function SignInPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/app";
  const existing = getSession();
  const queryError = params.get("error");

  const [oauth, setOauth] = useState<boolean | null>(null);
  const [oauthMode, setOauthMode] = useState<"redirect" | "device" | null>(null);
  const [error, setError] = useState<string | null>(queryError);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<{
    id: string;
    userCode: string;
    verificationUri: string;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStarted = useRef(false);
  const startGithub = params.get("start") === "github";

  useEffect(() => {
    void checkHealth().then((health) => {
      setOauth(health.oauth);
      setOauthMode(health.oauthMode);
      if (!health.ok) setError("Could not reach the Vantage API.");
    });
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const destination = next.startsWith("/app") ? next : "/app";
  const startUrl = `/api/auth/github?next=${encodeURIComponent(destination)}`;

  function finishSession(token: string, user: { id: string; login: string; name: string | null; avatarUrl: string | null }) {
    setSession({
      id: user.id,
      login: user.login,
      name: user.name,
      avatarUrl: user.avatarUrl,
      token,
      signedInAt: new Date().toISOString(),
      auth: "oauth",
    });
    writeJson("github-user", user.login);
    navigate(destination, { replace: true });
  }

  async function poll(id: string, intervalSec: number) {
    const result = await pollGithubDeviceFlow(id);
    if (result.status === "ok") {
      finishSession(result.token, result.user);
      return;
    }
    if (result.status === "error") {
      setPrompt(null);
      setBusy(false);
      setError(result.error);
      return;
    }
    const wait = result.status === "slow_down" ? result.interval : intervalSec;
    pollRef.current = setTimeout(() => {
      void poll(id, wait);
    }, Math.max(wait, 5) * 1000);
  }

  async function startDevice(openWindow = true) {
    setBusy(true);
    setError(null);
    try {
      const started = await startGithubDeviceFlow(destination);
      setPrompt({
        id: started.id,
        userCode: started.userCode,
        verificationUri: started.verificationUri,
      });
      if (openWindow) {
        window.open(started.verificationUri, "_blank", "noopener,noreferrer");
      }
      void poll(started.id, started.interval);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Could not start GitHub sign-in.");
    }
  }

  useEffect(() => {
    if (!startGithub || autoStarted.current || oauth !== true || oauthMode === "redirect" || prompt) return;
    autoStarted.current = true;
    void startDevice(false);
  }, [startGithub, oauth, oauthMode, prompt]);

  function cancelDevice() {
    if (pollRef.current) clearTimeout(pollRef.current);
    setPrompt(null);
    setBusy(false);
  }

  if (existing) {
    return <Navigate to={next.startsWith("/app") ? next : "/app"} replace />;
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-canvas text-fg">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 20% -10%, color-mix(in srgb, var(--color-accent) 22%, transparent), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 10%, color-mix(in srgb, var(--color-accent) 12%, transparent), transparent 50%)",
        }}
      />
      <header className="relative z-10 flex items-center justify-between px-5 py-5 md:px-8">
        <Link to="/" className="font-display text-lg font-extrabold tracking-tight text-fg">
          {SITE.product}
        </Link>
        <Link to="/pricing" className="text-sm text-muted hover:text-fg">
          Pricing
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 pb-12 pt-4">
        <div className="w-full max-w-md rounded-[1.5rem] border border-border bg-surface/90 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm md:p-8">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white">
            <GitHubMark className="h-5 w-5" />
          </div>
          <h1 className="font-display text-[1.75rem] font-extrabold tracking-tight text-fg md:text-[2rem]">
            Sign in to Vantage
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Continue with GitHub to open reports, tasks, and project-lead review.
          </p>

          {error ? (
            <p className="mt-4 rounded-xl border border-risk/30 bg-risk/10 px-3 py-2 text-sm text-risk" role="alert">
              {error}
            </p>
          ) : null}

          {oauth === null ? (
            <Button size="lg" className="mt-6 w-full gap-2" disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking sign-in...
            </Button>
          ) : null}

          {oauth && oauthMode === "redirect" && !prompt ? (
            <Button asChild size="lg" className="mt-6 w-full gap-2">
              <a href={startUrl}>
                <GitHubMark className="h-4 w-4" />
                Continue with GitHub
              </a>
            </Button>
          ) : null}

          {oauth && oauthMode !== "redirect" && !prompt ? (
            <Button size="lg" className="mt-6 w-full gap-2" disabled={busy} onClick={() => void startDevice()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitHubMark className="h-4 w-4" />}
              Continue with GitHub
            </Button>
          ) : null}

          {prompt ? (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-muted">Enter this code on GitHub, then return here.</p>
              <p className="rounded-2xl border border-border bg-canvas px-4 py-3 text-center font-mono text-2xl tracking-[0.2em] text-fg">
                {prompt.userCode}
              </p>
              <Button asChild size="lg" className="w-full">
                <a href={prompt.verificationUri} target="_blank" rel="noreferrer">
                  Open GitHub
                </a>
              </Button>
              <p className="flex items-center justify-center gap-2 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Waiting for GitHub authorization...
              </p>
              <button type="button" className="w-full text-sm text-muted hover:text-fg" onClick={cancelDevice}>
                Cancel
              </button>
            </div>
          ) : null}

          {oauth === false ? (
            <p className="mt-6 rounded-xl border border-border bg-canvas px-3 py-2 text-sm text-muted">
              GitHub OAuth is not configured. Add <code className="text-fg">GITHUB_OAUTH_CLIENT_ID</code> to{" "}
              <code className="text-fg">.env</code> and restart the API.
            </p>
          ) : null}

          <p className="mt-5 text-center text-xs leading-relaxed text-muted">
            We only use GitHub to confirm who you are. Private repo reports stay in the desktop app.
          </p>
          <p className="mt-3 text-center text-sm text-muted">
            <Link to="/download" className="font-semibold text-accent hover:underline">
              Download desktop
            </Link>
            {" · "}
            <Link to="/" className="hover:text-fg">
              Back to site
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
