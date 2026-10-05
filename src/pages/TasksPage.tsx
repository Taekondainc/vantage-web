import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createTask, deleteTask, listObjectiveSets, listTasks, updateTaskStatus } from "../api";
import { ObjectivesPanel } from "../components/ObjectivesPanel";
import { ShareMenu } from "../components/ShareMenu";
import { TabPanel, Tabs } from "../components/Tabs";
import { Select } from "../components/ui/Select";
import { colorFor } from "../lib/colors";
import { buildSetMarkdown } from "../share";
import type { CloudObjectiveSet, CloudTask, TaskStatus } from "../../shared/types";

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  "in-progress": "In progress",
  reviewing: "Reviewing",
  done: "Done",
};

const STATUS_FILTERS: Array<{ id: "all" | TaskStatus; label: string }> = [
  { id: "all", label: "All" },
  { id: "todo", label: "To do" },
  { id: "in-progress", label: "In progress" },
  { id: "reviewing", label: "Reviewing" },
  { id: "done", label: "Done" },
];

function todayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function tasksMarkdown(tasks: CloudTask[], sets: CloudObjectiveSet[]) {
  const open = tasks.filter((task) => task.status !== "done");
  const done = tasks.filter((task) => task.status === "done");
  return [
    "# Task list",
    "",
    "## In progress",
    ...open.map((task) => `- [${STATUS_LABEL[task.status]}] ${task.title}`),
    "",
    "## Done",
    ...done.map((task) => `- ${task.title}`),
    "",
    ...sets.map((set) => buildSetMarkdown(set)),
  ].join("\n");
}

export function TasksPage() {
  const [tab, setTab] = useState("tasks");
  const [tasks, setTasks] = useState<CloudTask[]>([]);
  const [sets, setSets] = useState<CloudObjectiveSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [repo, setRepo] = useState("");
  const [branchName, setBranchName] = useState("");
  const [createdAt, setCreatedAt] = useState(todayDate());
  const [expectedFinishAt, setExpectedFinishAt] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listTasks(), listObjectiveSets()])
      .then(([nextTasks, nextSets]) => {
        if (cancelled) return;
        setTasks(nextTasks);
        setSets(nextSets);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load tasks.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openTasks = useMemo(() => tasks.filter((task) => task.status !== "done"), [tasks]);
  const statusCounts = useMemo(() => {
    const counts: Record<"all" | TaskStatus, number> = {
      all: tasks.length,
      todo: 0,
      "in-progress": 0,
      reviewing: 0,
      done: 0,
    };
    for (const task of tasks) counts[task.status] += 1;
    return counts;
  }, [tasks]);

  const filtered = statusFilter === "all" ? tasks : tasks.filter((task) => task.status === statusFilter);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const created = await createTask({
        title: trimmed,
        description: description.trim() || null,
        status: "todo",
        repo: repo.trim() || null,
        branchName: branchName.trim() || null,
        createdAt: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
        expectedFinishAt: expectedFinishAt || null,
      });
      setTasks((prev) => [created, ...prev]);
      setTitle("");
      setDescription("");
      setRepo("");
      setBranchName("");
      setCreatedAt(todayDate());
      setExpectedFinishAt("");
      setTab("tasks");
      setStatusFilter("todo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the task.");
    }
  }

  async function onChangeStatus(id: string, status: TaskStatus) {
    const prev = tasks;
    setTasks((current) => current.map((entry) => (entry.id === id ? { ...entry, status } : entry)));
    try {
      const updated = await updateTaskStatus(id, status);
      setTasks((current) => current.map((entry) => (entry.id === id ? updated : entry)));
    } catch (err) {
      setTasks(prev);
      setError(err instanceof Error ? err.message : "Could not update the task.");
    }
  }

  async function onDeleteTask(id: string) {
    const prev = tasks;
    setTasks((current) => current.filter((entry) => entry.id !== id));
    try {
      await deleteTask(id);
    } catch (err) {
      setTasks(prev);
      setError(err instanceof Error ? err.message : "Could not delete the task.");
    }
  }

  return (
    <>
      <header className="workspace-top">
        <div>
          <p className="eyebrow">Vantage</p>
          <h1>Tasks</h1>
        </div>
        <div className="workspace-controls">
          <Link className="ghost" to="/app">
            ‹ Back to reports
          </Link>
        </div>
      </header>

      {error ? <p className="error inline-error">{error}</p> : null}
      {loading ? <p className="hint">Loading tasks...</p> : null}

      <section className="card-panel tasks-card">
        <Tabs
          tabs={[
            { id: "create", label: "Create" },
            { id: "tasks", label: "Tasks", badge: openTasks.length || undefined },
            { id: "objectives", label: "Objectives", badge: sets.length || undefined },
          ]}
          active={tab}
          onChange={setTab}
        >
          <TabPanel id="create" active={tab}>
            <h3 className="tasks-tab-title">New task</h3>
            <p className="hint">Synced to your account — also visible in the desktop app. Jira, Linear, GitHub Issues, and Asana sync in the desktop app only.</p>
            <form onSubmit={(e) => void onCreate(e)} className="task-form">
              <label className="field-wide">
                Task
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to get done?" required />
              </label>
              <label className="field-wide">
                Description
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Optional details..." />
              </label>
              <label>
                Branch name
                <input value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="feature/my-branch" />
              </label>
              <label>
                Repo
                <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="org/repo" />
              </label>
              <label>
                Date created
                <input type="date" value={createdAt} onChange={(e) => setCreatedAt(e.target.value)} />
              </label>
              <label>
                Expected finishing time
                <input type="datetime-local" value={expectedFinishAt} onChange={(e) => setExpectedFinishAt(e.target.value)} />
              </label>
              <div className="setup-actions">
                <button type="submit" className="btn-primary" disabled={!title.trim()}>
                  Create task
                </button>
              </div>
            </form>
          </TabPanel>

          <TabPanel id="tasks" active={tab}>
            <div className="panel-head">
              <div>
                <h3 className="tasks-tab-title">Tasks</h3>
                <div className="kind-toggle task-status-switch" role="tablist">
                  {STATUS_FILTERS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={statusFilter === option.id ? "kind-toggle-btn active" : "kind-toggle-btn"}
                      onClick={() => setStatusFilter(option.id)}
                    >
                      {option.label}
                      {statusCounts[option.id] > 0 ? (
                        <span className="task-status-count">{statusCounts[option.id]}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
              <ShareMenu title="Task list" markdown={tasksMarkdown(filtered, sets)} disabled={filtered.length === 0 && sets.length === 0} />
            </div>
            {filtered.length === 0 ? (
              <p className="empty">No tasks in this view.</p>
            ) : (
              <ul className="task-list">
                {filtered.map((task) => (
                  <li key={task.id} className={task.status === "done" ? "task done" : "task"}>
                    <div className="task-row">
                      <button type="button" className="task-main-toggle" onClick={() => setExpandedId((id) => (id === task.id ? null : task.id))}>
                        <strong>{task.title}</strong>
                        <span className="task-dates">
                          {task.repo ? (
                            <span className="repo-link" style={{ color: colorFor(task.repo) }}>
                              {task.repo}
                            </span>
                          ) : null}
                          {task.branchName ? ` - ${task.branchName}` : ""}
                        </span>
                      </button>
                      <div className="task-actions">
                        <Select
                          aria-label="Task status"
                          value={task.status}
                          onValueChange={(value) => void onChangeStatus(task.id, value as TaskStatus)}
                          options={(Object.keys(STATUS_LABEL) as TaskStatus[]).map((status) => ({
                            value: status,
                            label: STATUS_LABEL[status],
                          }))}
                        />
                        <button type="button" className="ghost danger" onClick={() => void onDeleteTask(task.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                    {expandedId === task.id && task.description ? <p className="task-description">{task.description}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </TabPanel>

          <TabPanel id="objectives" active={tab}>
            <ObjectivesPanel embedded />
          </TabPanel>
        </Tabs>
      </section>
    </>
  );
}
