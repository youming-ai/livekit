// A small, deterministic palette for speaker tags.
// The color stays stable for the lifetime of a given sid (speaker id), so
// captions from the same person share a color across the page.

const PALETTE = [
  "oklch(0.72 0.16 25)",   // rose
  "oklch(0.72 0.16 60)",   // amber
  "oklch(0.78 0.15 95)",   // lime
  "oklch(0.72 0.14 160)",  // emerald
  "oklch(0.72 0.13 215)",  // sky
  "oklch(0.68 0.16 280)",  // violet
  "oklch(0.68 0.16 330)",  // pink
] as const;

/**
 * Pick a stable foreground color for the given speaker id.
 * `sid` is the stable LiveKit participant identity for the speaker.
 */
export function speakerColor(sid: string | number | undefined): string {
  const s = sid == null ? "" : String(sid);
  if (!s) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

/**
 * Extract a single character to show inside the speaker avatar. The speaker
 * label is the participant's display name, so we take its first non-whitespace
 * character (works for Chinese/Japanese/Latin names alike).
 */
export function speakerInitial(speaker: string | undefined): string {
  const s = (speaker ?? "").trim();
  if (!s) return "•";
  return s.slice(0, 1).toUpperCase();
}
