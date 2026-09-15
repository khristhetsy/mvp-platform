/**
 * Period math for the analytics pages — client-safe (no database imports).
 * Current window ends now; the comparison window is the previous window of the same
 * length, or the same window one year earlier.
 */
export type Grain = "week" | "30d" | "quarter" | "year";
export type Compare = "prev" | "yoy";
export const GRAINS: Grain[] = ["week", "30d", "quarter", "year"];
export const GRAIN_LABELS: Record<Grain, string> = { week: "Week", "30d": "30d", quarter: "Quarter", year: "Year" };

export const DAY = 86_400_000;

export type Range = { start: Date; end: Date };

/** Current window for a grain (end = now), and its comparison window. */
export function periodRange(grain: Grain, now: Date, compare: Compare): { cur: Range; cmp: Range } {
  const end = new Date(now.getTime());
  const days = grain === "week" ? 7 : grain === "30d" ? 30 : grain === "quarter" ? 91 : 365;
  const start = new Date(end.getTime() - days * DAY);
  if (compare === "yoy") {
    const s = new Date(start); s.setFullYear(s.getFullYear() - 1);
    const e = new Date(end); e.setFullYear(e.getFullYear() - 1);
    return { cur: { start, end }, cmp: { start: s, end: e } };
  }
  return { cur: { start, end }, cmp: { start: new Date(start.getTime() - days * DAY), end: start } };
}

/** Daily buckets for week / 30d, weekly buckets for quarter / year. */
export function bucketStarts(grain: Grain, range: Range): Date[] {
  const step = grain === "week" || grain === "30d" ? DAY : 7 * DAY;
  const out: Date[] = [];
  for (let t = range.start.getTime(); t < range.end.getTime(); t += step) out.push(new Date(t));
  return out;
}
export function bucketIndex(grain: Grain, range: Range, at: Date): number {
  const step = grain === "week" || grain === "30d" ? DAY : 7 * DAY;
  const i = Math.floor((at.getTime() - range.start.getTime()) / step);
  const n = Math.ceil((range.end.getTime() - range.start.getTime()) / step);
  return i < 0 || i >= n ? -1 : i;
}
export const bucketLabel = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

