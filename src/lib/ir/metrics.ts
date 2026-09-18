/**
 * IR metric definitions — pure, client-safe. Every dashboard and founder-report figure
 * resolves to one of these (build spec §4) so the two never disagree.
 *
 *   Intros sent      activities type=email, subject = INTRO_SUBJECT, done in period
 *   Calls            activities type in (call, voicemail), done in period
 *   Emails           activities type=email, done in period
 *   Meetings booked  activities type=meeting, created in period
 *   Meetings held    activities type=meeting, done in period
 *   Term sheets      matches with term_sheet_received_at in period
 *   Commitments      stage events to `committed` in period
 *   Contacted        distinct matches with a done email/call/voicemail/meeting in period
 *   Pipeline as of D latest stage event per match with changed_at < D
 *   Attainment       actual / target — null when there is no target (show "No goal")
 *
 * Periods are half-open [start, end) on YYYY-MM-DD dates, compared in UTC.
 */
import { INTRO_SUBJECT, IR_STAGES, type IrStage } from "@/lib/ir/types";

export const GOAL_METRICS = ["meetings_held", "term_sheets", "calls", "emails", "intros"] as const;
export type GoalMetric = (typeof GOAL_METRICS)[number];
export const GOAL_METRIC_LABEL: Record<GoalMetric, string> = { meetings_held: "Meetings held", term_sheets: "Term sheets", calls: "Calls", emails: "Emails", intros: "Intros sent" };

export type MetricKey = GoalMetric | "meetings_booked" | "commitments" | "contacted";
export type MetricCounts = Record<MetricKey, number>;

/** Subject prefix of the activity logged when a founder report is emailed — never outreach, so excluded from counts. */
export const REPORT_SENT_PREFIX = "Founder report sent";

export type PeriodKind = "week" | "month";
export type Period = { start: string; end: string };   // YYYY-MM-DD, end exclusive

export type ActivityLite = { id: string; project_id: string; match_id: string | null; type: string; subject: string; created_at: string; done_at: string | null; due_at?: string | null; assignee_id?: string | null; created_by?: string | null };
export type MatchLite = { id: string; project_id: string; stage: IrStage; term_sheet_received_at: string | null; assignee_id?: string | null };
export type StageEventLite = { match_id: string; to_stage: IrStage; changed_at: string };
export type GoalLite = { project_id: string | null; assignee_id: string | null; metric: GoalMetric; period_kind: PeriodKind; period_start: string; target: number };

// ── Dates ───────────────────────────────────────────────────────────────────
export const toTs = (day: string) => `${day}T00:00:00.000Z`;
export function addDaysUtc(day: string, n: number): string {
  const d = new Date(toTs(day)); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export function inPeriod(ts: string | null | undefined, p: Period): boolean {
  return Boolean(ts) && (ts as string) >= toTs(p.start) && (ts as string) < toTs(p.end);
}
/** Monday of the calendar week containing `day`. */
export function weekStart(day: string): string {
  const d = new Date(toTs(day)); const dow = (d.getUTCDay() + 6) % 7; return addDaysUtc(day, -dow);
}
export function monthStart(day: string): string { return `${day.slice(0, 7)}-01`; }
export function periodFor(kind: PeriodKind, day: string): Period {
  if (kind === "week") { const s = weekStart(day); return { start: s, end: addDaysUtc(s, 7) }; }
  const s = monthStart(day); const d = new Date(toTs(s)); d.setUTCMonth(d.getUTCMonth() + 1);
  return { start: s, end: d.toISOString().slice(0, 10) };
}
export function shiftPeriod(kind: PeriodKind, p: Period, n: number): Period {
  if (kind === "week") return { start: addDaysUtc(p.start, 7 * n), end: addDaysUtc(p.end, 7 * n) };
  const d = new Date(toTs(p.start)); d.setUTCMonth(d.getUTCMonth() + n); return periodFor("month", d.toISOString().slice(0, 10));
}
/** `n` consecutive periods ending with the one containing `day`. */
export function trailingPeriods(kind: PeriodKind, day: string, n: number): Period[] {
  const last = periodFor(kind, day); return Array.from({ length: n }, (_, i) => shiftPeriod(kind, last, i - (n - 1)));
}
/** Previous period of the same length (custom ranges get the same number of days before). */
export function previousPeriod(p: Period): Period {
  const days = Math.round((new Date(toTs(p.end)).getTime() - new Date(toTs(p.start)).getTime()) / 86_400_000);
  return { start: addDaysUtc(p.start, -days), end: p.start };
}
export function periodLabel(kind: PeriodKind, p: Period): string {
  const f = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(toTs(iso)).toLocaleDateString("en-US", { timeZone: "UTC", ...o });
  if (kind === "month") return f(p.start, { month: "long", year: "numeric" });
  return `${f(p.start, { month: "short", day: "numeric" })} to ${f(addDaysUtc(p.end, -1), { month: "short", day: "numeric", year: "numeric" })}`;
}

// ── Counting ────────────────────────────────────────────────────────────────
export const isOutreach = (a: Pick<ActivityLite, "subject">) => !a.subject.startsWith(REPORT_SENT_PREFIX);
const CONTACT_TYPES = new Set(["email", "call", "voicemail", "meeting"]);

export function countMetrics(acts: ActivityLite[], matches: MatchLite[], events: StageEventLite[], p: Period): MetricCounts {
  const c: MetricCounts = { intros: 0, calls: 0, emails: 0, meetings_booked: 0, meetings_held: 0, term_sheets: 0, commitments: 0, contacted: 0 };
  const contacted = new Set<string>();
  for (const a of acts) {
    if (!isOutreach(a)) continue;
    if (a.type === "meeting" && inPeriod(a.created_at, p)) c.meetings_booked++;
    if (!inPeriod(a.done_at, p)) continue;
    if (a.type === "email") { c.emails++; if (a.subject === INTRO_SUBJECT) c.intros++; }
    if (a.type === "call" || a.type === "voicemail") c.calls++;
    if (a.type === "meeting") c.meetings_held++;
    if (a.match_id && CONTACT_TYPES.has(a.type)) contacted.add(a.match_id);
  }
  c.contacted = contacted.size;
  for (const m of matches) if (inPeriod(m.term_sheet_received_at, p)) c.term_sheets++;
  for (const e of events) if (e.to_stage === "committed" && inPeriod(e.changed_at, p)) c.commitments++;
  return c;
}

/** Stage of each match as it stood just before `asOfTs` (ISO timestamp); matches with no event yet are absent. */
export function stagesAsOf(events: StageEventLite[], asOfTs: string): Map<string, IrStage> {
  const latest = new Map<string, { at: string; stage: IrStage }>();
  for (const e of events) {
    if (e.changed_at >= asOfTs) continue;
    const cur = latest.get(e.match_id);
    if (!cur || e.changed_at > cur.at) latest.set(e.match_id, { at: e.changed_at, stage: e.to_stage });
  }
  return new Map([...latest].map(([id, v]) => [id, v.stage]));
}
export function pipelineAsOf(events: StageEventLite[], asOfTs: string): Array<{ stage: IrStage; count: number }> {
  const stages = stagesAsOf(events, asOfTs);
  const counts = Object.fromEntries(IR_STAGES.map((s) => [s, 0])) as Record<IrStage, number>;
  for (const s of stages.values()) counts[s]++;
  return IR_STAGES.map((stage) => ({ stage, count: counts[stage] }));
}

// ── Goals ───────────────────────────────────────────────────────────────────
export function attainment(actual: number, target: number | null): number | null {
  return target == null || target <= 0 ? null : actual / target;
}
/** Target for a metric in a period: the project's row, or — firm-wide — the firm row when set, else the sum of project rows. */
export function goalTarget(goals: GoalLite[], q: { projectId: string | null; metric: GoalMetric; kind: PeriodKind; start: string }): number | null {
  const rows = goals.filter((g) => g.metric === q.metric && g.period_kind === q.kind && g.period_start === q.start && !g.assignee_id);
  if (q.projectId) { const r = rows.find((g) => g.project_id === q.projectId); return r ? Number(r.target) : null; }
  const firm = rows.find((g) => g.project_id === null);
  if (firm) return Number(firm.target);
  const per = rows.filter((g) => g.project_id !== null);
  return per.length ? per.reduce((s, g) => s + Number(g.target), 0) : null;
}
export function goalValue(c: MetricCounts, m: GoalMetric): number { return c[m]; }
