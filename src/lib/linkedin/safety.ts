// Invite safety rules for LinkedIn outreach. Pure functions: no database, no network.
// The numbers are proposals from vendor guidance (Snov.io, La Growth Machine), not tested
// limits. The pilot tunes them. Invites are the riskiest LinkedIn action, so they get their own rules.

export type SafetyLevel = "careful" | "standard" | "custom";

export type LevelSpec = {
  /** Invites a day once the ramp is finished. */
  daily: number;
  /** Invites in any rolling 7 days. */
  weekly: number;
  /** Invites on day 1 of the ramp. */
  rampStart: number;
};

export const LEVELS: Record<Exclude<SafetyLevel, "custom">, LevelSpec> = {
  careful: { daily: 10, weekly: 40, rampStart: 3 },
  standard: { daily: 20, weekly: 80, rampStart: 5 },
};

export const RAMP_DAYS = 21;
export const DEFAULT_MANUAL_ALLOWANCE = 5;
export const ACCEPTANCE_FLOOR = 0.2;
export const ACCEPTANCE_MIN_SAMPLE = 50;
export const PENDING_WITHDRAW_DAYS = 21;
export const WORKING_HOURS = { start: 9, end: 17 } as const;

export type AccountSafety = {
  level: SafetyLevel;
  customDaily?: number | null;
  customWeekly?: number | null;
  manualAllowance?: number | null;
  /** When the warm up began. Null means it has not started: nothing may send. */
  warmUpStartedAt: Date | string | null;
};

const MS_DAY = 86_400_000;

/** Day of the warm up, 1 based. 0 when it has not started or starts in the future. */
export function warmUpDay(startedAt: Date | string | null, now: Date): number {
  if (!startedAt) return 0;
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);
  if (Number.isNaN(start.getTime()) || start.getTime() > now.getTime()) return 0;
  return Math.floor((now.getTime() - start.getTime()) / MS_DAY) + 1;
}

/** Limits at full speed for an account. Custom limits are clamped to the Standard ceiling. */
export function levelSpec(a: Pick<AccountSafety, "level" | "customDaily" | "customWeekly">): LevelSpec {
  if (a.level === "custom") {
    const daily = clamp(Math.round(a.customDaily ?? LEVELS.standard.daily), 1, LEVELS.standard.daily);
    const weekly = clamp(Math.round(a.customWeekly ?? LEVELS.standard.weekly), 1, LEVELS.standard.weekly);
    return { daily, weekly, rampStart: Math.min(LEVELS.standard.rampStart, daily) };
  }
  return LEVELS[a.level];
}

/** Total invites allowed today (automatic plus the allowance you keep for sending by hand). */
export function dailyTotalCap(a: AccountSafety, now: Date): number {
  const day = warmUpDay(a.warmUpStartedAt, now);
  if (day === 0) return 0;
  const spec = levelSpec(a);
  const progress = Math.min(day - 1, RAMP_DAYS - 1) / (RAMP_DAYS - 1);
  return Math.round(spec.rampStart + (spec.daily - spec.rampStart) * progress);
}

/** The part of the day's total kept for invites you send yourself. Never more than half of it. */
export function manualReserve(a: AccountSafety, now: Date): number {
  const total = dailyTotalCap(a, now);
  const wanted = Math.max(0, Math.round(a.manualAllowance ?? DEFAULT_MANUAL_ALLOWANCE));
  return Math.min(wanted, Math.floor(total / 2));
}

/** Automatic invites allowed today. */
export function dailyAutoCap(a: AccountSafety, now: Date): number {
  return Math.max(0, dailyTotalCap(a, now) - manualReserve(a, now));
}

/** Automatic invites allowed in any rolling 7 days. The reserve counts toward the weekly limit too. */
export function weeklyAutoCap(a: AccountSafety, now: Date): number {
  const total = dailyTotalCap(a, now);
  if (total === 0) return 0;
  const weekly = Math.min(levelSpec(a).weekly, total * 5);
  return Math.max(0, weekly - manualReserve(a, now) * 5);
}

export type WorkingHoursInput = { timeZone: string; start?: number; end?: number; weekdaysOnly?: boolean };

/** True on a weekday inside the owner's working hours, in the owner's time zone. */
export function inWorkingHours(now: Date, o: WorkingHoursInput): boolean {
  const start = o.start ?? WORKING_HOURS.start;
  const end = o.end ?? WORKING_HOURS.end;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", { timeZone: o.timeZone, weekday: "short", hour: "numeric", hour12: false }).formatToParts(now);
  } catch {
    return false; // an unknown time zone never sends
  }
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "-1") % 24;
  if ((o.weekdaysOnly ?? true) && (weekday === "Sat" || weekday === "Sun")) return false;
  return hour >= start && hour < end;
}

export type SendDecision = { ok: true } | { ok: false; reason: "paused" | "not_started" | "daily_cap" | "weekly_cap" | "outside_hours" };

/** May the worker send one more automatic invite right now? */
export function canSendInvite(args: {
  account: AccountSafety & { status: "not_connected" | "connected" | "paused" | "warning"; timeZone: string };
  now: Date;
  sentToday: number;
  sentLast7Days: number;
}): SendDecision {
  const { account, now } = args;
  if (account.status !== "connected") return { ok: false, reason: "paused" };
  if (warmUpDay(account.warmUpStartedAt, now) === 0) return { ok: false, reason: "not_started" };
  if (!inWorkingHours(now, { timeZone: account.timeZone })) return { ok: false, reason: "outside_hours" };
  if (args.sentToday >= dailyAutoCap(account, now)) return { ok: false, reason: "daily_cap" };
  if (args.sentLast7Days >= weeklyAutoCap(account, now)) return { ok: false, reason: "weekly_cap" };
  return { ok: true };
}

/** True when a campaign should pause for review: enough invites sent and too few accepted. */
export function acceptanceTooLow(args: { invited: number; accepted: number; floor?: number; minSample?: number }): boolean {
  const floor = args.floor ?? ACCEPTANCE_FLOOR;
  const minSample = args.minSample ?? ACCEPTANCE_MIN_SAMPLE;
  if (args.invited < minSample) return false;
  return args.accepted / args.invited < floor;
}

/** Random gap before the next action, in minutes, between min and max. `rng` returns [0, 1). */
export function randomGapMinutes(rng: () => number = Math.random, min = 4, max = 18): number {
  return Math.round(min + (max - min) * rng());
}

/** True when a pending invite is old enough to withdraw. */
export function shouldWithdrawInvite(invitedAt: Date | string, now: Date, afterDays = PENDING_WITHDRAW_DAYS): boolean {
  const t = invitedAt instanceof Date ? invitedAt : new Date(invitedAt);
  if (Number.isNaN(t.getTime())) return false;
  return now.getTime() - t.getTime() >= afterDays * MS_DAY;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export type HubState = "ok" | "soon" | "expired";
/** How healthy the Social Media Hub LinkedIn connection is. "soon" means it ends within 7 days. */
export function hubTokenState(expiresAt: string | null | undefined, now: Date): HubState {
  if (!expiresAt) return "ok";
  const left = new Date(expiresAt).getTime() - now.getTime();
  if (left <= 0) return "expired";
  return left <= 7 * 86_400_000 ? "soon" : "ok";
}
