import type { ExtractedScope, GenerateResponse, ObjectiveKind } from "../shared/types";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText || "Request failed");
  return data;
}

export function resolveScope(text: string): Promise<ExtractedScope> {
  return postJson("/api/resolve-scope", { text });
}

export function generateObjectives(
  text: string,
  kind: ObjectiveKind,
  repo: string | null,
  branchName: string | null,
): Promise<GenerateResponse> {
  return postJson("/api/generate", { text, kind, repo, branchName });
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch("/api/health");
    const data = (await res.json()) as { ok?: boolean; ai?: boolean };
    return Boolean(res.ok && data.ok);
  } catch {
    return false;
  }
}
