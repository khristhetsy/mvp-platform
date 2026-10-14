/**
 * Reminder times are typed and shown in Pacific time (PT), the platform time zone, and stored
 * as UTC instants. Client safe.
 */
import { PLATFORM_TZ, PLATFORM_TZ_LABEL } from "@/lib/time/platform-tz";
import { ptDayDiff } from "@/lib/time/pt-day-diff";

function ptOffsetMs(at: Date): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: PLATFORM_TZ, hourCycle: "h23",
    year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",
  }).formatToParts(at);
  const n = (type: string) => Number(p.find((x) => x.type === type)?.value ?? 0);
  return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second")) - Math.floor(at.getTime() / 1000) * 1000;
}

/** "2026-10-15" plus "09:30" read as PT wall time, returned as an ISO instant. Null if unreadable. */
export function ptWallToIso(date: string, time: string): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const wall = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  let instant = wall - ptOffsetMs(new Date(wall));
  instant = wall - ptOffsetMs(new Date(instant));
  const out = new Date(instant);
  return Number.isNaN(out.getTime()) ? null : out.toISOString();
}

/** Today's date in PT as YYYY-MM-DD, for the date field default. */
export function ptToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PLATFORM_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export type ReminderGroup = "late" | "today" | "future";

export function reminderGroup(dueAt: string, now: Date = new Date()): ReminderGroup {
  const diff = ptDayDiff(dueAt, now);
  if (diff === null || diff > 0) return "future";
  if (diff === 0) return "today";
  return "late";
}

/** "Today, 2:00 PM PT" or "Oct 16, 10:00 AM PT". */
export function formatReminderDue(dueAt: string, now: Date = new Date()): string {
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return "";
  const time = new Intl.DateTimeFormat("en-US", { timeZone: PLATFORM_TZ, hour: "numeric", minute: "2-digit" }).format(d);
  const diff = ptDayDiff(dueAt, now);
  const day = diff === 0
    ? "Today"
    : diff === 1
      ? "Tomorrow"
      : new Intl.DateTimeFormat("en-US", { timeZone: PLATFORM_TZ, month: "short", day: "numeric" }).format(d);
  return `${day}, ${time} ${PLATFORM_TZ_LABEL}`;
}

/** The PT wall time of an instant as HH:MM, for the edit card. */
export function ptTimeOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "09:00";
  return new Intl.DateTimeFormat("en-GB", { timeZone: PLATFORM_TZ, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).format(d);
}
