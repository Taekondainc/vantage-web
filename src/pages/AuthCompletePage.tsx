import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { loadMe } from "../api";
import { setSession } from "../lib/session";
import { writeJson } from "../lib/storage";

export function AuthCompletePage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const next = params.get("next") || "/app";
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Missing sign-in token.");
      return;
    }
    setSession({
      id: "",
      login: "",
      token,
      signedInAt: new Date().toISOString(),
      auth: "oauth",
    });
    void loadMe()
      .then((me) => {
        setSession({
          id: me.user.id,
          login: me.user.login,
          name: me.user.name,
          avatarUrl: me.user.avatarUrl,
          token,
          signedInAt: new Date().toISOString(),
          auth: "oauth",
        });
        writeJson("github-user", me.user.login);
        setReady(true);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not finish sign-in.");
      });
  }, [token]);

  if (error) {
    return <Navigate to={`/app/sign-in?error=${encodeURIComponent(error)}`} replace />;
  }

  if (!ready) {
    return <div className="grid min-h-screen place-items-center bg-canvas font-mono text-sm text-muted">Signing in...</div>;
  }

  return <Navigate to={next.startsWith("/app") ? next : "/app"} replace />;
}
