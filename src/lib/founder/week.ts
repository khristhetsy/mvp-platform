/**
 * The week the Marketing stage resets on: Monday 00:00 to Sunday 23:59 Pacific
 * time, the platform's one time zone (see platform-tz). Pure and client safe.
 */
import { PLATFORM_TZ } from "@/lib/time/platform-tz";
import { ptDate } from "@/lib/time/pt-day-diff";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const weekdayFmt = new Intl.DateTimeFormat("en-US", { timeZone: PLATFORM_TZ, weekday: "short" });
const shortFmt = new Intl.DateTimeFormat("en-US", { timeZone: PLATFORM_TZ, month: "short", day: "numeric" });
const resetFmt = new Intl.DateTimeFormat("en-US", { timeZone: PLATFORM_TZ, weekday: "long", month: "short", day: "numeric" });

const DAYS_SINCE_MONDAY: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export type WeekWindow = {
  /** First instant of the week (Monday 00:00 PT) as an ISO string in UTC. */
  startIso: string;
  /** "Nov 16 to Nov 22". */
  label: string;
  /** "Monday, Nov 23": when the week resets. */
  resetsLabel: string;
};

function addDays(dateStr: string, n: number): string {
  return new Date(Date.parse(`${dateStr}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Noon UTC on a calendar date, so formatting it in PT still lands on the same day. */
function noon(dateStr: string): Date {
  return new Date(Date.parse(`${dateStr}T12:00:00Z`));
}

/** First instant (UTC) of a PT calendar day. Midnight PT is 07:00Z in summer and 08:00Z in winter. */
function startOfPtDay(dateStr: string): Date {
  const utcMidnight = Date.parse(`${dateStr}T00:00:00Z`);
  for (const hours of [7, 8]) {
    const t = utcMidnight + hours * HOUR_MS;
    if (ptDate(new Date(t)) === dateStr && ptDate(new Date(t - 1)) !== dateStr) return new Date(t);
  }
  return new Date(utcMidnight + 8 * HOUR_MS);
}

/** The Monday to Sunday week (PT) that contains `now`. */
export function weekWindow(now: Date = new Date()): WeekWindow {
  const today = ptDate(now) ?? now.toISOString().slice(0, 10);
  const monday = addDays(today, -(DAYS_SINCE_MONDAY[weekdayFmt.format(now)] ?? 0));
  const sunday = addDays(monday, 6);
  const nextMonday = addDays(monday, 7);
  return {
    startIso: startOfPtDay(monday).toISOString(),
    label: `${shortFmt.format(noon(monday))} to ${shortFmt.format(noon(sunday))}`,
    resetsLabel: resetFmt.format(noon(nextMonday)),
  };
}

/** True when the timestamp falls on or after the start of the week. Unreadable or empty is false. */
export function isInWeek(iso: string | null | undefined, startIso: string): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return !Number.isNaN(t) && t >= Date.parse(startIso);
}

/** The most recent of several timestamps, or null when none is readable. */
export function latestIso(values: ReadonlyArray<string | null | undefined>): string | null {
  let best: { iso: string; t: number } | null = null;
  for (const v of values) {
    if (!v) continue;
    const t = Date.parse(v);
    if (Number.isNaN(t)) continue;
    if (!best || t > best.t) best = { iso: v, t };
  }
  return best ? best.iso : null;
}
