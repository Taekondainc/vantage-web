// Creates a real git branch via GitHub's Git Data API (not just a browser
// link) — ported from vantagedestkop/electron/github.ts's createBranch.
const API = "https://api.github.com";

async function gh<T>(token: string, path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init?.method,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "vantage-web",
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) detail = body.message;
    } catch {
      /* keep statusText */
    }
    throw new Error(detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function ensureRepoInitialized(token: string, repo: string, defaultBranch: string): Promise<void> {
  try {
    await gh(token, `/repos/${repo}/git/ref/${encodeURIComponent(`heads/${defaultBranch}`)}`);
    return;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/empty|409|404|not found/i.test(message)) throw err;
  }

  const title = repo.split("/").pop() || "repository";
  await gh(token, `/repos/${repo}/contents/README.md`, {
    method: "PUT",
    body: {
      message: "Initial commit",
      content: Buffer.from(`# ${title}\n`, "utf8").toString("base64"),
    },
  });
}

export type CreateBranchResult = { created: boolean; branch: string; baseBranch: string };

/** Points the new branch at the tip of the repo's real default branch.
 * Creating a branch that already exists is treated as success (idempotent)
 * rather than an error. */
export async function createBranch(token: string, repo: string, branchName: string): Promise<CreateBranchResult> {
  const branch = branchName.trim();
  if (!branch) throw new Error("A branch name is required.");

  const repoInfo = await gh<{ default_branch: string }>(token, `/repos/${repo}`);
  const baseBranch = repoInfo.default_branch;

  await ensureRepoInitialized(token, repo, baseBranch);

  const baseRef = await gh<{ object: { sha: string } }>(
    token,
    `/repos/${repo}/git/ref/${encodeURIComponent(`heads/${baseBranch}`)}`,
  );

  try {
    await gh(token, `/repos/${repo}/git/refs`, {
      method: "POST",
      body: { ref: `refs/heads/${branch}`, sha: baseRef.object.sha },
    });
    return { created: true, branch, baseBranch };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/already exists/i.test(message)) {
      return { created: false, branch, baseBranch };
    }
    if (/empty|409/i.test(message)) {
      await ensureRepoInitialized(token, repo, baseBranch);
      const retryRef = await gh<{ object: { sha: string } }>(
        token,
        `/repos/${repo}/git/ref/${encodeURIComponent(`heads/${baseBranch}`)}`,
      );
      await gh(token, `/repos/${repo}/git/refs`, {
        method: "POST",
        body: { ref: `refs/heads/${branch}`, sha: retryRef.object.sha },
      });
      return { created: true, branch, baseBranch };
    }
    throw err;
  }
}
