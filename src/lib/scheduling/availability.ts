import type {
  AvailabilityConfig,
  AvailabilitySettings,
  TimeInterval,
} from "./types";

/**
 * Pure availability engine. Given a date range, a user's weekly bookable hours,
 * and their busy intervals (from Google free/busy + local events), it returns the
 * open slots. No I/O — fully unit-testable.
 *
 * Timezones are handled with a fixed UTC offset for the range (resolved by
 * offsetMinutesForTimeZone). This is exact except across a DST boundary inside the
 * range, which is an acceptable v1 simplification for a short booking window.
 */

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/**
 * Minutes to ADD to UTC to get local time in `timeZone` at `date`
 * (e.g. America/New_York in winter → −300). Uses Intl; deterministic.
 */
export function offsetMinutesForTimeZone(timeZone: string, date: Date = new Date()): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const map: Record<string, string> = {};
    for (const part of dtf.formatToParts(date)) map[part.type] = part.value;
    const asUTC = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour === "24" ? "0" : map.hour),
      Number(map.minute),
      Number(map.second),
    );
    return Math.round((asUTC - date.getTime()) / MIN);
  } catch {
    return 0;
  }
}

/** Resolve saved settings into an engine config for a given moment. */
export function configFromSettings(
  settings: AvailabilitySettings,
  at: Date = new Date(),
): AvailabilityConfig {
  return {
    weeklyRules: settings.weeklyRules,
    slotMinutes: settings.slotMinutes,
    bufferMinutes: settings.bufferMinutes,
    timezoneOffsetMinutes: offsetMinutesForTimeZone(settings.timezone, at),
  };
}

/**
 * Expand weekly rules into concrete UTC working windows across [rangeStart, rangeEnd].
 */
export function expandWindows(
  rangeStart: Date,
  rangeEnd: Date,
  config: AvailabilityConfig,
): TimeInterval[] {
  const offMs = config.timezoneOffsetMinutes * MIN;
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();

  // Walk local calendar days. "Local midnight as pseudo-UTC" = Date.UTC(localY,M,D).
  const startLocal = new Date(startMs + offMs);
  let cursor = Date.UTC(
    startLocal.getUTCFullYear(),
    startLocal.getUTCMonth(),
    startLocal.getUTCDate(),
  );
  const endLocalMs = endMs + offMs;

  const windows: TimeInterval[] = [];
  while (cursor <= endLocalMs) {
    const weekday = new Date(cursor).getUTCDay();
    for (const rule of config.weeklyRules) {
      if (rule.weekday !== weekday) continue;
      // Convert local-pseudo-UTC window back to real UTC.
      const winStart = cursor + rule.startMinute * MIN - offMs;
      const winEnd = cursor + rule.endMinute * MIN - offMs;
      const s = Math.max(winStart, startMs);
      const e = Math.min(winEnd, endMs);
      if (e > s) {
        windows.push({ start: new Date(s).toISOString(), end: new Date(e).toISOString() });
      }
    }
    cursor += DAY;
  }
  return windows;
}

/**
 * Slice working windows into bookable slots, dropping any that are in the past or
 * overlap a busy interval (busy intervals are padded by the buffer on each side).
 */
export function computeOpenSlots(
  windows: TimeInterval[],
  busy: TimeInterval[],
  opts: { slotMinutes: number; bufferMinutes: number; now?: Date },
): TimeInterval[] {
  const slotMs = opts.slotMinutes * MIN;
  if (slotMs <= 0) return [];
  const bufMs = opts.bufferMinutes * MIN;
  const nowMs = (opts.now ?? new Date()).getTime();

  const busyMs = busy
    .map((b) => ({ s: Date.parse(b.start) - bufMs, e: Date.parse(b.end) + bufMs }))
    .filter((b) => Number.isFinite(b.s) && Number.isFinite(b.e));

  const slots: TimeInterval[] = [];
  for (const w of windows) {
    const wEnd = Date.parse(w.end);
    let s = Date.parse(w.start);
    while (s + slotMs <= wEnd) {
      const e = s + slotMs;
      if (s >= nowMs && !busyMs.some((b) => s < b.e && e > b.s)) {
        slots.push({ start: new Date(s).toISOString(), end: new Date(e).toISOString() });
      }
      s += slotMs;
    }
  }
  return slots;
}

/** End-to-end: open slots for a range given config + busy intervals. */
export function availableSlots(
  rangeStart: Date,
  rangeEnd: Date,
  config: AvailabilityConfig,
  busy: TimeInterval[],
  now: Date = new Date(),
): TimeInterval[] {
  const windows = expandWindows(rangeStart, rangeEnd, config);
  return computeOpenSlots(windows, busy, {
    slotMinutes: config.slotMinutes,
    bufferMinutes: config.bufferMinutes,
    now,
  });
}
