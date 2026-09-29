/**
 * Founder report — server only. One data source feeds the interactive view, the send
 * format document and the PDF. Founder-facing rules (spec §6): investor names and
 * contact details never appear; a firm is named only once a meeting has been booked;
 * notes appear only when `founder_visible`. The AI drafts the executive summary; staff
 * edit and approve; the approved text and the metrics are frozen in ir_reports.
 */
import { claudeComplete, CLAUDE_SONNET, isClaudeConfigured } from "@/lib/claude";
import { db, findReport, founderEmail, getProject, investorMap, listMilestones, listNotes, nameMap, type IrReportRow } from "@/lib/ir/db";
import { loadActivities, loadEvents, loadMatches } from "@/lib/ir/dashboard";
import { formatRange, milestoneOn } from "@/lib/ir/milestones";
import { countMetrics, inPeriod, isOutreach, periodLabel, pipelineAsOf, previousPeriod, stagesAsOf, toTs, type ActivityLite, type Period, type PeriodKind } from "@/lib/ir/metrics";
import { INTRO_SUBJECT, IR_STAGE_LABEL, type IrMilestone, type IrProject, type IrStage } from "@/lib/ir/types";
import { lastSummarySends } from "@/lib/ir/summaries";

export type ReportKind = PeriodKind | "custom";
export type ReportPeriod = Period & { kind: ReportKind; label: string };
export type ReportMetrics = { intros: number; contacted: number; booked: number; held: number; committed: number };
export type CommRow = { date: string; channel: string; firm: string; what: string; next: string };
export type ExecSummary = { bottom: string; lead: string; highlights: string[]; themes: string[]; watch: string[]; asks: string[] };
export type ReportData = {
  project: { id: string; title: string; founder_name: string | null; owner_name: string | null; start_date: string; end_date: string; term_months: number; termLabel: string; monthLabel: string };
  founder: { name: string; email: string | null };
  period: ReportPeriod; previous: ReportPeriod | null;
  metrics: ReportMetrics; prevMetrics: ReportMetrics | null;
  summary: string;
  comms: CommRow[];
  notes: Array<{ date: string; body: string }>;
  pipeline: Array<{ stage: IrStage; label: string; count: number }>; asOf: string;
  trend: { labels: string[]; intros: number[]; held: number[]; kind: PeriodKind };
  upcoming: Array<{ firm: string; when: string }>;
  options: { weeks: IrMilestone[]; months: IrMilestone[] };
  saved: IrReportRow | null;
  preparedOn: string;
  schedule: { weekly: boolean; monthly: boolean; sends: Array<{ kind: string; period_start: string; sent_to: string; sent_at: string }> };
};

const NAMED_STAGES = new Set<IrStage>(["meeting_scheduled", "meeting_held", "follow_up", "committed"]);
const fmtDay = (ts: string) => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fmtDayYear = (ts: string) => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const plural = (n: number, s: string, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;

/** Resolve the requested period against the project's milestones; custom ranges are bounded by the term. */
export function resolvePeriod(project: IrProject, milestones: IrMilestone[], q: { kind: ReportKind; milestoneId?: string | null; start?: string | null; end?: string | null }, today: string): { period: ReportPeriod; error?: string } {
  const bad = (error: string) => ({ period: { kind: "week" as const, start: today, end: today, label: "" }, error });
  if (q.kind === "custom") {
    if (!q.start || !q.end) return bad("Pick both dates.");
    if (q.start >= q.end) return bad("The start date must come before the end date.");
    if (q.start < project.start_date || q.end > project.end_date) return bad(`Dates must fall within the project term (${formatRange(project.start_date, project.end_date)}).`);
    return { period: { kind: "custom", start: q.start, end: q.end, label: formatRange(q.start, q.end) } };
  }
  const list = milestones.filter((m) => m.kind === q.kind);
  const m = (q.milestoneId && list.find((x) => x.id === q.milestoneId)) || milestoneOn(list, today) || list[list.length - 1];
  if (!m) return bad("This project has no milestones.");
  return { period: { kind: q.kind, start: m.starts_on, end: m.ends_on, label: `${m.label} · ${formatRange(m.starts_on, m.ends_on)}` } };
}

function metricsFor(acts: ActivityLite[], matches: Parameters<typeof countMetrics>[1], events: Parameters<typeof countMetrics>[2], p: Period): ReportMetrics {
  const c = countMetrics(acts, matches, events, p);
  return { intros: c.intros, contacted: c.contacted, booked: c.meetings_booked, held: c.meetings_held, committed: c.commitments };
}

export function summarySentence(m: ReportMetrics, founderFirst: string | null): string {
  const who = founderFirst ? `${founderFirst}, your` : "Your";
  const committed = m.committed ? ` ${plural(m.committed, "investor")} committed.` : "";
  return `${who} team sent ${plural(m.intros, "introduction")} and reached ${plural(m.contacted, "investor")}. ${plural(m.booked, "meeting")} ${m.booked === 1 ? "was" : "were"} booked and ${m.held} ${m.held === 1 ? "was" : "were"} held.${committed}`;
}

const CHANNEL: Record<string, string> = { email: "Email", call: "Call", voicemail: "Voicemail", meeting: "Meeting", document: "Document shared", term_sheet: "Term sheet", note: "Update" };
const GROUP_LABEL: Record<string, string> = { email: "Introductions and emails", call: "Calls", voicemail: "Calls", meeting: "Meetings", document: "Documents shared", term_sheet: "Term sheets", note: "Updates" };

export async function reportData(projectId: string, q: { kind: ReportKind; milestoneId?: string | null; start?: string | null; end?: string | null; compare: boolean }, today = new Date().toISOString().slice(0, 10)): Promise<{ data: ReportData | null; error?: string }> {
  const project = await getProject(projectId);
  if (!project) return { data: null, error: "Project not found." };
  const milestones = await listMilestones(projectId);
  const { period, error } = resolvePeriod(project, milestones, q, today);
  if (error) return { data: null, error };

  const [acts, matches, events, notes, email, saved] = await Promise.all([
    loadActivities([projectId], project.start_date), loadMatches([projectId]), loadEvents([projectId]), listNotes({ projectId }), founderEmail(project), findReport(projectId, period),
  ]);
  const previous: ReportPeriod | null = q.compare && period.kind !== "custom" ? (() => { const p = previousPeriod(period); return p.start >= project.start_date ? { ...p, kind: period.kind, label: periodLabel(period.kind, p) } : null; })() : null;
  const metrics = metricsFor(acts, matches, events, period);
  const prevMetrics = previous ? metricsFor(acts, matches, events, previous) : null;

  // Which matches may be named: any match that has reached a meeting stage by period end.
  const stagesAtEnd = stagesAsOf(events, toTs(period.end));
  const everBooked = new Set<string>();
  for (const e of events) if (NAMED_STAGES.has(e.to_stage) && e.changed_at < toTs(period.end)) everBooked.add(e.match_id);
  for (const [id, s] of stagesAtEnd) if (NAMED_STAGES.has(s)) everBooked.add(id);
  const inv = await investorMap(matches.map((m) => m.investor_contact_id));
  const firmOf = (matchId: string | null) => { const m = matches.find((x) => x.id === matchId); return m ? inv.get(m.investor_contact_id)?.firm ?? "Investor firm" : "Investor firm"; };

  // Communications log: named rows for booked firms; unnamed outreach grouped per channel.
  const detail = await db().from("ir_activities").select("id, outcome, next_step, description, founder_visible").eq("project_id", projectId).limit(20000);
  const extra = new Map((((detail.data ?? []) as Array<{ id: string; outcome: string | null; next_step: string | null; description: string | null; founder_visible: boolean }>)).map((r) => [r.id, r]));
  const done = acts.filter((a) => isOutreach(a) && inPeriod(a.done_at, period) && (extra.get(a.id)?.founder_visible ?? true)).sort((x, y) => (x.done_at! > y.done_at! ? -1 : 1));
  const comms: Array<CommRow & { ts: string }> = [];
  const groups = new Map<string, { n: number; matches: Set<string>; last: string }>();
  for (const a of done) {
    const x = extra.get(a.id);
    if (a.match_id && everBooked.has(a.match_id)) {
      comms.push({ ts: a.done_at!, date: fmtDay(a.done_at!), channel: a.subject === INTRO_SUBJECT ? "Introduction sent" : a.type === "meeting" ? "Meeting held" : CHANNEL[a.type] ?? a.type, firm: firmOf(a.match_id), what: x?.outcome || x?.description || a.subject, next: x?.next_step ?? "" });
    } else {
      const k = GROUP_LABEL[a.type] ?? a.type; const g = groups.get(k) ?? { n: 0, matches: new Set<string>(), last: a.done_at! };
      g.n++; if (a.match_id) g.matches.add(a.match_id); if (a.done_at! > g.last) g.last = a.done_at!; groups.set(k, g);
    }
  }
  for (const [k, g] of groups) comms.push({ ts: g.last, date: fmtDay(g.last), channel: k, firm: `${plural(Math.max(g.matches.size, 1), "firm")}, not named until booked`, what: `${plural(g.n, k === "Calls" ? "call" : k === "Meetings" ? "meeting" : "touch", k === "Calls" ? "calls" : k === "Meetings" ? "meetings" : "touches")} across the period.`, next: "" });
  for (const e of events) if (e.to_stage === "committed" && inPeriod(e.changed_at, period)) comms.push({ ts: e.changed_at, date: fmtDay(e.changed_at), channel: "Commitment", firm: firmOf(e.match_id), what: "Committed to the round.", next: "Handed to closing" });
  for (const m of matches) if (inPeriod(m.term_sheet_received_at, period)) comms.push({ ts: m.term_sheet_received_at!, date: fmtDay(m.term_sheet_received_at!), channel: "Term sheet received", firm: firmOf(m.id), what: "Term sheet received.", next: "Under review" });
  comms.sort((a, b) => (a.ts > b.ts ? -1 : 1));
  const commRows: CommRow[] = comms.map(({ ts: _ts, ...r }) => { void _ts; return r; });

  const pipeline = pipelineAsOf(events, toTs(period.end)).map((r) => ({ ...r, label: IR_STAGE_LABEL[r.stage] }));
  const trendKind: PeriodKind = period.kind === "week" ? "week" : "month";
  const trendPeriods = period.kind === "custom"
    ? milestones.filter((m) => m.kind === "month" && m.starts_on < period.end).slice(-6).map((m) => ({ start: m.starts_on, end: m.ends_on, label: m.label }))
    : (() => { const list = milestones.filter((m) => m.kind === period.kind); const i = list.findIndex((m) => m.starts_on === period.start); return list.slice(Math.max(0, i - 5), i + 1).map((m) => ({ start: m.starts_on, end: m.ends_on, label: m.label.replace("Month ", "M").replace("Week ", "W") })); })();
  const trend = { kind: trendKind, labels: trendPeriods.map((p) => p.label), intros: trendPeriods.map((p) => metricsFor(acts, matches, events, p).intros), held: trendPeriods.map((p) => metricsFor(acts, matches, events, p).held) };

  const upcoming = acts.filter((a) => a.type === "meeting" && !a.done_at && a.due_at && a.due_at >= toTs(today) && a.match_id).sort((x, y) => (x.due_at! < y.due_at! ? -1 : 1)).slice(0, 8)
    .map((a) => ({ firm: firmOf(a.match_id), when: new Date(a.due_at!).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }) + " PT" }));

  const months = milestones.filter((m) => m.kind === "month");
  const cur = milestoneOn(months, today);
  const ownerName = project.owner_name ?? (await nameMap([project.owner_id])).get(project.owner_id) ?? "Investor Relations";
  const founderFirst = project.founder_name?.split(/\s+/)[0] ?? null;
  return {
    data: {
      project: { id: project.id, title: project.title, founder_name: project.founder_name, owner_name: ownerName, start_date: project.start_date, end_date: project.end_date, term_months: project.term_months, termLabel: formatRange(project.start_date, project.end_date), monthLabel: cur ? `${cur.label} of ${project.term_months}` : "Term ended" },
      founder: { name: project.founder_name ?? "Founder", email },
      period, previous, metrics, prevMetrics,
      summary: summarySentence(metrics, founderFirst),
      comms: commRows, notes: notes.filter((n) => n.founder_visible && n.noted_on >= period.start && n.noted_on < period.end).map((n) => ({ date: fmtDay(toTs(n.noted_on)), body: n.body })),
      pipeline, asOf: `As of ${fmtDayYear(toTs(period.end))}`,
      trend, upcoming,
      options: { weeks: milestones.filter((m) => m.kind === "week"), months },
      saved, preparedOn: fmtDayYear(toTs(today)),
      schedule: { weekly: project.weekly_summary, monthly: project.monthly_summary, sends: await lastSummarySends(project.id) },
    },
  };
}

// ── Executive summary: AI drafts, staff approve ─────────────────────────────
export function fallbackSummary(d: ReportData): ExecSummary {
  const m = d.metrics; const committed = d.pipeline.find((p) => p.stage === "committed")?.count ?? 0; const total = d.pipeline.reduce((s, p) => s + p.count, 0);
  return {
    bottom: `${plural(m.held, "meeting")} held and ${plural(m.committed, "commitment")} this period, with ${plural(m.booked, "meeting")} booked ahead.`,
    lead: `${d.project.monthLabel} of the project. ${summarySentence(m, null)} Of ${plural(total, "matched investor")}, ${committed} ${committed === 1 ? "has" : "have"} committed.`,
    highlights: d.comms.slice(0, 4).map((c) => `${c.channel}: ${c.firm} — ${c.what}`),
    themes: d.notes.slice(0, 3).map((n) => n.body),
    watch: [], asks: ["Ask your iCFO contact before approaching any investor directly, so outreach is not duplicated."],
  };
}

export async function draftExecSummary(d: ReportData): Promise<{ summary: ExecSummary; source: "ai" | "template" }> {
  if (!isClaudeConfigured()) return { summary: fallbackSummary(d), source: "template" };
  const facts = {
    project: d.project.title, founder: d.founder.name, period: d.period.label, projectMonth: d.project.monthLabel, projectTerm: d.project.termLabel,
    metrics: d.metrics, previous: d.prevMetrics, pipelineAtPeriodEnd: d.pipeline.map((p) => `${p.label}: ${p.count}`), communications: d.comms, irTeamNotes: d.notes, upcomingMeetings: d.upcoming,
  };
  const system = `You write the executive summary of an investor-relations report that iCFO Capital Global, Inc. sends to a founder client. Bottom line first, then what happened, what it means, and what the founder owes. Plain, specific, no hype. Never invent facts, names, or numbers not in the data. Never name an investor person; firms only where the data names them. Return strict JSON with keys: bottom (one sentence), lead (one paragraph, 2–4 sentences), highlights (2–5 short bullets), themes (0–3 bullets: what investors are asking, only from the notes/communications), watch (0–3 bullets), asks (1–3 bullets of what the founder should do next). Empty arrays are fine when the data is thin.`;
  try {
    const text = await claudeComplete([{ role: "user", content: `Data:\n${JSON.stringify(facts, null, 1)}\n\nReturn only the JSON object.` }], { model: CLAUDE_SONNET, maxTokens: 1200, temperature: 0.3, system, locale: "en" });
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const raw = JSON.parse(json) as Partial<ExecSummary>;
    const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").slice(0, 6) : []);
    const fb = fallbackSummary(d);
    return { summary: { bottom: typeof raw.bottom === "string" && raw.bottom.trim() ? raw.bottom.trim() : fb.bottom, lead: typeof raw.lead === "string" && raw.lead.trim() ? raw.lead.trim() : fb.lead, highlights: arr(raw.highlights), themes: arr(raw.themes), watch: arr(raw.watch), asks: arr(raw.asks).length ? arr(raw.asks) : fb.asks }, source: "ai" };
  } catch {
    return { summary: fallbackSummary(d), source: "template" };
  }
}

/** The frozen snapshot stored in ir_reports.metrics — everything the document needs, so a re-opened report never changes. */
export type FrozenReport = Pick<ReportData, "project" | "founder" | "period" | "previous" | "metrics" | "prevMetrics" | "comms" | "notes" | "pipeline" | "asOf" | "trend" | "upcoming" | "preparedOn">;
export function freeze(d: ReportData): FrozenReport {
  const { project, founder, period, previous, metrics, prevMetrics, comms, notes, pipeline, asOf, trend, upcoming, preparedOn } = d;
  return { project, founder: { name: founder.name, email: null }, period, previous, metrics, prevMetrics, comms, notes, pipeline, asOf, trend, upcoming, preparedOn };
}
export function isExecSummary(v: unknown): v is ExecSummary {
  const o = v as Record<string, unknown> | null;
  return Boolean(o && typeof o.bottom === "string" && typeof o.lead === "string" && Array.isArray(o.highlights) && Array.isArray(o.themes) && Array.isArray(o.watch) && Array.isArray(o.asks));
}
