/**
 * Reading the cron expressions in vercel.json: when a job runs next, and how to
 * say its schedule in plain words. Pure, so the Scheduled jobs page and its
 * tests read expressions the same way.
 *
 * Vercel evaluates cron expressions in UTC. Everything shown to staff is
 * converted to a display time zone (Europe/Paris by default), so a job at
 * "0 19 * * *" reads "Daily 21:00" in summer and "Daily 20:00" in winter.
 */

export const DISPLAY_TZ = "Europe/Paris";

type Field = { any: boolean; values: Set<number> };

const RANGES: Array<[number, number]> = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day of month
  [1, 12], // month
  [0, 6], // day of week, 0 = Sunday
];

function parseField(src: string, [lo, hi]: [number, number]): Field | null {
  if (src === "*") return { any: true, values: new Set() };
  const values = new Set<number>();
  for (const part of src.split(",")) {
    const [range, stepStr] = part.split("/");
    const step = stepStr === undefined ? 1 : Number(stepStr);
    if (!Number.isInteger(step) || step < 1) return null;
    let from = lo;
    let to = hi;
    if (range !== "*") {
      const [a, b] = range!.split("-");
      from = Number(a);
      to = b === undefined ? (stepStr === undefined ? from : hi) : Number(b);
    }
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < lo || to > hi || from > to) return null;
    for (let v = from; v <= to; v += step) values.add(v === 7 && hi === 6 ? 0 : v);
  }
  return { any: false, values };
}

export type ParsedCron = { fields: Field[]; raw: string };

export function parseCron(expr: string): ParsedCron | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const fields: Field[] = [];
  for (let i = 0; i < 5; i += 1) {
    const f = parseField(parts[i]!, RANGES[i]!);
    if (!f) return null;
    fields.push(f);
  }
  return { fields, raw: expr.trim() };
}

const hit = (f: Field, v: number) => f.any || f.values.has(v);

function matches(c: ParsedCron, d: Date): boolean {
  const [mi, h, dom, mon, dow] = c.fields as [Field, Field, Field, Field, Field];
  if (!hit(mi, d.getUTCMinutes()) || !hit(h, d.getUTCHours()) || !hit(mon, d.getUTCMonth() + 1)) return false;
  // Standard cron: when both day fields are restricted, either may match.
  if (!dom.any && !dow.any) return dom.values.has(d.getUTCDate()) || dow.values.has(d.getUTCDay());
  return hit(dom, d.getUTCDate()) && hit(dow, d.getUTCDay());
}

/** The next time any of the expressions fires, strictly after `from`. Null if none within 8 days. */
export function nextRun(exprs: string[], from: Date = new Date()): Date | null {
  const parsed = exprs.map(parseCron).filter((c): c is ParsedCron => c !== null);
  if (parsed.length === 0) return null;
  const d = new Date(from);
  d.setUTCSeconds(0, 0);
  for (let i = 0; i < 8 * 24 * 60; i += 1) {
    d.setUTCMinutes(d.getUTCMinutes() + 1);
    if (parsed.some((c) => matches(c, d))) return new Date(d);
  }
  return null;
}

/** "21:00" for a UTC hour and minute, in the display zone on the given day. */
function localTime(hour: number, minute: number, on: Date, tz: string): string {
  const d = new Date(Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), on.getUTCDate(), hour, minute));
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const two = (n: number) => String(n).padStart(2, "0");

/** One expression in plain words, or null when it isn't one of the common shapes. */
function describeOne(expr: string, on: Date, tz: string): { key: string; text: string } | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [mi, h, dom, mon, dow] = parts as [string, string, string, string, string];
  if (dom !== "*" || mon !== "*") return null;
  if (dow === "*" && h === "*" && /^\*\/\d+$/.test(mi)) return { key: `every-min`, text: `Every ${mi.slice(2)} min` };
  if (!/^\d+$/.test(mi)) return null;
  const minute = Number(mi);
  if (dow === "*" && h === "*") return { key: "hourly", text: minute === 0 ? "Hourly" : `Hourly at :${two(minute)}` };
  if (dow === "*" && /^\*\/\d+$/.test(h)) {
    return { key: "every-h", text: `Every ${h.slice(2)} h${minute === 0 ? "" : ` at :${two(minute)}`}` };
  }
  if (!/^\d+(,\d+)*$/.test(h)) return null;
  const times = h.split(",").map((x) => localTime(Number(x), minute, on, tz));
  if (dow === "*") return { key: "daily", text: times.join(" and ") };
  if (!/^\d(,\d)*$/.test(dow)) return null;
  const days = dow.split(",").map((x) => DAY[Number(x) % 7]).join(", ");
  return { key: `weekly:${days}`, text: `${days} ${times.join(" and ")}` };
}

/**
 * All of a job's expressions in plain words, in the display zone. Two daily
 * entries for one job merge: "Daily 09:00 and 21:00". Anything unusual falls
 * back to the raw expression so nothing is hidden.
 */
export function describeSchedule(exprs: string[], on: Date = new Date(), tz: string = DISPLAY_TZ): string {
  const parts = exprs.map((e) => ({ e, d: describeOne(e, on, tz) }));
  if (parts.some((p) => !p.d)) return exprs.join(" · ");
  const daily = parts.filter((p) => p.d!.key === "daily").map((p) => p.d!.text);
  const rest = parts.filter((p) => p.d!.key !== "daily").map((p) => p.d!.text);
  const out = [...(daily.length ? [`Daily ${daily.join(" and ")}`] : []), ...rest];
  return out.join(" · ");
}

/** "today 21:00", "tomorrow 11:00", "Mon 15:00" in the display zone. */
export function formatWhen(when: Date, now: Date = new Date(), tz: string = DISPLAY_TZ): string {
  const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(when);
  const today = dayKey(now);
  const target = dayKey(when);
  if (target === today) return `today ${time}`;
  const tomorrow = dayKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  if (target === tomorrow) return `tomorrow ${time}`;
  const past = dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  if (target === past) return `yesterday ${time}`;
  const wd = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short" }).format(when);
  return `${wd} ${time}`;
}
