// Cadence token parsing + quiet-hours / digest scheduling. All time comparisons
// are done in the admin's configured timezone.
//
// Tokens: daily_0630 | after_2h|4h|8h | after_5d|7d | weekly_mon|fri

export type ParsedCadence =
  | { type: "daily"; hour: number; minute: number }
  | { type: "after"; ms: number }
  | { type: "weekly"; weekday: number; hour: number; minute: number } // weekday 0=Sun..6=Sat
  | { type: "unknown" };

const WEEKDAY_TOKENS: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

export function parseCadence(token: string | null | undefined): ParsedCadence {
  if (!token) return { type: "unknown" };
  const daily = /^daily_(\d{2})(\d{2})$/.exec(token);
  if (daily) return { type: "daily", hour: Number(daily[1]), minute: Number(daily[2]) };

  const afterH = /^after_(\d+)h$/.exec(token);
  if (afterH) return { type: "after", ms: Number(afterH[1]) * 3600_000 };

  const afterD = /^after_(\d+)d$/.exec(token);
  if (afterD) return { type: "after", ms: Number(afterD[1]) * 86_400_000 };

  const weekly = /^weekly_([a-z]{3})$/.exec(token);
  if (weekly && weekday(weekly[1]) != null) {
    return { type: "weekly", weekday: weekday(weekly[1]) as number, hour: 9, minute: 0 };
  }
  return { type: "unknown" };
}

function weekday(tok: string): number | undefined {
  return WEEKDAY_TOKENS[tok];
}

/** Milliseconds threshold for an `after_*` cadence (0 for non-threshold tokens). */
export function cadenceThresholdMs(token: string | null | undefined): number {
  const p = parseCadence(token);
  return p.type === "after" ? p.ms : 0;
}

/** Local wall-clock parts for `now` in the given IANA timezone. */
export function zonedParts(now: Date, timezone: string): { hour: number; minute: number; weekday: number } {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, hour12: false, hour: "2-digit", minute: "2-digit", weekday: "short",
    });
    const parts = fmt.formatToParts(now);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const wdName = (parts.find((p) => p.type === "weekday")?.value ?? "Sun").toLowerCase().slice(0, 3);
    const weekdayNum = WEEKDAY_TOKENS[wdName] ?? 0;
    return { hour, minute, weekday: weekdayNum };
  } catch {
    // Bad timezone → fall back to UTC.
    return { hour: now.getUTCHours(), minute: now.getUTCMinutes(), weekday: now.getUTCDay() };
  }
}

function parseTimeStr(t: string): { hour: number; minute: number } {
  const [h, m] = t.split(":");
  return { hour: Number(h) || 0, minute: Number(m) || 0 };
}

/**
 * Whether `now` falls inside the admin's quiet-hours window (timezone-aware).
 * Handles windows that wrap past midnight (e.g. 21:00 → 07:00).
 */
export function isWithinQuietHours(
  settings: { quiet_hours_on: boolean; quiet_start: string; quiet_end: string; timezone: string },
  now: Date = new Date(),
): boolean {
  if (!settings.quiet_hours_on) return false;
  const { hour, minute } = zonedParts(now, settings.timezone);
  const cur = hour * 60 + minute;
  const s = parseTimeStr(settings.quiet_start);
  const e = parseTimeStr(settings.quiet_end);
  const start = s.hour * 60 + s.minute;
  const end = e.hour * 60 + e.minute;
  if (start === end) return false;
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}

/**
 * Whether a `daily_HHMM` reminder is due for this cron tick. `slotMinutes` is the
 * cron cadence (e.g. 30) — the reminder fires on the first tick at/after its time
 * within the slot, and dedupe-per-day prevents repeats.
 */
export function isDailyDue(token: string, timezone: string, now: Date = new Date(), slotMinutes = 30): boolean {
  const p = parseCadence(token);
  if (p.type !== "daily") return false;
  const { hour, minute } = zonedParts(now, timezone);
  const cur = hour * 60 + minute;
  const target = p.hour * 60 + p.minute;
  return cur >= target && cur < target + slotMinutes;
}

/** Whether a `weekly_xxx` reminder is due (its weekday, at/after ~09:00 local). */
export function isWeeklyDue(token: string, timezone: string, now: Date = new Date(), slotMinutes = 30): boolean {
  const p = parseCadence(token);
  if (p.type !== "weekly") return false;
  const { hour, minute, weekday: wd } = zonedParts(now, timezone);
  if (wd !== p.weekday) return false;
  const cur = hour * 60 + minute;
  const target = p.hour * 60 + p.minute;
  return cur >= target && cur < target + slotMinutes;
}

/** Dedupe-window key suffix for a cadence, so a reminder fires once per window. */
export function windowKey(token: string | null | undefined, now: Date = new Date()): string {
  const p = parseCadence(token);
  const d = now.toISOString().slice(0, 10); // YYYY-MM-DD
  if (p.type === "weekly") {
    // ISO week number
    const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dayNum = (dt.getUTCDay() + 6) % 7;
    dt.setUTCDate(dt.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
    const week = 1 + Math.round(((dt.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
    return `${dt.getUTCFullYear()}W${week}`;
  }
  if (p.type === "after") {
    // Window = threshold bucket within the day so it repeats per-window, not per-tick.
    const bucketH = Math.max(1, Math.round(p.ms / 3600_000));
    const hourBucket = Math.floor(now.getUTCHours() / bucketH);
    return `${d}#${hourBucket * bucketH}h`;
  }
  return d;
}
