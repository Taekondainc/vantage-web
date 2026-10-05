const GROQ_MODELS = ["openai/gpt-oss-20b", "openai/gpt-oss-120b"] as const;
const RATE_LIMIT_WAIT_MS = 12_000;

export function extractJsonObject(raw: string): string {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  // Small open models frequently leave a trailing comma before a closing
  // bracket/brace, which JSON.parse rejects outright — safe to drop.
  const stripTrailingCommas = (text: string) => text.replace(/,(\s*[}\]])/g, "$1");
  if (trimmed.startsWith("{")) return stripTrailingCommas(trimmed);
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return stripTrailingCommas(trimmed.slice(start, end + 1));
  return trimmed;
}

function parseRateLimitWaitMs(detail: string): number | null {
  const match = detail.match(/try again in ([\d.]+)s/i);
  if (!match) return null;
  return Math.ceil(parseFloat(match[1]!) * 1000) + 800;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function groqKey(): string {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) throw new Error("GROQ_API_KEY is not configured on the server.");
  return key;
}

function groqModels(): string[] {
  const preferred = process.env.GROQ_MODEL?.trim();
  if (preferred) return [preferred, ...GROQ_MODELS.filter((m) => m !== preferred)];
  return [...GROQ_MODELS];
}

async function callGroq(
  prompt: string,
  options?: { maxTokens?: number; temperature?: number },
  attempt = 0,
): Promise<string> {
  const apiKey = groqKey();
  let lastError: Error | null = null;

  for (const model of groqModels()) {
    const body: Record<string, unknown> = {
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 1024,
    };

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      if (/rate_limit|tokens per minute/i.test(detail) && attempt < 4) {
        const wait = parseRateLimitWaitMs(detail) ?? RATE_LIMIT_WAIT_MS;
        await sleep(wait);
        return callGroq(prompt, options, attempt + 1);
      }
      if (/model.*not exist|model_not_found/i.test(detail)) {
        lastError = new Error(detail);
        continue;
      }
      throw new Error(detail);
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() || "";
  }

  throw lastError ?? new Error("No Groq model available.");
}

export async function generateAiText(
  prompt: string,
  options?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  return callGroq(prompt, options);
}

export async function pauseForGroqTpm(): Promise<void> {
  await sleep(6_500);
}
