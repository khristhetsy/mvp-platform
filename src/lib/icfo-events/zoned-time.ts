/**
 * Event schedule times are typed as wall-clock times in the EVENT's timezone
 * (e.g. "12:00 PM Pacific"), not the admin's computer timezone. These helpers
 * convert between a <input type="datetime-local"> value and a UTC ISO string
 * using an IANA zone, with no extra dependency (Intl only).
 *
 * When no timezone is given they fall back to the runtime's local zone, which
 * matches the old behaviour for events that never had a timezone set.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** Offset (ms) of `timeZone` from UTC at the instant `date`. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function isValidZone(timeZone: string | null | undefined): timeZone is string {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** "2026-10-20T12:00" typed in `timeZone` → UTC ISO string (or null if empty/invalid). */
export function zonedInputToIso(local: string, timeZone?: string | null): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local ?? "");
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  if (!isValidZone(timeZone)) {
    const dt = new Date(y, mo - 1, d, h, mi);
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
  }
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes settle the offset correctly around DST transitions.
  let ts = wallAsUtc - zoneOffsetMs(new Date(wallAsUtc), timeZone);
  ts = wallAsUtc - zoneOffsetMs(new Date(ts), timeZone);
  return new Date(ts).toISOString();
}

/** UTC ISO string → "2026-10-20T12:00" as the wall-clock time in `timeZone`. */
export function isoToZonedInput(iso: string | null | undefined, timeZone?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (!isValidZone(timeZone)) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const w = new Date(d.getTime() + zoneOffsetMs(d, timeZone));
  return `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}T${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}`;
}

/** Short zone name at that instant, e.g. "PDT" / "PST". */
export function zoneAbbrev(iso: string | null | undefined, timeZone?: string | null): string | null {
  if (!iso || !isValidZone(timeZone)) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return (
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value ?? null
  );
}

/** Hero date line: one date when start and end share a day in the event zone. */
export function formatEventDateRange(
  start: string | null,
  end: string | null,
  timeZone?: string | null,
  locale?: string,
): string {
  if (!start) return "Date to be announced";
  const tz = isValidZone(timeZone) ? timeZone : undefined;
  const s = new Date(start);
  const full: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: tz };
  const time: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZone: tz };
  const abbr = zoneAbbrev(start, tz);
  const startTime = `${s.toLocaleTimeString(locale, time)}${abbr ? ` ${abbr}` : ""}`;
  if (!end) return `${s.toLocaleDateString(locale, full)} · ${startTime}`;
  const e = new Date(end);
  const sameDay = isoToZonedInput(start, tz).slice(0, 10) === isoToZonedInput(end, tz).slice(0, 10);
  if (sameDay) return `${s.toLocaleDateString(locale, full)} · ${startTime}`;
  const short: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", timeZone: tz };
  const long: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric", timeZone: tz };
  return `${s.toLocaleDateString(locale, short)} – ${e.toLocaleDateString(locale, long)}`;
}
