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

/**
 * Fields the native Date#toLocale*String methods use when called with no options
 * (ECMA-402 ToDateTimeOptions: toLocaleString = date + time, toLocaleDateString = date,
 * toLocaleTimeString = time). Passing these explicitly gives the same output.
 */
const DEFAULT_FIELDS = {
  string: { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" },
  date: { year: "numeric", month: "numeric", day: "numeric" },
  time: { hour: "numeric", minute: "numeric", second: "numeric" },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

type DefaultKind = keyof typeof DEFAULT_FIELDS;

/**
 * One formatter per (kind, locale, zone), built once. Creating an Intl.DateTimeFormat
 * costs far more than formatting with one, and the plain `date.toLocaleString()` call
 * runs for every date on a page. A small cap keeps the map from growing without bound.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>();
const FORMATTER_CACHE_MAX = 200;

function localeKey(locales: Intl.LocalesArgument | undefined): string {
  if (locales === undefined) return "";
  return Array.isArray(locales) ? locales.join(",") : String(locales);
}

function formatWithDefaults(
  Ctor: typeof Intl.DateTimeFormat,
  kind: DefaultKind,
  locales: Intl.LocalesArgument | undefined,
  zone: string | undefined,
  date: Date,
): string {
  const key = `${kind}|${localeKey(locales)}|${zone ?? ""}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    const options: Intl.DateTimeFormatOptions = zone === undefined ? { ...DEFAULT_FIELDS[kind] } : { ...DEFAULT_FIELDS[kind], timeZone: zone };
    formatter = new Ctor(locales, options);
    if (formatterCache.size >= FORMATTER_CACHE_MAX) formatterCache.clear();
    formatterCache.set(key, formatter);
  }
  return formatter.format(date);
}

export function installPlatformTimeZoneDefaults(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  if (g[FLAG]) return;
  g[FLAG] = true;

  const Orig = Intl.DateTimeFormat;
  const proto = Date.prototype;
  const origString = proto.toLocaleString;
  const origDate = proto.toLocaleDateString;
  const origTime = proto.toLocaleTimeString;
  // The no-options call is by far the most common, and passing a zone through options makes
  // the engine build a new formatter on every call. That path uses a cached formatter instead.
  // Calls with options, and invalid dates, keep the native path.
  proto.toLocaleString = function (this: Date, locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
    if (options?.timeZone) return origString.call(this, locales, options);
    if (options === undefined && !Number.isNaN(this.getTime())) return formatWithDefaults(Orig, "string", locales, PLATFORM_TZ, this);
    return origString.call(this, locales, opts(options, zoneFor(this, dateOnly(options, true))));
  };
  proto.toLocaleDateString = function (this: Date, locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
    if (options?.timeZone) return origDate.call(this, locales, options);
    const zone = zoneFor(this, dateOnly(options, false));
    if (options === undefined && !Number.isNaN(this.getTime())) return formatWithDefaults(Orig, "date", locales, zone, this);
    return origDate.call(this, locales, opts(options, zone));
  };
  proto.toLocaleTimeString = function (this: Date, locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
    if (options?.timeZone) return origTime.call(this, locales, options);
    if (options === undefined && !Number.isNaN(this.getTime())) return formatWithDefaults(Orig, "time", locales, PLATFORM_TZ, this);
    return origTime.call(this, locales, opts(options, PLATFORM_TZ));
  };

  const Patched = function (this: unknown, locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
    if (options?.timeZone) return new Orig(locales, options);
    const pt = new Orig(locales, { ...(options ?? {}), timeZone: PLATFORM_TZ });
    if (!dateOnly(options, false)) return pt;
    // Date-only formatter: pick the zone per value so plain dates keep their day.
    // The extra formatters are built on first use, not on every construction.
    let ptBase: Intl.DateTimeFormat | undefined;
    let utc: Intl.DateTimeFormat | undefined;
    let local: Intl.DateTimeFormat | undefined;
    const pick = (v?: Date | number) => {
      const d = v === undefined ? new Date() : new Date(v);
      const z = zoneFor(d, true);
      if (z === "UTC") return (utc ??= new Orig(locales, { ...(options ?? {}), timeZone: "UTC" }));
      if (z === undefined) return (local ??= new Orig(locales, options));
      return (ptBase ??= new Orig(locales, { ...(options ?? {}), timeZone: PLATFORM_TZ }));
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
