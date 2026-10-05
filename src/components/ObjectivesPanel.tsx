import { useEffect, useState } from "react";
import {
  checkHealth,
  createObjectiveSet,
  deleteObjectiveSet,
  generateObjectives,
  listObjectiveSets,
  updateObjectiveItemStatus,
} from "../api";
import { ShareMenu } from "./ShareMenu";
import { buildSetMarkdown } from "../share";
import { useAutoScopeFromText } from "../useAutoScope";
import type { CloudObjectiveSet, ObjectiveKind } from "../../shared/types";

export function ObjectivesPanel({ embedded = false }: { embedded?: boolean }) {
  const [kind, setKind] = useState<ObjectiveKind>("objective");
  const [text, setText] = useState("");
  const [repo, setRepo] = useState("");
  const [branchName, setBranchName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [sets, setSets] = useState<CloudObjectiveSet[]>([]);
  const [loading, setLoading] = useState(true);

  const kindLabel = kind === "target" ? "targets" : "objectives";
  const autoScope = useAutoScopeFromText(text, { repo, branchName, setRepo, setBranchName });

  useEffect(() => {
    let cancelled = false;
    void listObjectiveSets()
      .then((next) => {
        if (!cancelled) setSets(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load objectives.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void checkHealth().then((health) => setAiReady(health.ai));
  }, []);

  async function onGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateObjectives(text, kind, repo.trim() || null, branchName.trim() || null);
      const created = await createObjectiveSet({
        kind,
        title: result.title,
        sourceName: null,
        items: result.items,
        repo: result.repo,
        branchName: result.branchName,
      });
      setSets((prev) => [created, ...prev]);
      setText("");
      setRepo("");
      setBranchName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draft objectives.");
    } finally {
      setGenerating(false);
    }
  }

  async function onDeleteSet(id: string) {
    const prev = sets;
    setSets((current) => current.filter((entry) => entry.id !== id));
    try {
      await deleteObjectiveSet(id);
    } catch (err) {
      setSets(prev);
      setError(err instanceof Error ? err.message : "Could not delete that list.");
    }
  }

  async function onToggleItem(setId: string, itemId: string, currentlyMet: boolean) {
    const nextStatus = currentlyMet ? "not-started" : "met";
    setSets((current) =>
      current.map((entry) =>
        entry.id !== setId
          ? entry
          : { ...entry, items: entry.items.map((row) => (row.id === itemId ? { ...row, status: nextStatus } : row)) },
      ),
    );
    try {
      const updated = await updateObjectiveItemStatus(setId, itemId, nextStatus);
      setSets((current) => current.map((entry) => (entry.id === setId ? updated : entry)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update that item.");
    }
  }

  return (
    <div className={embedded ? "objectives-embed" : undefined}>
      {!embedded ? (
        <header className="workspace-top">
          <div>
            <p className="eyebrow">Signed in</p>
            <h1>Objectives &amp; targets</h1>
            <p className="lede">Paste a brief. AI fills repo and branch from the labels at the top.</p>
          </div>
        </header>
      ) : (
        <>
          <h3 className="tasks-tab-title">Objectives &amp; targets</h3>
          <p className="hint">
            Paste a brief, spec, or plan. AI reads Source tree, Ref, Codebase, Workline  -  whatever your team wrote.
            Synced to your account  -  also visible in the desktop app.
          </p>
        </>
      )}

      {aiReady === false ? (
        <p className="banner-inline">AI is not configured on the server  -  add GROQ_API_KEY to .env and restart.</p>
      ) : null}

      <div className="objective-input-row">
        <div className="card-head">
          <strong>Document or text</strong>
          <div className="kind-toggle" role="group" aria-label="Checklist type">
            <button type="button" className={kind === "objective" ? "kind-toggle-btn active" : "kind-toggle-btn"} onClick={() => setKind("objective")}>
              Objectives
            </button>
            <button type="button" className={kind === "target" ? "kind-toggle-btn active" : "kind-toggle-btn"} onClick={() => setKind("target")}>
              Targets
            </button>
          </div>
        </div>
        <label className="field-wide">
          Brief
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a project brief, spec, or plan..."
            rows={6}
            disabled={generating}
          />
        </label>
        <div className="scope-row">
          {autoScope.resolving ? <p className="hint">AI is reading your scope labels...</p> : null}
          <label>
            Repo
            <input
              value={repo}
              onChange={(e) => {
                autoScope.markRepoEdited();
                setRepo(e.target.value);
              }}
              placeholder="org/repo or new slug"
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
              placeholder="feature/my-branch"
            />
          </label>
        </div>
        <div className="setup-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={generating || autoScope.resolving || !text.trim()}
            onClick={() => void onGenerate()}
          >
            {generating ? "Drafting..." : autoScope.resolving ? "Detecting scope..." : `Generate ${kindLabel}`}
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </div>

      {loading ? (
        <p className="hint">Loading objectives...</p>
      ) : sets.length === 0 ? (
        <p className="empty">No objectives or targets yet  -  draft your first list above.</p>
      ) : (
        <div className="objective-set-list">
          {sets.map((set) => {
            const met = set.items.filter((item) => item.status === "met").length;
            return (
              <article key={set.id} className="objective-set">
                <header className="result-head">
                  <div>
                    <h3>{set.title}</h3>
                    <p className="scope-chip">
                      {met}/{set.items.length} met
                      {set.repo || set.branchName ? ` - ${[set.repo, set.branchName].filter(Boolean).join(" - ")}` : ""}
                    </p>
                  </div>
                  <div className="share-actions">
                    <ShareMenu title={set.title} markdown={buildSetMarkdown(set)} />
                    <button type="button" className="ghost danger" onClick={() => void onDeleteSet(set.id)}>
                      Delete list
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
                          onChange={() => void onToggleItem(set.id, item.id, item.status === "met")}
                        />
                        <span>{item.text}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
