import type { DraftedSet, ObjectiveItemStatus } from "../shared/types";

const STATUS_LABEL: Record<ObjectiveItemStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  met: "Met",
};

export function buildSetMarkdown(set: DraftedSet): string {
  const label = set.kind === "target" ? "Targets" : "Objectives";
  const met = set.items.filter((item) => item.status === "met").length;
  const heading = `${set.title} (${met}/${set.items.length} met)`;
  const body = set.items.map((item) => `- [${STATUS_LABEL[item.status]}] ${item.text}`).join("\n");
  const scope =
    set.repo || set.branchName
      ? `\n\nScope: ${[set.repo, set.branchName].filter(Boolean).join(" · ")}`
      : "";
  return `# ${label}\n\n### ${heading}\n\n${body}${scope}\n`;
}

export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

export function shareBody(markdown: string): string {
  return markdownToPlainText(markdown);
}

export function openGmail(title: string, body: string) {
  const url = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}
