/**
 * IR dashboard rollup — server only. One read of the active projects' activities,
 * matches, stage events and goals over the trend window, then every card, the trend
 * series, the projects table, agent activity, overdue list and lifecycle strip are
 * computed with the shared metric definitions in metrics.ts.
 */
import { db, investorMap, listGoals, listProjects, nameMap } from "@/lib/ir/db";
import { milestoneOn } from "@/lib/ir/milestones";
import {
  GOAL_METRICS, attainment, countMetrics, goalTarget, periodFor, periodLabel, toTs, trailingPeriods,
  type ActivityLite, type GoalLite, type GoalMetric, type MatchLite, type MetricCounts, type PeriodKind, type StageEventLite,
} from "@/lib/ir/metrics";
import { IR_STAGES, type IrProject, type IrStage } from "@/lib/ir/types";

export type DashboardQuery = { period: PeriodKind; trendMetric: GoalMetric; trendKind: PeriodKind; founder: string | null; today?: string };

export type DashboardCard = { metric: GoalMetric; actual: number; target: number | null; attainment: number | null; perProject: Array<{ projectId: string; title: string; actual: number; target: number | null }>; perAgent: Array<{ id: string; name: string; actual: number }> };
export type DashboardPayload = {
  period: { kind: PeriodKind; start: string; end: string; label: string };
  founders: { active: number; finalMonth: number; list: Array<{ id: string; title: string; founder_name: string | null; owner_name: string | null; milestone: string; endsOn: string }> };
  cards: DashboardCard[];
  trend: { metric: GoalMetric; kind: PeriodKind; labels: string[]; actual: number[]; goal: Array<number | null> };
  projects: Array<{ id: string; title: string; founder_name: string | null; owner_name: string | null; milestone: string; meetingsHeld: number; meetingsGoal: number | null; termSheets: number; termGoal: number | null; matches: number }>;
  byAgent: Array<{ id: string; name: string; emails: number; calls: number; booked: number }>;
  overdue: Array<{ id: string; subject: string; matchId: string | null; projectId: string; projectTitle: string; investor: string | null; daysLate: number }>;
  lifecycle: Array<{ stage: IrStage; count: number }>;
  lifecycleByProject: Array<{ projectId: string; title: string; stages: Record<IrStage, number> }>;
  founderOptions: Array<{ id: string; title: string }>;
};

const TREND_N: Record<PeriodKind, number> = { week: 8, month: 6 };
const today = () => new Date().toISOString().slice(0, 10);

export async function dashboardPayload(q: DashboardQuery): Promise<DashboardPayload> {
  const day = q.today ?? today();
  const projects = await listProjects({ status: "active" });
  const ids = projects.map((p) => p.id);
  const period = periodFor(q.period, day);
  const trendPeriods = trailingPeriods(q.trendKind, day, TREND_N[q.trendKind]);
  const windowStart = [period.start, trendPeriods[0].start].sort()[0];

  const [acts, matches, events, goals, milestones] = await Promise.all([
    loadActivities(ids, windowStart), loadMatches(ids), loadEvents(ids), listGoals({ from: windowStart, projectIds: ids }),
    ids.length ? db().from("ir_milestones").select("project_id, kind, label, starts_on, ends_on").in("project_id", ids).eq("kind", "month") : Promise.resolve({ data: [] }),
  ]);
  const monthsByProject = new Map<string, Array<{ label: string; startsOn: string; endsOn: string }>>();
  for (const m of ((milestones as { data: unknown[] }).data ?? []) as Array<{ project_id: string; label: string; starts_on: string; ends_on: string }>) {
    monthsByProject.set(m.project_id, [...(monthsByProject.get(m.project_id) ?? []), { label: m.label, startsOn: m.starts_on, endsOn: m.ends_on }]);
  }
  const milestoneLabel = (p: IrProject) => {
    const ms = monthsByProject.get(p.id) ?? []; const cur = milestoneOn(ms, day);
    return cur ? `${cur.label} of ${p.term_months}` : day < p.start_date ? "Not started" : "Term ended";
  };
  const inFinalMonth = (p: IrProject) => { const ms = monthsByProject.get(p.id) ?? []; const cur = milestoneOn(ms, day); return cur?.label === `Month ${p.term_months}`; };

  const matchProject = new Map(matches.map((m) => [m.id, m.project_id]));
  const byProject = (pid: string) => ({ a: acts.filter((x) => x.project_id === pid), m: matches.filter((x) => x.project_id === pid), e: events.filter((x) => matchProject.get(x.match_id) === pid) });
  const staffIds = [...new Set([...acts.map((a) => a.assignee_id ?? a.created_by ?? null), ...projects.map((p) => p.owner_id)])].filter((x): x is string => Boolean(x));
  const names = await nameMap(staffIds);
  const agentOf = (a: ActivityLite) => a.assignee_id ?? a.created_by ?? null;

  // Cards for the selected period
  const all = countMetrics(acts, matches, events, period);
  const perProjectCounts = new Map(projects.map((p) => { const s = byProject(p.id); return [p.id, countMetrics(s.a, s.m, s.e, period)] as const; }));
  const cards: DashboardCard[] = (["meetings_held", "term_sheets", "calls", "emails"] as GoalMetric[]).map((metric) => {
    const target = goalTarget(goals, { projectId: null, metric, kind: q.period, start: period.start });
    const perAgent = new Map<string, number>();
    if (metric === "term_sheets") { for (const m of matches) if (m.term_sheet_received_at && m.term_sheet_received_at >= toTs(period.start) && m.term_sheet_received_at < toTs(period.end) && m.assignee_id) perAgent.set(m.assignee_id, (perAgent.get(m.assignee_id) ?? 0) + 1); }
    else for (const a of acts) { const who = agentOf(a); if (!who) continue; const c = countMetrics([a], [], [], period); if (c[metric]) perAgent.set(who, (perAgent.get(who) ?? 0) + c[metric]); }
    return {
      metric, actual: all[metric], target, attainment: attainment(all[metric], target),
      perProject: projects.map((p) => ({ projectId: p.id, title: p.title, actual: perProjectCounts.get(p.id)![metric], target: goalTarget(goals, { projectId: p.id, metric, kind: q.period, start: period.start }) })),
      perAgent: [...perAgent].map(([id, actual]) => ({ id, name: names.get(id) ?? "Staff", actual })).sort((x, y) => y.actual - x.actual),
    };
  });

  // Trend
  const scope = q.founder ? byProject(q.founder) : { a: acts, m: matches, e: events };
  const trend = {
    metric: q.trendMetric, kind: q.trendKind,
    labels: trendPeriods.map((p) => q.trendKind === "week" ? `W/c ${new Date(toTs(p.start)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}` : new Date(toTs(p.start)).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })),
    actual: trendPeriods.map((p) => countMetrics(scope.a, scope.m, scope.e, p)[q.trendMetric]),
    goal: trendPeriods.map((p) => goalTarget(goals, { projectId: q.founder, metric: q.trendMetric, kind: q.trendKind, start: p.start })),
  };

  // Projects table — project to date; goal = sum of the project's goal rows for that metric (any period)
  const projectRows = projects.map((p) => {
    const s = byProject(p.id); const toDate = countMetrics(s.a, s.m, s.e, { start: p.start_date, end: "9999-12-31" });
    const sumGoal = (metric: GoalMetric) => { const rows = goals.filter((g) => g.project_id === p.id && g.metric === metric && !g.assignee_id); return rows.length ? rows.reduce((t, g) => t + Number(g.target), 0) : null; };
    return { id: p.id, title: p.title, founder_name: p.founder_name, owner_name: p.owner_name, milestone: milestoneLabel(p), meetingsHeld: toDate.meetings_held, meetingsGoal: sumGoal("meetings_held"), termSheets: toDate.term_sheets, termGoal: sumGoal("term_sheets"), matches: s.m.length };
  });

  // Activity by agent this calendar week
  const week = periodFor("week", day);
  const agentRows = new Map<string, { emails: number; calls: number; booked: number }>();
  for (const a of acts) { const who = agentOf(a); if (!who) continue; const c = countMetrics([a], [], [], week); if (!c.emails && !c.calls && !c.meetings_booked) continue; const r = agentRows.get(who) ?? { emails: 0, calls: 0, booked: 0 }; r.emails += c.emails; r.calls += c.calls; r.booked += c.meetings_booked; agentRows.set(who, r); }
  const byAgent = [...agentRows].map(([id, r]) => ({ id, name: names.get(id) ?? "Staff", ...r })).sort((x, y) => (y.emails + y.calls + y.booked) - (x.emails + x.calls + x.booked));

  // Overdue
  const nowTs = new Date().toISOString();
  const overdueRaw = acts.filter((a) => !a.done_at && a.due_at && a.due_at < nowTs).sort((x, y) => (x.due_at! < y.due_at! ? -1 : 1)).slice(0, 12);
  const inv = await investorMap(overdueRaw.map((a) => a.match_id ? matches.find((m) => m.id === a.match_id)?.investor_contact_id ?? "" : "").filter(Boolean));
  const titles = new Map(projects.map((p) => [p.id, p.title]));
  const overdue = overdueRaw.map((a) => {
    const m = a.match_id ? matches.find((x) => x.id === a.match_id) : null;
    return { id: a.id, subject: a.subject, matchId: a.match_id, projectId: a.project_id, projectTitle: titles.get(a.project_id) ?? "Project", investor: m ? inv.get(m.investor_contact_id)?.name ?? inv.get(m.investor_contact_id)?.firm ?? null : null, daysLate: Math.max(1, Math.floor((Date.now() - new Date(a.due_at!).getTime()) / 86_400_000)) };
  });

  const counts = Object.fromEntries(IR_STAGES.map((s) => [s, 0])) as Record<IrStage, number>;
  for (const m of matches) counts[m.stage]++;

  return {
    period: { kind: q.period, ...period, label: periodLabel(q.period, period) },
    founders: { active: projects.length, finalMonth: projects.filter(inFinalMonth).length, list: projects.map((p) => ({ id: p.id, title: p.title, founder_name: p.founder_name, owner_name: p.owner_name, milestone: milestoneLabel(p), endsOn: p.end_date })) },
    cards, trend, projects: projectRows, byAgent, overdue,
    lifecycle: IR_STAGES.map((stage) => ({ stage, count: counts[stage] })),
    lifecycleByProject: projects.map((p) => { const st = Object.fromEntries(IR_STAGES.map((s) => [s, 0])) as Record<IrStage, number>; for (const m of matches) if (m.project_id === p.id) st[m.stage]++; return { projectId: p.id, title: p.title, stages: st }; }),
    founderOptions: projects.map((p) => ({ id: p.id, title: p.title })),
  };
}

// ── Slim loaders (service role; staff auth happens in the route) ────────────
export async function loadActivities(projectIds: string[], sinceDay: string): Promise<ActivityLite[]> {
  if (!projectIds.length) return [];
  const since = toTs(sinceDay);
  const cols = "id, project_id, match_id, type, subject, created_at, done_at, due_at, assignee_id, created_by";
  const [{ data: done }, { data: open }] = await Promise.all([
    db().from("ir_activities").select(cols).in("project_id", projectIds).or(`done_at.gte.${since},created_at.gte.${since}`).limit(20000),
    db().from("ir_activities").select(cols).in("project_id", projectIds).is("done_at", null).limit(5000),
  ]);
  const seen = new Set<string>(); const out: ActivityLite[] = [];
  for (const r of [...((done ?? []) as ActivityLite[]), ...((open ?? []) as ActivityLite[])]) if (!seen.has(r.id)) { seen.add(r.id); out.push(r); }
  return out;
}
export async function loadMatches(projectIds: string[]): Promise<Array<MatchLite & { investor_contact_id: string; task_id: string | null }>> {
  if (!projectIds.length) return [];
  const { data } = await db().from("ir_matches").select("id, project_id, investor_contact_id, stage, term_sheet_received_at, assignee_id, task_id").in("project_id", projectIds).limit(20000);
  return (data ?? []) as Array<MatchLite & { investor_contact_id: string; task_id: string | null }>;
}
export async function loadEvents(projectIds: string[]): Promise<StageEventLite[]> {
  if (!projectIds.length) return [];
  const { data } = await db().from("ir_match_stage_events").select("match_id, to_stage, changed_at, match:ir_matches!inner(project_id)").in("match.project_id", projectIds).limit(50000);
  return ((data ?? []) as Array<{ match_id: string; to_stage: IrStage; changed_at: string }>).map((e) => ({ match_id: e.match_id, to_stage: e.to_stage, changed_at: e.changed_at }));
}
export { GOAL_METRICS };
export type { GoalLite, MetricCounts };
