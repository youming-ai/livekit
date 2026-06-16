// A small, deterministic palette for anonymous speaker tags.
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
 * Extract a single character (or a short initial) to show inside the speaker
 * avatar. Handles Chinese/Japanese strings by taking the first non-whitespace
 * character.
 */
export function speakerInitial(speaker: string | undefined): string {
  const s = (speaker ?? "").trim();
  if (!s) return "•";
  // Strip a leading "说话人" / "说話者" prefix; show the first character
  // after the digits, otherwise the first character of the string.
  const m = s.match(/^(?:说话人|说話者|話者|Speaker)\s*\d*/i);
  const tail = m ? s.slice(m[0].length).trim() : s;
  return (tail || s).slice(0, 1).toUpperCase();
}
