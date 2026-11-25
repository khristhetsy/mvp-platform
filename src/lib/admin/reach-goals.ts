// Reach goal vs actual: the goals an admin sets on Feature Controls, and the
// week and month buckets the actual counts are tallied into.
//
// Everything here is pure and client safe. Weeks run Monday to Sunday and both
// weeks and months are read in Pacific time (PT), the platform clock. The counts
// themselves are loaded in reach-goal-actuals.ts.

import { ptDate } from "@/lib/time/pt-day-diff";

/** A goal is a whole number above zero, or null when no goal has been set. */
export type ReachGoalSet = { sentWeek: number | null; openedWeek: number | null; sentMonth: number | null; openedMonth: number | null };
export type ReachGoalSection = "intro" | "auto";
export type ReachGoals = Record<ReachGoalSection, ReachGoalSet>;

export const REACH_GOAL_MAX = 100_000;
export const REACH_GOAL_FIELDS = ["sentWeek", "openedWeek", "sentMonth", "openedMonth"] as const satisfies ReadonlyArray<keyof ReachGoalSet>;

const emptySet = (): ReachGoalSet => ({ sentWeek: null, openedWeek: null, sentMonth: null, openedMonth: null });
export const emptyReachGoals = (): ReachGoals => ({ intro: emptySet(), auto: emptySet() });

function cleanGoal(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  return n >= 1 ? Math.min(REACH_GOAL_MAX, n) : null;
}

/** Stored or submitted goals, made safe: anything that is not a whole number above zero becomes "no goal". */
export function normalizeReachGoals(value: unknown): ReachGoals {
  const out = emptyReachGoals();
  if (!value || typeof value !== "object") return out;
  for (const section of ["intro", "auto"] as const) {
    const raw = (value as Record<string, unknown>)[section];
    if (!raw || typeof raw !== "object") continue;
    for (const f of REACH_GOAL_FIELDS) out[section][f] = cleanGoal((raw as Record<string, unknown>)[f]);
  }
  return out;
}

// ── Periods ──────────────────────────────────────────────────────────────────

export type ReachPeriodKind = "week" | "month";
/** `key` is the Monday (YYYY-MM-DD) of a week, or YYYY-MM for a month, in PT. */
export type ReachPeriod = { key: string; label: string; range: string; current: boolean };
export type ReachCounts = { sent: number; opened: number };
export type ReachPeriodRow = ReachPeriod & Record<ReachGoalSection, ReachCounts>;
export type ReachActuals = { generatedAt: string; weeks: ReachPeriodRow[]; months: ReachPeriodRow[] };
/** One introduction or one automated send: when the email went out and when it was first opened. */
export type ReachEvent = { sentAt: string | null; openedAt: string | null };

export const REACH_PERIOD_COUNT = 4;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_MS = 86_400_000;

const parseDay = (day: string) => Date.parse(`${day}T00:00:00Z`);
const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The Monday (YYYY-MM-DD) of the PT week this instant falls in. */
export function weekKey(at: string | Date): string | null {
  const day = ptDate(at instanceof Date ? at : new Date(at));
  if (!day) return null;
  const ms = parseDay(day);
  const sinceMonday = (new Date(ms).getUTCDay() + 6) % 7;
  return toDay(ms - sinceMonday * DAY_MS);
}

/** The PT month (YYYY-MM) this instant falls in. */
export function monthKey(at: string | Date): string | null {
  const day = ptDate(at instanceof Date ? at : new Date(at));
  return day ? day.slice(0, 7) : null;
}

function shiftMonth(key: string, by: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "Nov 23 to 29", or "Oct 26 to Nov 1" when the week crosses a month. */
function weekRange(monday: string): string {
  const a = new Date(parseDay(monday));
  const b = new Date(parseDay(monday) + 6 * DAY_MS);
  const short = (d: Date) => MONTHS[d.getUTCMonth()].slice(0, 3);
  const end = a.getUTCMonth() === b.getUTCMonth() ? String(b.getUTCDate()) : `${short(b)} ${b.getUTCDate()}`;
  return `${short(a)} ${a.getUTCDate()} to ${end}`;
}

/** The current period and the ones before it, newest first. */
export function buildPeriods(kind: ReachPeriodKind, now: Date, count = REACH_PERIOD_COUNT): ReachPeriod[] {
  const out: ReachPeriod[] = [];
  if (kind === "week") {
    const first = weekKey(now);
    if (!first) return out;
    for (let i = 0; i < count; i++) {
      const key = toDay(parseDay(first) - i * 7 * DAY_MS);
      const range = weekRange(key);
      out.push({ key, range, label: i === 0 ? `This week (${range})` : range, current: i === 0 });
    }
    return out;
  }
  const first = monthKey(now);
  if (!first) return out;
  const thisYear = first.slice(0, 4);
  for (let i = 0; i < count; i++) {
    const key = shiftMonth(first, -i);
    const name = MONTHS[Number(key.slice(5, 7)) - 1];
    const named = key.slice(0, 4) === thisYear ? name : `${name} ${key.slice(0, 4)}`;
    out.push({ key, range: i === 0 ? `${named} to date` : named, label: i === 0 ? `${named} (to date)` : named, current: i === 0 });
  }
  return out;
}

/**
 * Sent and opened per period. A send counts in the period the email went out;
 * an open counts in the period the email was first opened, which can be later.
 */
export function tally(events: ReachEvent[], periods: ReachPeriod[], kind: ReachPeriodKind): ReachCounts[] {
  const keyOf = kind === "week" ? weekKey : monthKey;
  const index = new Map(periods.map((p, i) => [p.key, i]));
  const counts = periods.map(() => ({ sent: 0, opened: 0 }));
  for (const e of events) {
    const s = e.sentAt ? index.get(keyOf(e.sentAt) ?? "") : undefined;
    if (s !== undefined) counts[s].sent += 1;
    const o = e.sentAt && e.openedAt ? index.get(keyOf(e.openedAt) ?? "") : undefined;
    if (o !== undefined) counts[o].opened += 1;
  }
  return counts;
}

export function buildActuals(events: Record<ReachGoalSection, ReachEvent[]>, now: Date): ReachActuals {
  const rows = (kind: ReachPeriodKind): ReachPeriodRow[] => {
    const periods = buildPeriods(kind, now);
    const intro = tally(events.intro, periods, kind);
    const auto = tally(events.auto, periods, kind);
    return periods.map((p, i) => ({ ...p, intro: intro[i], auto: auto[i] }));
  };
  return { generatedAt: now.toISOString(), weeks: rows("week"), months: rows("month") };
}

/**
 * The earliest instant any shown period can include, with a day to spare so the
 * PT boundary is always covered. Used as the lower bound when loading.
 */
export function reachWindowStart(now: Date, count = REACH_PERIOD_COUNT): string {
  const months = buildPeriods("month", now, count);
  const weeks = buildPeriods("week", now, count);
  const oldest = [months.length ? `${months[months.length - 1].key}-01` : null, weeks.length ? weeks[weeks.length - 1].key : null]
    .filter((v): v is string => Boolean(v))
    .sort()[0];
  return new Date((oldest ? parseDay(oldest) : now.getTime()) - DAY_MS).toISOString();
}

/** Actual against goal. Null when no goal is set: there is nothing to measure against. */
export function goalProgress(actual: number, goal: number | null): { percent: number; met: boolean; remaining: number } | null {
  if (goal === null || goal < 1) return null;
  return { percent: Math.min(100, (actual / goal) * 100), met: actual >= goal, remaining: Math.max(0, goal - actual) };
}
