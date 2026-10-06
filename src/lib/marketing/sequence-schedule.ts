/**
 * Scheduled sends for sequences: when a sequence's pending batches go out on
 * their own. Times are kept as wall clock values in Pacific Time, so "9:00 AM"
 * stays 9:00 AM PT across clock changes. Pure, so the schedule panel, the cron
 * runner and the tests all read a schedule the same way.
 */
import { zonedLocalToUtc, utcToZonedLocal } from "@/lib/cron/zoned-schedule";

export const SCHEDULE_TZ = "America/Los_Angeles";

export type RepeatRule = "once" | "daily" | "weekdays" | "weekly" | "monthly";
export const REPEAT_RULES: RepeatRule[] = ["once", "daily", "weekdays", "weekly", "monthly"];

export type SequenceSchedule = {
  sequence_id: string;
  enabled: boolean;
  start_date: string; // YYYY-MM-DD in PT
  end_date: string | null;
  repeat: RepeatRule;
  weekdays: number[]; // 0 = Sunday … 6 = Saturday, used by "weekly"
  send_time: string; // HH:MM in PT
  max_per_run: number;
  reminder_minutes: number; // 0 = off
  unreviewed_action: "send" | "hold";
  activated_at: string;
  last_run_for: string | null;
  run_sent: number;
  run_done: boolean;
  last_reminder_for: string | null;
};

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");

function parseDate(d: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function lastDom(ms: number): number {
  const d = new Date(ms);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/** Does the schedule run on this PT calendar day (UTC midnight ms of that date)? */
function runsOn(s: Pick<SequenceSchedule, "repeat" | "weekdays" | "start_date">, dayMs: number, startMs: number): boolean {
  const dow = new Date(dayMs).getUTCDay();
  switch (s.repeat) {
    case "once": return dayMs === startMs;
    case "daily": return true;
    case "weekdays": return dow >= 1 && dow <= 5;
    case "weekly": return (s.weekdays ?? []).includes(dow);
    case "monthly": {
      const want = new Date(startMs).getUTCDate();
      const dom = new Date(dayMs).getUTCDate();
      return dom === Math.min(want, lastDom(dayMs));
    }
  }
}

/** Today's date in PT as YYYY-MM-DD. */
export function todayInPt(now: Date = new Date()): string {
  return utcToZonedLocal(now, SCHEDULE_TZ).slice(0, 10);
}

/**
 * Run instants (UTC) in [from, to], earliest first, at most `limit`.
 * Walks PT calendar days, so it is bounded by the date range, not by minutes.
 */
export function runsBetween(
  s: Pick<SequenceSchedule, "repeat" | "weekdays" | "start_date" | "end_date" | "send_time">,
  from: Date,
  to: Date,
  limit = 500,
): Date[] {
  const startMs = parseDate(s.start_date);
  if (startMs === null || !/^\d{2}:\d{2}$/.test(s.send_time)) return [];
  const endMs = s.end_date ? parseDate(s.end_date) : null;
  const fromDay = parseDate(todayInPt(from)) ?? startMs;
  const toDay = parseDate(todayInPt(to)) ?? startMs;
  let day = Math.max(startMs, fromDay - DAY_MS);
  const last = Math.min(endMs ?? Number.POSITIVE_INFINITY, toDay + DAY_MS);
  const out: Date[] = [];
  for (; day <= last && out.length < limit; day += DAY_MS) {
    if (!runsOn(s, day, startMs)) continue;
    const at = zonedLocalToUtc(`${fmtDate(day)}T${s.send_time}`, SCHEDULE_TZ);
    if (!at) continue;
    if (at.getTime() >= from.getTime() && at.getTime() <= to.getTime()) out.push(at);
  }
  return out;
}

/** The next `count` runs strictly after `now`. Looks ahead up to 400 days. */
export function nextRuns(s: Parameters<typeof runsBetween>[0], now: Date, count = 1): Date[] {
  return runsBetween(s, new Date(now.getTime() + 1), new Date(now.getTime() + 400 * DAY_MS), count);
}

/** The latest run at or before `now`, within the last `withinMs`. */
export function latestRun(s: Parameters<typeof runsBetween>[0], now: Date, withinMs = 12 * 3_600_000): Date | null {
  const runs = runsBetween(s, new Date(now.getTime() - withinMs), now);
  return runs.length ? runs[runs.length - 1] : null;
}

/** Total runs in the date range (capped, so an open ended range reads "500+"). */
export function countRuns(s: Parameters<typeof runsBetween>[0], cap = 500): number {
  const start = parseDate(s.start_date);
  if (start === null) return 0;
  const from = zonedLocalToUtc(`${s.start_date}T00:00`, SCHEDULE_TZ) ?? new Date(start);
  const endDate = s.end_date ?? fmtDate(start + 3 * 365 * DAY_MS);
  const to = zonedLocalToUtc(`${endDate}T23:59`, SCHEDULE_TZ) ?? new Date(start);
  return runsBetween(s, from, to, cap).length;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "9:00 AM" from "09:00". */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const hr = ((h + 11) % 12) + 1;
  return `${hr}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
}
function shortDate(d: string): string {
  const ms = parseDate(d);
  if (ms === null) return d;
  const x = new Date(ms);
  return `${MON[x.getUTCMonth()]} ${x.getUTCDate()}`;
}

/** "Wed Oct 7, 9:00 AM PT" for an instant. */
export function formatPt(at: Date): string {
  const local = utcToZonedLocal(at, SCHEDULE_TZ);
  const ms = parseDate(local.slice(0, 10))!;
  const x = new Date(ms);
  return `${DOW[x.getUTCDay()]} ${MON[x.getUTCMonth()]} ${x.getUTCDate()}, ${formatTime(local.slice(11, 16))} PT`;
}

/** "in 8h 55m", "in 2d 3h", "now". */
export function formatIn(at: Date, now: Date = new Date()): string {
  const mins = Math.round((at.getTime() - now.getTime()) / 60_000);
  if (mins <= 0) return "now";
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}

/** "Weekdays 9:00 AM PT · Oct 7 to Nov 30" for the list column. */
export function describeSchedule(s: Pick<SequenceSchedule, "repeat" | "weekdays" | "start_date" | "end_date" | "send_time" | "enabled">): string {
  const when = formatTime(s.send_time) + " PT";
  let rule: string;
  switch (s.repeat) {
    case "once": rule = `Once ${shortDate(s.start_date)}`; break;
    case "daily": rule = "Daily"; break;
    case "weekdays": rule = "Weekdays"; break;
    case "weekly": rule = `Weekly ${[...(s.weekdays ?? [])].sort().map((d) => DOW[d]).join(", ") || "(no days)"}`; break;
    case "monthly": rule = `Monthly on the ${new Date(parseDate(s.start_date) ?? 0).getUTCDate()}`; break;
  }
  const range = s.repeat === "once" ? "" : ` · ${shortDate(s.start_date)} to ${s.end_date ? shortDate(s.end_date) : "no end"}`;
  return `${s.enabled ? "" : "Paused · "}${rule} ${when}${range}`;
}
