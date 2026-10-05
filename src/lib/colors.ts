export const PALETTE = ["#5B8DEF", "#5FBF77", "#E0A458", "#C0699C", "#4FB6B0", "#E0685A", "#8C8CE0", "#B0A15B"];

export function colorFor(key: string): string {
  if (!key) return PALETTE[0]!;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}
