import type { ObjectiveKind } from "../shared/types";
import { generateAiText } from "./ai";
import { extractJsonObject } from "./ai";

const MAX_INPUT_CHARS = 8000;
const MIN_ITEMS = 1;
const MAX_ITEMS = 12;
const TARGET_ITEMS_HINT = "6 to 12";
const MAX_ITEM_CHARS = 65;

function kindNoun(kind: ObjectiveKind, plural = true) {
  const word = kind === "target" ? "target" : "objective";
  return plural ? `${word}s` : word;
}

function buildPrompt(text: string, kind: ObjectiveKind): string {
  const noun = kindNoun(kind);
  return [
    `You are drafting a short, focused checklist of ${noun} from the document below.`,
    "Respond with a single JSON object only. No markdown fences, no commentary.",
    `Shape: {"title":"short 3-6 word title","items":["${kindNoun(kind, false)} 1",...]}`,
    `Each item must describe exactly ONE small, independently verifiable deliverable (max ~${MAX_ITEM_CHARS} characters), starting with a verb where possible.`,
    `Keep the list short and prioritized: aim for ${TARGET_ITEMS_HINT} items.`,
    `Extract between ${MIN_ITEMS} and ${MAX_ITEMS} items depending on how much distinct content exists.`,
    "Focus on numbered requirements (T1, T2, …) — ignore scope labels at the top (repo/branch/source tree/ref).",
    "",
    "=== Document ===",
    text.slice(0, MAX_INPUT_CHARS),
  ].join("\n");
}

export async function draftObjectivesFromText(
  text: string,
  kind: ObjectiveKind,
): Promise<{ title: string; items: string[] }> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Paste some text first.");

  const raw = await generateAiText(buildPrompt(trimmed, kind), { maxTokens: 1200 });
  const parsed = JSON.parse(extractJsonObject(raw)) as { title?: string; items?: string[] };
  const items = Array.isArray(parsed.items)
    ? parsed.items.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : [];

  if (items.length === 0) {
    throw new Error(`Could not draft ${kindNoun(kind)} from that text. Try adding more detail.`);
  }

  return {
    title: typeof parsed.title === "string" ? parsed.title.trim() : "",
    items: items.slice(0, MAX_ITEMS),
  };
}
