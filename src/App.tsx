import { useEffect, useState } from "react";
import { generateObjectives, checkHealth } from "./api";
import { useAutoScopeFromText } from "./useAutoScope";
import { buildSetMarkdown, copyText, openGmail, shareBody } from "./share";
import type { DraftedSet, ObjectiveKind } from "../shared/types";

function newId() {
  return crypto.randomUUID();
}

export function App() {
  const [kind, setKind] = useState<ObjectiveKind>("objective");
  const [text, setText] = useState("");
  const [repo, setRepo] = useState("");
  const [branchName, setBranchName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sets, setSets] = useState<DraftedSet[]>([]);
  const [aiReady, setAiReady] = useState<boolean | null>(null);

  const kindLabel = kind === "target" ? "targets" : "objectives";

  const autoScope = useAutoScopeFromText(text, {
    repo,
    branchName,
    setRepo,
    setBranchName,
  });

  useEffect(() => {
    void checkHealth().then(setAiReady);
  }, []);

  async function onGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateObjectives(
        text,
        kind,
        repo.trim() || null,
        branchName.trim() || null,
      );
      const drafted: DraftedSet = {
        id: newId(),
        kind,
        title: result.title,
        repo: result.repo,
        branchName: result.branchName,
        createdAt: new Date().toISOString(),
        items: result.items.map((item) => ({
          id: newId(),
          text: item,
          status: "not-started",
        })),
      };
      setSets((prev) => [drafted, ...prev]);
      setText("");
      setRepo("");
      setBranchName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draft objectives.");
    } finally {
      setGenerating(false);
    }
  }

  function toggleItem(setId: string, itemId: string) {
    setSets((prev) =>
      prev.map((set) => {
        if (set.id !== setId) return set;
        return {
          ...set,
          items: set.items.map((item) =>
            item.id === itemId
              ? { ...item, status: item.status === "met" ? "not-started" : "met" }
              : item,
          ),
        };
      }),
    );
  }

  async function onShare(set: DraftedSet, via: "copy" | "gmail") {
    const markdown = buildSetMarkdown(set);
    const body = shareBody(markdown);
    if (via === "copy") {
      await copyText(body);
      return;
    }
    openGmail(set.title, body);
  }

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-inner">
          <p className="eyebrow">Vantage · no login</p>
          <h1>Turn a brief into a checklist</h1>
          <p className="lede">
            Paste a project spec or plan. AI reads your scope labels (Source tree, Ref, Codebase,
            Workline, etc.) and drafts objectives you can share — no GitHub sign-in required.
          </p>
          {aiReady === false ? (
            <p className="banner-warn">Server AI is not configured — scope will use offline heuristics only.</p>
          ) : null}
        </div>
      </header>

      <main className="shell">
        <section className="card">
          <div className="card-head">
            <h2>Objectives &amp; targets</h2>
            <div className="kind-toggle" role="group" aria-label="Checklist type">
              <button
                type="button"
                className={kind === "objective" ? "active" : ""}
                onClick={() => setKind("objective")}
              >
                Objectives
              </button>
              <button
                type="button"
                className={kind === "target" ? "active" : ""}
                onClick={() => setKind("target")}
              >
                Targets
              </button>
            </div>
          </div>

          <label className="field">
            Document or text
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste a project brief, spec, or plan…"
              rows={8}
              disabled={generating}
            />
          </label>

          <div className="scope-row">
            {autoScope.resolving ? <p className="hint">AI is reading your scope labels…</p> : null}
            <label>
              Repo
              <input
                value={repo}
                onChange={(e) => {
                  autoScope.markRepoEdited();
                  setRepo(e.target.value);
                }}
                placeholder="intent-registry-service or org/repo"
              />
            </label>
            <label>
              Branch
              <input
                value={branchName}
                onChange={(e) => {
                  autoScope.markBranchEdited();
                  setBranchName(e.target.value);
                }}
                placeholder="dev/eoi-intake-flow"
              />
            </label>
          </div>

          <div className="actions">
            <button
              type="button"
              className="btn-primary"
              disabled={generating || autoScope.resolving || !text.trim()}
              onClick={() => void onGenerate()}
            >
              {generating ? "Drafting…" : autoScope.resolving ? "Detecting scope…" : `Generate ${kindLabel}`}
            </button>
          </div>

          {error ? <p className="error">{error}</p> : null}
        </section>

        {sets.length === 0 ? (
          <p className="empty">Your drafted lists will appear here.</p>
        ) : (
          <section className="results">
            {sets.map((set) => (
              <article key={set.id} className="card result-card">
                <header className="result-head">
                  <div>
                    <h3>{set.title}</h3>
                    {set.repo || set.branchName ? (
                      <p className="scope-chip">
                        {[set.repo, set.branchName].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="share-actions">
                    <button type="button" className="ghost" onClick={() => void onShare(set, "copy")}>
                      Copy
                    </button>
                    <button type="button" className="ghost" onClick={() => void onShare(set, "gmail")}>
                      Gmail
                    </button>
                  </div>
                </header>
                <ul className="checklist">
                  {set.items.map((item) => (
                    <li key={item.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={item.status === "met"}
                          onChange={() => toggleItem(set.id, item.id)}
                        />
                        <span>{item.text}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>
        )}

        <footer className="footer">
          <p>
            Want GitHub reports, Jira sync, and desktop workflows?{" "}
            <a href="https://github.com/Taekondainc/vantage" target="_blank" rel="noreferrer">
              Get the Vantage desktop app
            </a>
            .
          </p>
        </footer>
      </main>
    </div>
  );
}
