import { PLATFORM_TZ } from "@/lib/time/platform-tz";
/**
 * Support business hours: Monday to Friday, 9:00 to 18:00 Pacific time.
 * Promised reply times and staff reminders are counted only inside this window,
 * so a request sent Friday night is not "overdue" by Saturday morning and nobody
 * is pinged at 3am. Pure functions, safe on client and server.
 */

export const SUPPORT_TZ = PLATFORM_TZ;
export const SUPPORT_OPEN_HOUR = 9;
export const SUPPORT_CLOSE_HOUR = 18;
/** One business day of reply time, in business hours. */
export const ONE_BUSINESS_DAY_HOURS = SUPPORT_CLOSE_HOUR - SUPPORT_OPEN_HOUR;

const STEP_MS = 15 * 60 * 1000;

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: SUPPORT_TZ,
  weekday: "short",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

type WallClock = { weekday: string; hour: number; minute: number };

function wallClock(d: Date): WallClock {
  const parts = partsFmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { weekday: get("weekday"), hour: Number(get("hour")), minute: Number(get("minute")) };
}

/** True when `d` falls inside support hours (Mon to Fri, 9:00 to 18:00 PT). */
export function isBusinessTime(d: Date): boolean {
  const w = wallClock(d);
  if (w.weekday === "Sat" || w.weekday === "Sun") return false;
  return w.hour >= SUPPORT_OPEN_HOUR && w.hour < SUPPORT_CLOSE_HOUR;
}

/** The first moment at or after `d` that is inside support hours. */
export function nextBusinessStart(d: Date): Date {
  if (isBusinessTime(d)) return d;
  // Align to the next quarter hour, then walk forward. Opening is on the hour,
  // so a 15 minute step lands on it exactly; at most ~3 days of steps.
  let t = Math.ceil(d.getTime() / STEP_MS) * STEP_MS;
  for (let i = 0; i < 4 * 24 * 4; i++) {
    if (isBusinessTime(new Date(t))) return new Date(t);
    t += STEP_MS;
  }
  return new Date(t);
}

/** Minutes left until today's closing time, for a moment inside business hours. */
function minutesToClose(d: Date): number {
  const w = wallClock(d);
  return SUPPORT_CLOSE_HOUR * 60 - (w.hour * 60 + w.minute);
}

/** `from` plus `hours` of business time. */
export function addBusinessHours(from: Date, hours: number): Date {
  let remaining = Math.max(0, Math.round(hours * 60));
  let t = nextBusinessStart(from);
  for (let i = 0; i < 400 && remaining > 0; i++) {
    t = nextBusinessStart(t);
    const take = Math.min(remaining, Math.max(1, minutesToClose(t)));
    t = new Date(t.getTime() + take * 60 * 1000);
    remaining -= take;
  }
  return t;
}

/** "Mon, Oct 5, 9:00 AM PT" for emails, where the reader's zone is unknown. */
export function formatSupportTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: SUPPORT_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${s} PT`;
}

/** "Due in 3h", "Overdue 2d 4h": for staff lists. */
export function dueLabel(dueAt: string | null, now: Date = new Date()): { text: string; overdue: boolean } | null {
  if (!dueAt) return null;
  const diff = new Date(dueAt).getTime() - now.getTime();
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3_600_000);
  const d = Math.floor(h / 24);
  const span = d > 0 ? `${d}d ${h % 24}h` : h > 0 ? `${h}h` : `${Math.max(1, Math.floor(abs / 60_000))}m`;
  return diff >= 0 ? { text: `Due in ${span}`, overdue: false } : { text: `Overdue ${span}`, overdue: true };
}
