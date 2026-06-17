// Format a unix millisecond timestamp as HH:MM:SS in the user's local time.
export function formatTime(ts: number): string {
  if (!Number.isFinite(ts)) return "";
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  const s = d.getSeconds().toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}
