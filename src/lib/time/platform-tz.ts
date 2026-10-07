/**
 * One time zone for the whole platform: Pacific time (PT).
 *
 * Every date and time iCapOS shows (pages, emails, notifications, admin tools)
 * is displayed in this zone, so founders, investors and staff all read the same
 * clock. Stored instants stay in UTC in the database; only display changes.
 *
 * installPlatformTimeZoneDefaults() makes PT the default for any date
 * formatting that doesn't name a zone (Date#toLocaleString / DateString /
 * TimeString and Intl.DateTimeFormat). It runs on the server from
 * src/instrumentation.ts and in the browser from PlatformTimeZoneInit, so code
 * written without a zone still shows PT. Code that names a zone explicitly is
 * left alone.
 */
export const PLATFORM_TZ = "America/Los_Angeles";
export const PLATFORM_TZ_LABEL = "PT";

const FLAG = "__icaposPlatformTz";

const TIME_FIELDS = ["hour", "minute", "second", "timeStyle", "dayPeriod", "fractionalSecondDigits"] as const;

/** True when the options ask for a date only (no clock fields). */
function dateOnly(options: Intl.DateTimeFormatOptions | undefined, defaultHasTime: boolean): boolean {
  if (!options) return !defaultHasTime;
  if (TIME_FIELDS.some((k) => (options as Record<string, unknown>)[k] !== undefined)) return false;
  const hasDateFields = ["year", "month", "day", "weekday", "era", "dateStyle"].some((k) => (options as Record<string, unknown>)[k] !== undefined);
  return hasDateFields ? true : !defaultHasTime;
}

/**
 * Which zone to show a date in when the caller named none. Timestamps show in
 * PT. A plain calendar date (a due date stored as "2026-10-07", which becomes
 * midnight) keeps its own day: exact UTC midnight reads as UTC, exact local
 * midnight reads in the runtime's own zone. Without this a date-only value
 * would show one day early in PT.
 */
function zoneFor(d: Date, onlyDate: boolean): string | undefined {
  if (!onlyDate) return PLATFORM_TZ;
  const t = d.getTime();
  if (Number.isNaN(t)) return PLATFORM_TZ;
  if (t % 86_400_000 === 0) return "UTC";
  if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0) return undefined; // runtime local
  return PLATFORM_TZ;
}

function opts(options: Intl.DateTimeFormatOptions | undefined, zone: string | undefined): Intl.DateTimeFormatOptions | undefined {
  if (zone === undefined) return options;
  return { ...(options ?? {}), timeZone: zone };
}

export function installPlatformTimeZoneDefaults(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  if (g[FLAG]) return;
  g[FLAG] = true;

  const proto = Date.prototype;
  const origString = proto.toLocaleString;
  const origDate = proto.toLocaleDateString;
  const origTime = proto.toLocaleTimeString;
  proto.toLocaleString = function (this: Date, locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
    if (options?.timeZone) return origString.call(this, locales, options);
    return origString.call(this, locales, opts(options, zoneFor(this, dateOnly(options, true))));
  };
  proto.toLocaleDateString = function (this: Date, locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
    if (options?.timeZone) return origDate.call(this, locales, options);
    return origDate.call(this, locales, opts(options, zoneFor(this, dateOnly(options, false))));
  };
  proto.toLocaleTimeString = function (this: Date, locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
    if (options?.timeZone) return origTime.call(this, locales, options);
    return origTime.call(this, locales, opts(options, PLATFORM_TZ));
  };

  const Orig = Intl.DateTimeFormat;
  const Patched = function (this: unknown, locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
    if (options?.timeZone) return new Orig(locales, options);
    const pt = new Orig(locales, { ...(options ?? {}), timeZone: PLATFORM_TZ });
    if (!dateOnly(options, false)) return pt;
    // Date-only formatter: pick the zone per value so plain dates keep their day.
    const ptBase = new Orig(locales, { ...(options ?? {}), timeZone: PLATFORM_TZ });
    const utc = new Orig(locales, { ...(options ?? {}), timeZone: "UTC" });
    const local = new Orig(locales, options);
    const pick = (v?: Date | number) => {
      const d = v === undefined ? new Date() : new Date(v);
      const z = zoneFor(d, true);
      return z === "UTC" ? utc : z === undefined ? local : ptBase;
    };
    Object.defineProperty(pt, "format", { configurable: true, get: () => (v?: Date | number) => pick(v).format(v) });
    Object.defineProperty(pt, "formatToParts", { configurable: true, value: (v?: Date | number) => pick(v).formatToParts(v) });
    return pt;
  } as unknown as typeof Intl.DateTimeFormat;
  Object.setPrototypeOf(Patched, Orig);
  (Patched as unknown as { prototype: unknown }).prototype = Orig.prototype;
  Patched.supportedLocalesOf = Orig.supportedLocalesOf.bind(Orig);
  try {
    Object.defineProperty(Intl, "DateTimeFormat", { value: Patched, writable: true, configurable: true });
  } catch {
    // Intl not writable in this runtime: explicit PLATFORM_TZ uses still apply.
  }
}

/** "Oct 9, 2026, 12:00 PM PT" style helper for new code. */
export function formatPlatformDateTime(value: Date | string | number, options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }): string {
  const d = value instanceof Date ? value : new Date(value);
  return `${new Intl.DateTimeFormat("en-US", { ...options, timeZone: PLATFORM_TZ }).format(d)} ${PLATFORM_TZ_LABEL}`;
}
