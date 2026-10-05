/** Strip HTML tags/entities so PR bodies and titles never leak markup into reports. */
export function stripHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function plainText(text: string | null | undefined): string {
  if (!text) return "";
  return stripHtml(text);
}

/** Like plainText but keeps line breaks — for share/export of multi-line markdown. */
export function plainTextPreserveLines(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .split("\n")
    .map((line) => stripHtml(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
