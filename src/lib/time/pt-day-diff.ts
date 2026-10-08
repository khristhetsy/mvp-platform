/**
 * Calendar days from today to a due date, both read in Pacific time (PT).
 *
 * The old labels divided milliseconds by 24h and rounded. A date-only due date
 * ("2026-10-09") parses as UTC midnight, which is the afternoon before in PT, so
 * in a PT evening "tomorrow" came out as 0 and showed "due today". This compares
 * calendar dates instead. Client safe.
 */
import { PLATFORM_TZ } from "@/lib/time/platform-tz";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: PLATFORM_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** YYYY-MM-DD in PT. A date-only string is already a calendar date and is kept as is. */
export function ptDate(value: string | Date): string | null {
  if (typeof value === "string" && DATE_ONLY.test(value)) return value;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return fmt.format(d);
}

/** Whole calendar days from today (PT) to `due`: 0 today, 1 tomorrow, -1 yesterday. Null if unreadable. */
export function ptDayDiff(due: string, now: Date = new Date()): number | null {
  const a = ptDate(now);
  const b = ptDate(due);
  if (!a || !b) return null;
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
