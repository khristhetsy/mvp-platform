/**
 * Founder social media post cycle and limit state (pure, no I/O).
 *
 * A founder's monthly cycle is 30 days counted from their signup date, with every
 * boundary at midnight Pacific time. Example: signup Sep 22 resets Oct 22, 00:00 PT.
 */
import { PLATFORM_TZ } from "@/lib/time/platform-tz";

export const CYCLE_DAYS = 30;
/** Show the "posts left" warning once this many or fewer remain. */
export const WARN_AT_REMAINING = 2;

const DAY_MS = 86_400_000;

type YMD = { y: number; m: number; d: number };

/** Calendar date of an instant as seen in Pacific time. */
export function ptDate(at: Date): YMD {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: PLATFORM_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

function dayNumber({ y, m, d }: YMD): number {
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

function fromDayNumber(n: number): YMD {
  const dt = new Date(n * DAY_MS);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** The instant of 00:00 Pacific on a calendar date (handles daylight saving). */
export function ptMidnight({ y, m, d }: YMD): Date {
  for (const offsetHours of [7, 8]) {
    const candidate = new Date(Date.UTC(y, m - 1, d, offsetHours));
    const seen = new Intl.DateTimeFormat("en-CA", { timeZone: PLATFORM_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(candidate);
    const get = (t: string) => Number(seen.find((p) => p.type === t)?.value);
    if (get("year") === y && get("month") === m && get("day") === d && get("hour") === 0) return candidate;
  }
  return new Date(Date.UTC(y, m - 1, d, 8));
}

export type CycleBounds = { start: Date; resetAt: Date };

/** The 30 day cycle containing `now`, counted from `signupAt`, in Pacific time. */
export function cycleBounds(signupAt: Date, now: Date = new Date()): CycleBounds {
  const signupDay = dayNumber(ptDate(signupAt));
  const today = dayNumber(ptDate(now));
  const elapsed = Math.max(0, today - signupDay);
  const startDay = signupDay + Math.floor(elapsed / CYCLE_DAYS) * CYCLE_DAYS;
  return { start: ptMidnight(fromDayNumber(startDay)), resetAt: ptMidnight(fromDayNumber(startDay + CYCLE_DAYS)) };
}

export type LimitState = "off" | "ok" | "warn" | "reached";

export type SocialUsage = {
  planType: string | null;
  enabled: boolean;
  /** null = unlimited */
  limit: number | null;
  used: number;
  /** null = unlimited */
  remaining: number | null;
  state: LimitState;
  cycleStart: string;
  resetAt: string;
};

export function remainingPosts(limit: number | null, used: number): number | null {
  if (limit === null) return null;
  return Math.max(0, limit - used);
}

export function limitState(enabled: boolean, limit: number | null, used: number): LimitState {
  if (!enabled) return "off";
  const left = remainingPosts(limit, used);
  if (left === null) return "ok";
  if (left === 0) return "reached";
  if (left <= WARN_AT_REMAINING) return "warn";
  return "ok";
}

/** How many of `wanted` new posts fit before the limit. Unlimited fits all. */
export function postsThatFit(limit: number | null, used: number, wanted: number): number {
  const left = remainingPosts(limit, used);
  return left === null ? wanted : Math.min(wanted, left);
}
