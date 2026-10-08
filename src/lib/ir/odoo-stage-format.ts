// Client-safe helpers for the Odoo project stage bar.

/** Odoo style duration label: 14d, 5h, <1h. Nothing under a minute. */
export function durationLabel(seconds: number | null | undefined): string | undefined {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 60) return undefined;
  const days = Math.floor(seconds / 86400);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(seconds / 3600);
  return hours >= 1 ? `${hours}h` : "<1h";
}

/**
 * Which steps show on the bar and which go into the "···" menu, like Odoo:
 * folded stages hide unless current, and past `max` the rest overflow.
 * The current step is always on the bar.
 */
export function splitSteps<T extends { key: string; folded: boolean }>(steps: T[], current: string | null, max: number): { shown: T[]; more: T[] } {
  const open = steps.filter((s) => !s.folded || s.key === current);
  let shown = open.slice(0, max);
  const cur = open.find((s) => s.key === current);
  if (cur && !shown.includes(cur)) shown = [...open.slice(0, max - 1), cur];
  const shownKeys = new Set(shown.map((s) => s.key));
  return { shown, more: steps.filter((s) => !shownKeys.has(s.key)) };
}
