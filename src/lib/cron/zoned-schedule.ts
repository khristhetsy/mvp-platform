/**
 * Custom schedules set on Admin, System, Scheduled jobs. Unlike vercel.json
 * (always UTC), a custom schedule is kept in Paris time, so "Daily 11:00" stays
 * 11:00 across the summer and winter clock changes. Pure, so the edit dialog,
 * the dispatcher and the tests read schedules the same way.
 */
import { DISPLAY_TZ, parseCron, type ParsedCron } from "@/lib/cron/schedule";

type Parts = { minute: number; hour: number; dom: number; month: number; dow: number };
type Field = ParsedCron["fields"][number];

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

/** Minutes the zone is ahead of UTC at the given instant (Paris: 60 or 120). */
export function zoneOffsetMinutes(at: Date, tz: string = DISPLAY_TZ): number {
  let f = offsetFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    offsetFormatters.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  const base = new Date(at);
  base.setUTCSeconds(0, 0);
  return Math.round((asUtc - base.getTime()) / 60_000);
}

function partsAt(utcMs: number, offsetMin: number): Parts {
  const d = new Date(utcMs + offsetMin * 60_000);
  return { minute: d.getUTCMinutes(), hour: d.getUTCHours(), dom: d.getUTCDate(), month: d.getUTCMonth() + 1, dow: d.getUTCDay() };
}

const hit = (f: Field, v: number) => f.any || f.values.has(v);

function matches(c: ParsedCron, p: Parts): boolean {
  const [mi, h, dom, mon, dow] = c.fields as [Field, Field, Field, Field, Field];
  if (!hit(mi, p.minute) || !hit(h, p.hour) || !hit(mon, p.month)) return false;
  if (!dom.any && !dow.any) return dom.values.has(p.dom) || dow.values.has(p.dow);
  return hit(dom, p.dom) && hit(dow, p.dow);
}

/** The next `count` times the expressions fire in the zone, strictly after `from`, within 31 days. */
export function nextRunsInZone(exprs: string[], from: Date, count = 1, tz: string = DISPLAY_TZ): Date[] {
  const parsed = exprs.map(parseCron).filter((c): c is ParsedCron => c !== null);
  const out: Date[] = [];
  if (parsed.length === 0) return out;
  const start = new Date(from);
  start.setUTCSeconds(0, 0);
  let ms = start.getTime();
  let offsetHour = -1;
  let offset = 0;
  for (let i = 0; i < 31 * 24 * 60 && out.length < count; i += 1) {
    ms += 60_000;
    const hourKey = Math.floor(ms / 3_600_000);
    if (hourKey !== offsetHour) {
      offsetHour = hourKey;
      offset = zoneOffsetMinutes(new Date(ms), tz);
    }
    const p = partsAt(ms, offset);
    if (parsed.some((c) => matches(c, p))) out.push(new Date(ms));
  }
  return out;
}

/** "2026-09-28T09:30" read as a wall clock time in the zone, as an instant. */
export function zonedLocalToUtc(local: string, tz: string = DISPLAY_TZ): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!m) return null;
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  if (Number.isNaN(guess)) return null;
  // Two passes settle the offset on either side of a clock change.
  let at = guess - zoneOffsetMinutes(new Date(guess), tz) * 60_000;
  at = guess - zoneOffsetMinutes(new Date(at), tz) * 60_000;
  return new Date(at);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The instant as a "YYYY-MM-DDTHH:MM" wall clock value in the zone (for a datetime input). */
export function utcToZonedLocal(at: Date, tz: string = DISPLAY_TZ): string {
  const d = new Date(at.getTime() + zoneOffsetMinutes(at, tz) * 60_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// ---- The edit dialog's form <-> cron expressions (in the zone) ----

export type RepeatMode = "every" | "hourly" | "daily" | "weekly";
export type ScheduleForm = {
  mode: RepeatMode;
  /** Minutes between runs, for "every". */
  every: number;
  /** Minute past the hour, for "hourly". */
  minute: number;
  /** "HH:MM" wall clock times, for "daily" and "weekly". */
  times: string[];
  /** 0 = Sunday, for "weekly". */
  days: number[];
};

export const EVERY_OPTIONS = [5, 10, 15, 30];

export const DEFAULT_FORM: ScheduleForm = { mode: "daily", every: 15, minute: 0, times: ["09:00"], days: [1] };

function parseTime(t: string): [number, number] | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h <= 23 && mi <= 59 ? [h, mi] : null;
}

/** Cron expressions for the form, one per distinct minute. Null when the form is incomplete. */
export function cronFromForm(f: ScheduleForm): string[] | null {
  if (f.mode === "every") return EVERY_OPTIONS.includes(f.every) ? [`*/${f.every} * * * *`] : null;
  if (f.mode === "hourly") return Number.isInteger(f.minute) && f.minute >= 0 && f.minute <= 59 ? [`${f.minute} * * * *`] : null;
  const times = f.times.map(parseTime);
  if (times.length === 0 || times.some((t) => !t)) return null;
  const days = [...new Set(f.days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (f.mode === "weekly" && days.length === 0) return null;
  const byMinute = new Map<number, number[]>();
  for (const t of times as Array<[number, number]>) byMinute.set(t[1], [...new Set([...(byMinute.get(t[1]) ?? []), t[0]])]);
  const dow = f.mode === "weekly" ? days.join(",") : "*";
  return [...byMinute.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([minute, hours]) => `${minute} ${hours.sort((a, b) => a - b).join(",")} * * ${dow}`);
}

/** The form for zone-local expressions, or null when they aren't a shape the form can show. */
export function formFromCron(exprs: string[]): ScheduleForm | null {
  if (exprs.length === 0) return null;
  const one = exprs[0]!.trim().split(/\s+/);
  if (exprs.length === 1 && one.length === 5 && one[1] === "*" && one.slice(2).every((x) => x === "*")) {
    const step = /^\*\/(\d+)$/.exec(one[0]!);
    if (step && EVERY_OPTIONS.includes(Number(step[1]))) return { ...DEFAULT_FORM, mode: "every", every: Number(step[1]) };
    if (/^\d+$/.test(one[0]!)) return { ...DEFAULT_FORM, mode: "hourly", minute: Number(one[0]) };
    return null;
  }
  const times: string[] = [];
  let dowAll: string | null = null;
  for (const e of exprs) {
    const p = e.trim().split(/\s+/);
    if (p.length !== 5 || !/^\d+$/.test(p[0]!) || !/^\d+(,\d+)*$/.test(p[1]!) || p[2] !== "*" || p[3] !== "*") return null;
    if (dowAll !== null && dowAll !== p[4]) return null;
    dowAll = p[4]!;
    for (const h of p[1]!.split(",")) times.push(`${pad(Number(h))}:${pad(Number(p[0]))}`);
  }
  times.sort();
  if (dowAll === "*") return { ...DEFAULT_FORM, mode: "daily", times };
  if (!/^\d(,\d)*$/.test(dowAll ?? "")) return null;
  return { ...DEFAULT_FORM, mode: "weekly", times, days: dowAll!.split(",").map((d) => Number(d) % 7) };
}

/**
 * The form for a job's vercel.json (UTC) schedule, read in the zone on `on`, so
 * the dialog opens on what the job does today. Falls back to the default form.
 */
export function formFromUtcDefault(utcExprs: string[], on: Date, tz: string = DISPLAY_TZ): ScheduleForm {
  const offset = zoneOffsetMinutes(on, tz);
  const local: string[] = [];
  for (const e of utcExprs) {
    const p = e.trim().split(/\s+/);
    if (p.length !== 5) return DEFAULT_FORM;
    if (p[1] === "*" || !/^\d+$/.test(p[0]!) || !/^\d+(,\d+)*$/.test(p[1]!)) {
      local.push(e); // every N min and hourly read the same in any zone (whole-hour offsets)
      continue;
    }
    const mins = p[1]!.split(",").map((h) => Number(h) * 60 + Number(p[0]) + offset);
    const dayShift = mins.map((m) => Math.floor(m / 1440));
    if (new Set(dayShift).size > 1) return DEFAULT_FORM;
    const shift = dayShift[0]!;
    const hours = mins.map((m) => Math.floor((((m % 1440) + 1440) % 1440) / 60));
    const minute = (((mins[0]! % 60) + 60) % 60);
    const dow = p[4] === "*" ? "*" : p[4]!.split(",").map((d) => (((Number(d) + shift) % 7) + 7) % 7).join(",");
    local.push(`${minute} ${hours.join(",")} ${p[2]} ${p[3]} ${dow}`);
  }
  return formFromCron(local) ?? DEFAULT_FORM;
}

/** A custom schedule must parse and run at most every 5 minutes. */
export function validCustomCron(exprs: string[]): boolean {
  if (exprs.length === 0 || exprs.length > 6) return false;
  return exprs.every((e) => {
    const c = parseCron(e);
    if (!c) return false;
    const minute = c.fields[0]!;
    if (minute.any) return false;
    const values = [...minute.values].sort((a, b) => a - b);
    for (let i = 1; i < values.length; i += 1) if (values[i]! - values[i - 1]! < 5) return false;
    return values.length === 1 || 60 - values[values.length - 1]! + values[0]! >= 5;
  });
}

// ---- When the dispatcher should start a job ----

export type OverrideRow = {
  job: string;
  cron: string | null;
  next_run_at: string | null;
  last_dispatch_at: string | null;
  updated_at: string;
};

export function splitCron(cron: string | null): string[] {
  return (cron ?? "").split(";").map((s) => s.trim()).filter(Boolean);
}

/**
 * Whether a job is due now: its one-off time has passed, or its custom
 * schedule fired since it was last started (or since the schedule was saved).
 * Several missed firings still start the job once.
 */
export function dueNow(row: OverrideRow, now: Date, tz: string = DISPLAY_TZ): { run: boolean; oneOff: boolean } {
  const oneOff = Boolean(row.next_run_at && new Date(row.next_run_at).getTime() <= now.getTime());
  let recurring = false;
  const exprs = splitCron(row.cron);
  if (exprs.length) {
    const since = new Date(row.last_dispatch_at ?? row.updated_at);
    const next = nextRunsInZone(exprs, since, 1, tz)[0];
    recurring = Boolean(next && next.getTime() <= now.getTime());
  }
  return { run: oneOff || recurring, oneOff };
}
