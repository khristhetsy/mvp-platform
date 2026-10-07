import { PLATFORM_TZ } from "@/lib/time/platform-tz";
// Founder and investor message activity: the shared, pure part.
//
// What iCapOS sent to founders (emails and in-app notifications) and what it
// sent to investors on a founder's behalf (Founder Preview emails, DIY outreach,
// intro requests). The loader in message-activity.ts reads the rows; everything
// here is plain functions over those rows so the page, the goals page and the
// tests share one set of rules.
//
// Dates are Pacific time calendar days ("YYYY-MM-DD"), the US business clock.

export const MESSAGE_TZ = PLATFORM_TZ;
/** Shown next to times on screen. */
export const MESSAGE_TZ_LABEL = "Pacific time";

// ── Rows ────────────────────────────────────────────────────────────────────

export type MessagePerson = {
  /** Profile id, or "x:<email>" for an email to someone with no iCapOS account. */
  key: string;
  name: string;
  email: string;
  role: "founder" | "investor";
  companyId: string | null;
  company: string | null;
  /** Display label, e.g. "Professional", "Free (grandfathered)". */
  plan: string;
  /** Bucket the plan filter uses. */
  planGroup: "professional" | "basic" | "free" | "none";
};

export type ReceivedItem = {
  id: string;
  /** ISO timestamp. */
  at: string;
  personKey: string;
  channel: "email" | "in_app";
  title: string;
  message: string | null;
  /** Notification type or email job/source. */
  source: string;
  status: string;
  /** In-app deep link, e.g. "/founder/actions". */
  link: string | null;
  /** email_log id, so the full email can be opened. */
  emailId: number | null;
};

export type SentKind = "preview" | "intro" | "diy";

export type SentItem = {
  id: string;
  at: string;
  /** The founder the send was for. */
  personKey: string;
  kind: SentKind;
  investor: string;
  investorEmail: string | null;
  status: string;
  title: string;
  emailId: number | null;
  detail: string | null;
  handledAt: string | null;
};

export type MessageActivityData = {
  people: MessagePerson[];
  received: ReceivedItem[];
  sent: SentItem[];
  /** Investor emails still waiting to send, per founder person key. */
  queued: Record<string, number>;
  /** Plan allowance right now (investors reached in the current 30 day window), per founder person key. Capped plans only. */
  allowance: Record<string, { cap: number; used: number; resetsAt: string }>;
  /** First day email sends were logged; earlier periods only have in-app counts. */
  emailLogStart: string;
  generatedAt: string;
};

// ── Message types and metrics ───────────────────────────────────────────────

const REMINDERS = [
  "reminder_generated", "orchestration_reminder", "digest_ready", "journey_nudge",
  "data_room_reminder", "founder_outreach_nudge", "founder_stage_review",
];
const ALERTS = [
  "orchestration_overdue", "orchestration_inactivity", "orchestration_escalation",
  "escalation_warning", "operations.escalation",
];
const INTRO_UPDATES = [
  "founder_intro_requested", "founder_intro_contacted", "outreach_intros_sent", "founder_outreach_blocked",
];

export type ReceivedType = "email" | "reminder" | "alert" | "remediation" | "intro" | "other";

export function receivedType(r: Pick<ReceivedItem, "channel" | "source">): ReceivedType {
  if (r.channel === "email") return "email";
  if (REMINDERS.includes(r.source)) return "reminder";
  if (ALERTS.includes(r.source)) return "alert";
  if (r.source.startsWith("remediation_task")) return "remediation";
  if (INTRO_UPDATES.includes(r.source)) return "intro";
  return "other";
}

export const RECEIVED_COLUMNS: Array<{ type: ReceivedType; label: string; short: string }> = [
  { type: "email", label: "Emails", short: "Emails" },
  { type: "reminder", label: "Reminders and nudges", short: "Reminders" },
  { type: "alert", label: "Overdue and escalation alerts", short: "Alerts" },
  { type: "remediation", label: "Remediation tasks", short: "Remediation" },
  { type: "intro", label: "Intro and investor updates", short: "Intro updates" },
  { type: "other", label: "Other in-app notifications", short: "Other" },
];

export const SENT_COLUMNS: Array<{ kind: SentKind; label: string; short: string }> = [
  { kind: "preview", label: "Founder Preview emails", short: "Preview emails" },
  { kind: "intro", label: "Intro requests", short: "Intro requests" },
  { kind: "diy", label: "DIY outreach emails", short: "DIY emails" },
];

const SOURCE_LABELS: Record<string, string> = {
  orchestration_overdue: "Overdue alert",
  orchestration_inactivity: "Inactivity alert",
  orchestration_reminder: "Due soon reminder",
  orchestration_escalation: "Escalation",
  escalation_warning: "Escalation warning",
  reminder_generated: "Reminder",
  remediation_task_created: "Remediation task",
  remediation_task_completed: "Remediation done",
  outreach_intros_sent: "Intros sent notice",
  founder_intro_requested: "Intro requested",
  founder_intro_contacted: "Intro contacted",
  digest_ready: "Digest",
};

/** "Overdue alert", "founder match digest". */
export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source.replace(/^\/api\/cron\//, "").replace(/[_-]/g, " ");
}

export type MetricKey =
  | "f_email" | "f_rem" | "f_alert" | "f_remed" | "f_intro" | "f_other"
  | "i_preview" | "i_reach" | "i_intro" | "i_contacted" | "i_diy";

export type MetricDef = {
  key: MetricKey;
  group: "received" | "sent";
  label: string;
  description: string;
  /** Default reading: is a higher number good? A goal can override it. */
  higherIsBetter: boolean;
};

export const METRICS: MetricDef[] = [
  { key: "f_email", group: "received", label: "Emails", description: "Emails iCapOS sent to founders.", higherIsBetter: true },
  { key: "f_rem", group: "received", label: "Reminders and nudges", description: "Reminders, digests and journey nudges in the app.", higherIsBetter: true },
  { key: "f_alert", group: "received", label: "Overdue and escalation alerts", description: "Overdue, inactivity and escalation alerts. Fewer is better.", higherIsBetter: false },
  { key: "f_remed", group: "received", label: "Remediation tasks", description: "Remediation tasks created or completed.", higherIsBetter: true },
  { key: "f_intro", group: "received", label: "Intro and investor updates", description: "Notices about intro requests and investor outreach.", higherIsBetter: true },
  { key: "f_other", group: "received", label: "Other in-app notifications", description: "Every other in-app notification to founders.", higherIsBetter: true },
  { key: "i_preview", group: "sent", label: "Founder Preview emails", description: "Founder Preview emails delivered to investors.", higherIsBetter: true },
  { key: "i_reach", group: "sent", label: "Investors reached", description: "Distinct investors who got an email for a founder.", higherIsBetter: true },
  { key: "i_intro", group: "sent", label: "Intro requests", description: "Founder requests for an introduction to an investor.", higherIsBetter: true },
  { key: "i_contacted", group: "sent", label: "Intros contacted", description: "Intro requests iCFO followed up by contacting the investor.", higherIsBetter: true },
  { key: "i_diy", group: "sent", label: "DIY outreach emails", description: "Emails founders sent through DIY outreach.", higherIsBetter: true },
];

export const METRIC_KEYS = METRICS.map((m) => m.key);

const RECEIVED_BY_METRIC: Partial<Record<MetricKey, ReceivedType>> = {
  f_email: "email", f_rem: "reminder", f_alert: "alert", f_remed: "remediation", f_intro: "intro", f_other: "other",
};

/** The rows a metric counts. */
export function metricItems(
  key: MetricKey,
  data: { received: ReceivedItem[]; sent: SentItem[] },
): Array<ReceivedItem | SentItem> {
  const rt = RECEIVED_BY_METRIC[key];
  if (rt) return data.received.filter((r) => receivedType(r) === rt);
  switch (key) {
    case "i_preview": return data.sent.filter((s) => s.kind === "preview" && s.status === "sent");
    case "i_reach": return data.sent.filter((s) => s.kind !== "intro" && s.status !== "skipped");
    case "i_intro": return data.sent.filter((s) => s.kind === "intro");
    case "i_contacted": return data.sent.filter((s) => s.kind === "intro" && s.status === "contacted");
    case "i_diy": return data.sent.filter((s) => s.kind === "diy");
    default: return [];
  }
}

/** The number a metric shows. "Investors reached" counts distinct investors. */
export function metricValue(key: MetricKey, data: { received: ReceivedItem[]; sent: SentItem[] }): number {
  const items = metricItems(key, data);
  if (key === "i_reach") {
    return new Set((items as SentItem[]).map((s) => (s.investorEmail ?? s.investor).toLowerCase())).size;
  }
  return items.length;
}

// ── Calendar days and periods ───────────────────────────────────────────────

const TZ_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: MESSAGE_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function parts(d: Date): Record<string, string> {
  const o: Record<string, string> = {};
  for (const p of TZ_PARTS.formatToParts(d)) o[p.type] = p.value;
  return o;
}

/** Pacific calendar day of an instant. */
export function localDay(iso: string | Date): string {
  const p = parts(typeof iso === "string" ? new Date(iso) : iso);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Pacific "HH:MM" of an instant. */
export function localTime(iso: string): string {
  const p = parts(new Date(iso));
  return `${p.hour}:${p.minute}`;
}

/** The UTC instant at which a Pacific calendar day starts. */
export function dayStartUtc(day: string): Date {
  const guess = new Date(`${day}T00:00:00Z`);
  // Read the zone's wall clock at the guessed instant and shift by the difference;
  // a second pass settles daylight saving edges.
  let t = guess.getTime();
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(t));
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    t -= asUtc - guess.getTime();
  }
  return new Date(t);
}

const toD = (s: string) => new Date(`${s}T00:00:00Z`);
const toS = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(s: string, n: number): string {
  const d = toD(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toS(d);
}

export function addMonths(s: string, n: number): string {
  const d = toD(`${s.slice(0, 7)}-01`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return toS(d);
}

/** Monday = 0 … Sunday = 6. */
export function weekday(s: string): number {
  return (toD(s).getUTCDay() + 6) % 7;
}

export function daysBetween(start: string, end: string): number {
  return Math.round((toD(end).getTime() - toD(start).getTime()) / 864e5) + 1;
}

export function monthDays(month: string): number {
  const d = toD(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.getUTCDate();
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function shortDay(s: string): string {
  return `${+s.slice(8, 10)} ${MONTHS[+s.slice(5, 7) - 1]}`;
}

export function longDay(s: string): string {
  return `${WEEKDAYS[weekday(s)]} ${shortDay(s)} ${s.slice(0, 4)}`;
}

export function monthLabel(month: string): string {
  return `${MONTHS[+month.slice(5, 7) - 1]} ${month.slice(0, 4)}`;
}

export type PeriodKind = "day" | "week" | "month" | "quarter" | "year" | "custom";
export const PERIOD_KINDS: PeriodKind[] = ["day", "week", "month", "quarter", "year", "custom"];

export type DayRange = { start: string; end: string };

/** The period of a given kind that contains `anchor`. */
export function periodRange(kind: Exclude<PeriodKind, "custom">, anchor: string): DayRange {
  switch (kind) {
    case "day":
      return { start: anchor, end: anchor };
    case "week": {
      const start = addDays(anchor, -weekday(anchor));
      return { start, end: addDays(start, 6) };
    }
    case "month": {
      const start = `${anchor.slice(0, 7)}-01`;
      return { start, end: addDays(addMonths(start, 1), -1) };
    }
    case "quarter": {
      const m = Math.floor((+anchor.slice(5, 7) - 1) / 3) * 3 + 1;
      const start = `${anchor.slice(0, 4)}-${String(m).padStart(2, "0")}-01`;
      return { start, end: addDays(addMonths(start, 3), -1) };
    }
    case "year":
      return { start: `${anchor.slice(0, 4)}-01-01`, end: `${anchor.slice(0, 4)}-12-31` };
  }
}

/** Move an anchor one period back (-1) or forward (+1). */
export function shiftAnchor(kind: Exclude<PeriodKind, "custom">, anchor: string, n: number): string {
  switch (kind) {
    case "day": return addDays(anchor, n);
    case "week": return addDays(anchor, 7 * n);
    case "month": return addMonths(anchor, n);
    case "quarter": return addMonths(anchor, 3 * n);
    case "year": return addMonths(anchor, 12 * n);
  }
}

/** The period just before: same kind, or the same number of days for a custom range. */
export function previousRange(kind: PeriodKind, range: DayRange, anchor: string): DayRange {
  if (kind === "custom") {
    const n = daysBetween(range.start, range.end);
    return { start: addDays(range.start, -n), end: addDays(range.start, -1) };
  }
  return periodRange(kind, shiftAnchor(kind, anchor, -1));
}

export const PREVIOUS_LABEL: Record<PeriodKind, string> = {
  day: "previous day", week: "previous week", month: "previous month",
  quarter: "previous quarter", year: "previous year", custom: "previous period",
};

export function periodLabel(kind: PeriodKind, r: DayRange): string {
  const y = (s: string) => s.slice(0, 4);
  switch (kind) {
    case "day": return longDay(r.start);
    case "week": return `Week of ${shortDay(r.start)} to ${shortDay(r.end)} ${y(r.end)}`;
    case "month": return monthLabel(r.start.slice(0, 7));
    case "quarter": return `Q${Math.floor((+r.start.slice(5, 7) - 1) / 3) + 1} ${y(r.start)}`;
    case "year": return y(r.start);
    case "custom": return `${shortDay(r.start)} ${y(r.start)} to ${shortDay(r.end)} ${y(r.end)}`;
  }
}

export function inRange(day: string, r: DayRange): boolean {
  return day >= r.start && day <= r.end;
}

// ── Chart buckets ───────────────────────────────────────────────────────────

export type Buckets = {
  unit: "hour" | "day" | "week" | "month";
  keys: string[];
  keyOf: (iso: string) => string;
  /** Tooltip / table label. */
  label: (k: string) => string;
  /** Axis tick. */
  tick: (k: string) => string;
};

export function chartBuckets(kind: PeriodKind, r: DayRange): Buckets {
  const days = daysBetween(r.start, r.end);
  if (kind === "day") {
    const keys = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
    return { unit: "hour", keys, keyOf: (iso) => localTime(iso).slice(0, 2), label: (k) => `${k}:00`, tick: (k) => k };
  }
  if (kind === "year" || (kind === "custom" && days > 120)) {
    const keys: string[] = [];
    for (let m = r.start.slice(0, 7); m <= r.end.slice(0, 7); m = addMonths(`${m}-01`, 1).slice(0, 7)) keys.push(m);
    return { unit: "month", keys, keyOf: (iso) => localDay(iso).slice(0, 7), label: monthLabel, tick: (k) => MONTHS[+k.slice(5, 7) - 1] };
  }
  if (kind === "quarter" || (kind === "custom" && days > 45)) {
    const keys: string[] = [];
    for (let w = addDays(r.start, -weekday(r.start)); w <= r.end; w = addDays(w, 7)) keys.push(w);
    return {
      unit: "week", keys,
      keyOf: (iso) => { const d = localDay(iso); return addDays(d, -weekday(d)); },
      label: (k) => `Week of ${shortDay(k)}`, tick: shortDay,
    };
  }
  const keys: string[] = [];
  for (let d = r.start; d <= r.end; d = addDays(d, 1)) keys.push(d);
  return {
    unit: "day", keys, keyOf: (iso) => localDay(iso), label: longDay,
    tick: kind === "week" ? (k) => WEEKDAYS[weekday(k)] : (k) => String(+k.slice(8, 10)),
  };
}

// ── Goals ───────────────────────────────────────────────────────────────────

export type GoalBasis = "day" | "week" | "month" | "quarter" | "year";

const AVG_MONTH_DAYS = 365.25 / 12;

/** Multiply an amount entered "per <basis>" by this to get a monthly goal. */
export const BASIS_TO_MONTH: Record<GoalBasis, number> = {
  day: AVG_MONTH_DAYS,
  week: AVG_MONTH_DAYS / 7,
  month: 1,
  quarter: 1 / 3,
  year: 1 / 12,
};

export const BASIS_LABEL: Record<GoalBasis, string> = {
  day: "per day", week: "per week", month: "per month", quarter: "per quarter", year: "per year",
};

export type GoalEntry = {
  id: string;
  metricKey: MetricKey;
  /** "YYYY-MM" the goal starts in. */
  month: string;
  /** null = goal stopped from this month. */
  perMonth: number | null;
  amount: number | null;
  basis: GoalBasis | null;
  direction: "up" | "down";
  note: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
};

export function toPerMonth(amount: number, basis: GoalBasis): number {
  return Math.round(amount * BASIS_TO_MONTH[basis] * 100) / 100;
}

/** The goal entry in force during a month. */
export function goalAt(entries: GoalEntry[], key: MetricKey, month: string): GoalEntry | null {
  let best: GoalEntry | null = null;
  for (const e of entries) {
    if (e.metricKey === key && e.month <= month && (!best || e.month > best.month)) best = e;
  }
  return best;
}

/**
 * The goal for a date range: each month's goal prorated to the days of that month
 * inside the range. `coveredDays` < range length when part of the range had no goal.
 */
export function goalForRange(
  entries: GoalEntry[],
  key: MetricKey,
  r: DayRange,
): { goal: number; coveredDays: number; totalDays: number } | null {
  let goal = 0;
  let covered = 0;
  for (let m = r.start.slice(0, 7); m <= r.end.slice(0, 7); m = addMonths(`${m}-01`, 1).slice(0, 7)) {
    const ms = `${m}-01`;
    const me = `${m}-${String(monthDays(m)).padStart(2, "0")}`;
    const a = r.start > ms ? r.start : ms;
    const b = r.end < me ? r.end : me;
    const days = daysBetween(a, b);
    const e = goalAt(entries, key, m);
    if (e && e.perMonth !== null) {
      goal += (e.perMonth * days) / monthDays(m);
      covered += days;
    }
  }
  return covered ? { goal, coveredDays: covered, totalDays: daysBetween(r.start, r.end) } : null;
}

/** Is a higher number good for this metric, given any goal set on it? */
export function higherIsBetter(entries: GoalEntry[], def: MetricDef, month: string): boolean {
  const e = goalAt(entries, def.key, month);
  return e ? e.direction === "up" : def.higherIsBetter;
}

export type Change =
  | { kind: "same"; previous: number }
  | { kind: "new"; previous: 0 }
  | { kind: "change"; previous: number; pct: number };

export function changeVs(current: number, previous: number): Change {
  if (current === previous) return { kind: "same", previous };
  if (previous === 0) return { kind: "new", previous: 0 };
  return { kind: "change", previous, pct: ((current - previous) / previous) * 100 };
}

/** Display a goal: one decimal under 10, whole numbers above. */
export function fmtGoal(v: number): string {
  return v < 10 ? String(Math.round(v * 10) / 10) : String(Math.round(v));
}
