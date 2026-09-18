/**
 * IR Hub data access — service-role only (server). Staff authorization happens in the
 * API routes (requireRole admin/analyst); founder-facing reads go through
 * founder-report.ts which selects only founder-safe fields.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { generateMilestones } from "@/lib/ir/milestones";
import { PLAN_LABELS, type PlanType } from "@/lib/subscriptions/plans";
import type { GoalMetric, PeriodKind } from "@/lib/ir/metrics";
import { INTRO_DUE_DAYS, INTRO_SUBJECT, type IrActivity, type IrBlocker, type IrMatch, type IrMilestone, type IrNote, type IrProject, type IrStage, type IrTask, type StaffOption } from "@/lib/ir/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function db(): any { return createServiceRoleClient(); }

function must<T>(r: { data: T | null; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  if (r.data == null) throw new Error(`${what}: no data`);
  return r.data;
}

// ── People / names ──────────────────────────────────────────────────────────
export async function listStaff(): Promise<StaffOption[]> {
  const { data } = await db().from("profiles").select("id, full_name, email").in("role", ["admin", "analyst"]).order("full_name");
  return ((data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((p) => ({ id: p.id, name: p.full_name ?? p.email ?? "Staff" }));
}
export async function nameMap(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!uniq.length) return new Map();
  const { data } = await db().from("profiles").select("id, full_name, email").in("id", uniq);
  return new Map(((data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((p) => [p.id, p.full_name ?? p.email ?? "—"]));
}
/** Investor display fields from crm_contacts — name + firm only; never phone / email. */
export async function investorMap(ids: string[]): Promise<Map<string, { name: string | null; firm: string | null; inv_source: string | null }>> {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return new Map();
  const out = new Map<string, { name: string | null; firm: string | null; inv_source: string | null }>();
  for (let i = 0; i < uniq.length; i += 500) {
    const { data } = await db().from("crm_contacts").select("id, name, company, inv_source").in("id", uniq.slice(i, i + 500));
    for (const c of (data ?? []) as Array<{ id: string; name: string | null; company: string | null; inv_source: string | null }>) out.set(c.id, { name: c.name, firm: c.company, inv_source: c.inv_source });
  }
  return out;
}

// ── Projects ────────────────────────────────────────────────────────────────
const PROJECT_COLS = "id, company_id, founder_contact_id, title, founder_name, owner_id, source_opportunity_id, start_date, term_months, end_date, status, founder_report_visible, is_spv, starred, weekly_summary, monthly_summary, created_at";

async function withOwnerNames(rows: Array<Record<string, unknown>>): Promise<IrProject[]> {
  const names = await nameMap(rows.map((r) => r.owner_id as string));
  return rows.map((r) => ({ ...(r as unknown as IrProject), owner_name: names.get(r.owner_id as string) ?? null }));
}

export async function listProjects(opts: { status?: string | null } = {}): Promise<IrProject[]> {
  let q = db().from("ir_projects").select(PROJECT_COLS).order("starred", { ascending: false }).order("created_at", { ascending: false });
  if (opts.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw new Error(`listProjects: ${error.message}`);
  return withOwnerNames((data ?? []) as Array<Record<string, unknown>>);
}

export async function getProject(id: string): Promise<IrProject | null> {
  const { data } = await db().from("ir_projects").select(PROJECT_COLS).eq("id", id).maybeSingle();
  if (!data) return null;
  return (await withOwnerNames([data as Record<string, unknown>]))[0];
}

export async function listMilestones(projectId: string): Promise<IrMilestone[]> {
  const { data, error } = await db().from("ir_milestones").select("*").eq("project_id", projectId).order("kind").order("sort_order");
  if (error) throw new Error(`listMilestones: ${error.message}`);
  return (data ?? []) as IrMilestone[];
}

export type CreateProjectInput = {
  companyId: string | null; title: string; founderName: string | null; founderContactId: string | null; ownerId: string;
  sourceOpportunityId: string | null; startDate: string; termMonths: number; founderReportVisible: boolean; isSpv: boolean; createdBy: string;
};

/** Insert the project, then its month + week milestones (weeks parented to their month). */
export async function createProject(input: CreateProjectInput): Promise<{ id: string }> {
  const project = must(await db().from("ir_projects").insert({
    company_id: input.companyId, title: input.title, founder_name: input.founderName, founder_contact_id: input.founderContactId,
    owner_id: input.ownerId, source_opportunity_id: input.sourceOpportunityId, start_date: input.startDate, term_months: input.termMonths,
    founder_report_visible: input.founderReportVisible, is_spv: input.isSpv, created_by: input.createdBy,
  }).select("id").single(), "createProject") as { id: string };

  const drafts = generateMilestones(input.startDate, input.termMonths);
  const months = must(await db().from("ir_milestones").insert(
    drafts.filter((d) => d.kind === "month").map((d) => ({ project_id: project.id, kind: "month", label: d.label, starts_on: d.startsOn, ends_on: d.endsOn, sort_order: d.sortOrder })),
  ).select("id, sort_order"), "createProject months") as Array<{ id: string; sort_order: number }>;
  const monthId = new Map(months.map((m) => [m.sort_order, m.id]));
  must(await db().from("ir_milestones").insert(
    drafts.filter((d) => d.kind === "week").map((d) => ({ project_id: project.id, parent_id: monthId.get(d.monthIndex) ?? null, kind: "week", label: d.label, starts_on: d.startsOn, ends_on: d.endsOn, sort_order: d.sortOrder })),
  ).select("id"), "createProject weeks");
  return { id: project.id };
}

export async function updateProject(id: string, patch: Partial<{ status: string; owner_id: string; founder_report_visible: boolean; starred: boolean; is_spv: boolean; title: string; weekly_summary: boolean; monthly_summary: boolean }>): Promise<void> {
  const { error } = await db().from("ir_projects").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`updateProject: ${error.message}`);
}

/** Closed-won Sales Hub opportunities that don't have an IR project yet (the "source deal" picker). */
export async function listClosedWonSources(): Promise<Array<{ id: string; title: string; contact_name: string | null; contact_crm_id: string | null; company_id: string | null; won_at: string }>> {
  const [{ data: opps }, { data: used }] = await Promise.all([
    db().from("sales_opportunities").select("id, title, contact_name, contact_crm_id, company_id, updated_at").eq("status", "won").order("updated_at", { ascending: false }).limit(200),
    db().from("ir_projects").select("source_opportunity_id").not("source_opportunity_id", "is", null),
  ]);
  const taken = new Set(((used ?? []) as Array<{ source_opportunity_id: string }>).map((u) => u.source_opportunity_id));
  return ((opps ?? []) as Array<{ id: string; title: string; contact_name: string | null; contact_crm_id: string | null; company_id: string | null; updated_at: string }>)
    .filter((o) => !taken.has(o.id))
    .map((o) => ({ id: o.id, title: o.title, contact_name: o.contact_name, contact_crm_id: o.contact_crm_id, company_id: o.company_id, won_at: o.updated_at }));
}

/** Founder companies for the picker when there's no closed-won deal (manual start). */
export async function listFounderCompanies(): Promise<Array<{ id: string; name: string; founder_name: string | null }>> {
  const { data } = await db().from("companies").select("id, company_name, founder_id").order("company_name").limit(500);
  const rows = (data ?? []) as Array<{ id: string; company_name: string; founder_id: string | null }>;
  const names = await nameMap(rows.map((r) => r.founder_id));
  return rows.map((r) => ({ id: r.id, name: r.company_name, founder_name: r.founder_id ? names.get(r.founder_id) ?? null : null }));
}

// ── Tasks (weekly batches) ──────────────────────────────────────────────────
export async function listTasks(projectId: string): Promise<IrTask[]> {
  const { data, error } = await db().from("ir_tasks").select("*").eq("project_id", projectId).order("created_at");
  if (error) throw new Error(`listTasks: ${error.message}`);
  const rows = (data ?? []) as IrTask[];
  const names = await nameMap(rows.map((r) => r.assignee_id));
  return rows.map((r) => ({ ...r, assignee_name: r.assignee_id ? names.get(r.assignee_id) ?? null : null }));
}
export async function getTask(id: string): Promise<IrTask | null> {
  const { data } = await db().from("ir_tasks").select("*").eq("id", id).maybeSingle();
  return (data as IrTask | null) ?? null;
}
export async function createTask(input: { projectId: string; milestoneId: string; title: string; assigneeId: string | null; deadline?: string | null }): Promise<{ id: string }> {
  return must(await db().from("ir_tasks").insert({ project_id: input.projectId, milestone_id: input.milestoneId, title: input.title, assignee_id: input.assigneeId, deadline: input.deadline ?? null }).select("id").single(), "createTask") as { id: string };
}
export async function updateTask(id: string, patch: Partial<{ title: string; status: string; assignee_id: string | null; starred: boolean; notes: string | null; deadline: string | null; milestone_id: string; blockers: IrBlocker[] }>): Promise<void> {
  const { error } = await db().from("ir_tasks").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`updateTask: ${error.message}`);
}

// ── Matches ─────────────────────────────────────────────────────────────────
const MATCH_COLS = "id, project_id, investor_contact_id, task_id, milestone_id, stage, assignee_id, fit_tier, data_source, founder_visible, starred, stage_changed_at, term_sheet_received_at, meeting_booking_id, blockers, created_at";

async function decorateMatches(rows: Array<Record<string, unknown>>): Promise<IrMatch[]> {
  const [inv, names] = await Promise.all([investorMap(rows.map((r) => r.investor_contact_id as string)), nameMap(rows.map((r) => r.assignee_id as string | null))]);
  return rows.map((r) => {
    const i = inv.get(r.investor_contact_id as string);
    return { ...(r as unknown as IrMatch), investor_name: i?.name ?? null, investor_firm: i?.firm ?? null, assignee_name: r.assignee_id ? names.get(r.assignee_id as string) ?? null : null };
  });
}

export async function listMatches(projectId: string): Promise<IrMatch[]> {
  const { data, error } = await db().from("ir_matches").select(MATCH_COLS).eq("project_id", projectId).order("stage_changed_at", { ascending: false });
  if (error) throw new Error(`listMatches: ${error.message}`);
  return decorateMatches((data ?? []) as Array<Record<string, unknown>>);
}
export async function getMatch(id: string): Promise<IrMatch | null> {
  const { data } = await db().from("ir_matches").select(MATCH_COLS).eq("id", id).maybeSingle();
  if (!data) return null;
  return (await decorateMatches([data as Record<string, unknown>]))[0];
}
/** Other projects this investor is matched on ("Also matched"). */
export async function alsoMatched(investorContactId: string, exceptMatchId: string): Promise<Array<{ match_id: string; project_id: string; project_title: string; stage: IrStage }>> {
  const { data } = await db().from("ir_matches").select("id, project_id, stage, project:ir_projects(title)").eq("investor_contact_id", investorContactId).neq("id", exceptMatchId);
  return ((data ?? []) as Array<{ id: string; project_id: string; stage: IrStage; project: { title: string } | null }>).map((r) => ({ match_id: r.id, project_id: r.project_id, project_title: r.project?.title ?? "Project", stage: r.stage }));
}

/** Confirm investors onto a project (optionally inside a week task). Skips ones already
 *  matched (the unique constraint), and opens the "Send intro email" to-do for each new one. */
export async function createMatches(input: { projectId: string; taskId: string | null; milestoneId: string | null; investorContactIds: string[]; assigneeId: string | null; createdBy: string; fitTiers?: Record<string, "high" | "medium" | "low" | null>; dataSources?: Record<string, string | null> }): Promise<{ created: string[]; skipped: number }> {
  const { data: existing } = await db().from("ir_matches").select("investor_contact_id").eq("project_id", input.projectId).in("investor_contact_id", input.investorContactIds);
  const have = new Set(((existing ?? []) as Array<{ investor_contact_id: string }>).map((e) => e.investor_contact_id));
  const fresh = [...new Set(input.investorContactIds)].filter((id) => !have.has(id));
  if (!fresh.length) return { created: [], skipped: input.investorContactIds.length };
  const inserts = fresh.map((cid) => ({
    project_id: input.projectId, investor_contact_id: cid, task_id: input.taskId, milestone_id: input.milestoneId,
    assignee_id: input.assigneeId, fit_tier: input.fitTiers?.[cid] ?? null, data_source: input.dataSources?.[cid] ?? null, created_by: input.createdBy,
  }));
  const rows = must(await db().from("ir_matches").insert(inserts).select("id"), "createMatches") as Array<{ id: string }>;
  const due = new Date(Date.now() + INTRO_DUE_DAYS * 86_400_000).toISOString();
  await db().from("ir_activities").insert(rows.map((r) => ({
    project_id: input.projectId, match_id: r.id, task_id: input.taskId, type: "email", subject: INTRO_SUBJECT, due_at: due, assignee_id: input.assigneeId, created_by: input.createdBy,
  })));
  return { created: rows.map((r) => r.id), skipped: input.investorContactIds.length - fresh.length };
}

/** Stage / flags on a match. The stage trigger records the event; `actor` is passed so it can attribute it. */
export async function updateMatch(id: string, patch: Partial<{ stage: IrStage; assignee_id: string | null; starred: boolean; founder_visible: boolean; term_sheet_received_at: string | null; task_id: string | null; milestone_id: string | null; meeting_booking_id: string | null; blockers: IrBlocker[] }>, actor: string): Promise<void> {
  const client = db();
  const { error } = await client.from("ir_matches").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`updateMatch: ${error.message}`);
  // The trigger writes the stage event without an actor (PostgREST can't carry a session
  // setting into the update); stamp it here so "who moved it" is on the record.
  if (patch.stage) {
    await client.from("ir_match_stage_events").update({ changed_by: actor }).eq("match_id", id).is("changed_by", null);
  }
}

export async function listStageEvents(matchId: string): Promise<Array<{ from_stage: IrStage | null; to_stage: IrStage; changed_by: string | null; changed_at: string }>> {
  const { data } = await db().from("ir_match_stage_events").select("from_stage, to_stage, changed_by, changed_at").eq("match_id", matchId).order("changed_at");
  return (data ?? []) as Array<{ from_stage: IrStage | null; to_stage: IrStage; changed_by: string | null; changed_at: string }>;
}

// ── Activities ──────────────────────────────────────────────────────────────
async function decorateActivities(rows: IrActivity[]): Promise<IrActivity[]> {
  const names = await nameMap(rows.map((r) => r.created_by));
  return rows.map((r) => ({ ...r, created_by_name: names.get(r.created_by) ?? null }));
}
export async function listActivities(where: { matchId?: string; taskId?: string; projectId?: string; openOnly?: boolean }): Promise<IrActivity[]> {
  let q = db().from("ir_activities").select("*");
  if (where.matchId) q = q.eq("match_id", where.matchId);
  if (where.taskId) q = q.eq("task_id", where.taskId);
  if (where.projectId) q = q.eq("project_id", where.projectId);
  if (where.openOnly) q = q.is("done_at", null);
  const { data, error } = await q.order("done_at", { ascending: false, nullsFirst: true }).order("due_at", { ascending: true, nullsFirst: false }).limit(1000);
  if (error) throw new Error(`listActivities: ${error.message}`);
  return decorateActivities((data ?? []) as IrActivity[]);
}
export async function createActivity(input: { projectId: string; matchId: string | null; taskId: string | null; type: string; subject: string; description?: string | null; outcome?: string | null; nextStep?: string | null; dueAt?: string | null; doneAt?: string | null; founderVisible?: boolean; assigneeId?: string | null; calendarEventId?: string | null; createdBy: string }): Promise<{ id: string }> {
  return must(await db().from("ir_activities").insert({
    project_id: input.projectId, match_id: input.matchId, task_id: input.taskId, type: input.type, subject: input.subject,
    description: input.description ?? null, outcome: input.outcome ?? null, next_step: input.nextStep ?? null,
    due_at: input.dueAt ?? null, done_at: input.doneAt ?? null, founder_visible: input.founderVisible ?? true,
    assignee_id: input.assigneeId ?? null, calendar_event_id: input.calendarEventId ?? null, created_by: input.createdBy,
  }).select("id").single(), "createActivity") as { id: string };
}
export async function updateActivity(id: string, patch: Partial<{ subject: string; description: string | null; outcome: string | null; next_step: string | null; due_at: string | null; done_at: string | null; founder_visible: boolean; assignee_id: string | null; type: string }>): Promise<void> {
  const { error } = await db().from("ir_activities").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`updateActivity: ${error.message}`);
}
export async function deleteActivity(id: string): Promise<void> {
  const { error } = await db().from("ir_activities").delete().eq("id", id);
  if (error) throw new Error(`deleteActivity: ${error.message}`);
}

// ── Notes ───────────────────────────────────────────────────────────────────
export async function listNotes(where: { projectId?: string; matchId?: string }): Promise<IrNote[]> {
  let q = db().from("ir_notes").select("*");
  if (where.projectId) q = q.eq("project_id", where.projectId);
  if (where.matchId) q = q.eq("match_id", where.matchId);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(500);
  if (error) throw new Error(`listNotes: ${error.message}`);
  const rows = (data ?? []) as IrNote[];
  const names = await nameMap(rows.map((r) => r.created_by));
  return rows.map((r) => ({ ...r, created_by_name: names.get(r.created_by) ?? null }));
}
export async function createNote(input: { projectId: string; matchId: string | null; body: string; founderVisible: boolean; notedOn?: string | null; createdBy: string }): Promise<{ id: string }> {
  return must(await db().from("ir_notes").insert({ project_id: input.projectId, match_id: input.matchId, body: input.body, founder_visible: input.founderVisible, noted_on: input.notedOn ?? undefined, created_by: input.createdBy }).select("id").single(), "createNote") as { id: string };
}
export async function updateNote(id: string, patch: Partial<{ body: string; founder_visible: boolean }>): Promise<void> {
  const { error } = await db().from("ir_notes").update(patch).eq("id", id);
  if (error) throw new Error(`updateNote: ${error.message}`);
}

// ── Aggregates for cards ────────────────────────────────────────────────────
export async function projectCounts(projectIds: string[]): Promise<Map<string, { matches: number; tasks: number; openActivities: number; lateActivities: number; meetingsHeld: number; termSheets: number; stages: Partial<Record<IrStage, number>> }>> {
  const out = new Map<string, { matches: number; tasks: number; openActivities: number; lateActivities: number; meetingsHeld: number; termSheets: number; stages: Partial<Record<IrStage, number>> }>();
  if (!projectIds.length) return out;
  const blank = () => ({ matches: 0, tasks: 0, openActivities: 0, lateActivities: 0, meetingsHeld: 0, termSheets: 0, stages: {} as Partial<Record<IrStage, number>> });
  for (const id of projectIds) out.set(id, blank());
  const now = new Date().toISOString();
  const [{ data: m }, { data: t }, { data: a }] = await Promise.all([
    db().from("ir_matches").select("project_id, stage, term_sheet_received_at").in("project_id", projectIds),
    db().from("ir_tasks").select("project_id").in("project_id", projectIds),
    db().from("ir_activities").select("project_id, type, due_at, done_at").in("project_id", projectIds),
  ]);
  for (const r of (m ?? []) as Array<{ project_id: string; stage: IrStage; term_sheet_received_at: string | null }>) {
    const c = out.get(r.project_id)!; c.matches++; c.stages[r.stage] = (c.stages[r.stage] ?? 0) + 1; if (r.term_sheet_received_at) c.termSheets++;
  }
  for (const r of (t ?? []) as Array<{ project_id: string }>) out.get(r.project_id)!.tasks++;
  for (const r of (a ?? []) as Array<{ project_id: string; type: string; due_at: string | null; done_at: string | null }>) {
    const c = out.get(r.project_id)!;
    if (!r.done_at) { c.openActivities++; if (r.due_at && r.due_at < now) c.lateActivities++; }
    else if (r.type === "meeting") c.meetingsHeld++;
  }
  return out;
}

// ── Goals (dashboard) ───────────────────────────────────────────────────────
export type IrGoal = { id: string; project_id: string | null; assignee_id: string | null; metric: GoalMetric; period_kind: PeriodKind; period_start: string; period_end: string; target: number };

/** Goal rows whose period starts inside [from, to). */
export async function listGoals(where: { kind?: PeriodKind; from?: string; to?: string; projectIds?: string[] } = {}): Promise<IrGoal[]> {
  let q = db().from("ir_goals").select("id, project_id, assignee_id, metric, period_kind, period_start, period_end, target");
  if (where.kind) q = q.eq("period_kind", where.kind);
  if (where.from) q = q.gte("period_start", where.from);
  if (where.to) q = q.lt("period_start", where.to);
  const { data, error } = await q.limit(5000);
  if (error) throw new Error(`listGoals: ${error.message}`);
  const rows = (data ?? []) as IrGoal[];
  return where.projectIds ? rows.filter((g) => g.project_id === null || where.projectIds!.includes(g.project_id)) : rows;
}

/** Replace the targets for one period: a null/absent target removes the row. Only project-level and firm-wide rows (assignee null). */
export async function saveGoals(input: { kind: PeriodKind; start: string; end: string; rows: Array<{ projectId: string | null; metric: GoalMetric; target: number | null }>; by: string }): Promise<void> {
  const client = db();
  const existing = (await listGoals({ kind: input.kind, from: input.start, to: addDaysIso(input.start, 1) })).filter((g) => g.period_start === input.start && !g.assignee_id);
  const key = (p: string | null, m: string) => `${p ?? "firm"}:${m}`;
  const have = new Map(existing.map((g) => [key(g.project_id, g.metric), g]));
  const inserts: Array<Record<string, unknown>> = [];
  for (const r of input.rows) {
    const cur = have.get(key(r.projectId, r.metric));
    if (r.target == null || Number.isNaN(r.target)) {
      if (cur) { const { error } = await client.from("ir_goals").delete().eq("id", cur.id); if (error) throw new Error(`saveGoals: ${error.message}`); }
      continue;
    }
    if (cur) {
      if (Number(cur.target) !== r.target) { const { error } = await client.from("ir_goals").update({ target: r.target }).eq("id", cur.id); if (error) throw new Error(`saveGoals: ${error.message}`); }
    } else {
      inserts.push({ project_id: r.projectId, assignee_id: null, metric: r.metric, period_kind: input.kind, period_start: input.start, period_end: input.end, target: r.target, created_by: input.by });
    }
  }
  if (inserts.length) { const { error } = await client.from("ir_goals").insert(inserts); if (error) throw new Error(`saveGoals: ${error.message}`); }
}
function addDaysIso(day: string, n: number): string { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

// ── Reports (founder report snapshots) ─────────────────────────────────────
export type IrReportRow = { id: string; project_id: string; period_kind: "week" | "month" | "custom"; period_start: string; period_end: string; exec_summary: Record<string, unknown>; metrics: Record<string, unknown>; approved_by: string | null; approved_at: string | null; sent_to: string | null; sent_at: string | null; created_by: string; created_at: string; updated_at: string };
const REPORT_COLS = "id, project_id, period_kind, period_start, period_end, exec_summary, metrics, approved_by, approved_at, sent_to, sent_at, created_by, created_at, updated_at";

export async function findReport(projectId: string, period: { kind: string; start: string; end: string }): Promise<IrReportRow | null> {
  const { data } = await db().from("ir_reports").select(REPORT_COLS).eq("project_id", projectId).eq("period_kind", period.kind).eq("period_start", period.start).eq("period_end", period.end).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as IrReportRow | null) ?? null;
}
export async function getReport(id: string): Promise<IrReportRow | null> {
  const { data } = await db().from("ir_reports").select(REPORT_COLS).eq("id", id).maybeSingle();
  return (data as IrReportRow | null) ?? null;
}
export async function upsertReport(input: { projectId: string; period: { kind: string; start: string; end: string }; execSummary: Record<string, unknown>; metrics: Record<string, unknown>; approve: boolean; by: string }): Promise<IrReportRow> {
  const cur = await findReport(input.projectId, input.period);
  const stamp = new Date().toISOString();
  const patch = { exec_summary: input.execSummary, metrics: input.metrics, approved_by: input.approve ? input.by : null, approved_at: input.approve ? stamp : null, updated_at: stamp };
  if (cur) return must(await db().from("ir_reports").update(patch).eq("id", cur.id).select(REPORT_COLS).single(), "upsertReport") as IrReportRow;
  return must(await db().from("ir_reports").insert({ project_id: input.projectId, period_kind: input.period.kind, period_start: input.period.start, period_end: input.period.end, created_by: input.by, ...patch }).select(REPORT_COLS).single(), "upsertReport") as IrReportRow;
}
export async function markReportSent(id: string, to: string): Promise<void> {
  const { error } = await db().from("ir_reports").update({ sent_to: to, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`markReportSent: ${error.message}`);
}

/** Founder's email for the report — from the project's founder contact, else the company's founder profile. Staff-only. */
export async function founderEmail(project: { founder_contact_id: string | null; company_id: string | null }): Promise<string | null> {
  if (project.founder_contact_id) {
    const { data } = await db().from("crm_contacts").select("email").eq("id", project.founder_contact_id).maybeSingle();
    const e = (data as { email: string | null } | null)?.email; if (e && e.includes("@")) return e;
  }
  if (project.company_id) {
    const { data } = await db().from("companies").select("founder_id").eq("id", project.company_id).maybeSingle();
    const fid = (data as { founder_id: string | null } | null)?.founder_id;
    if (fid) { const { data: p } = await db().from("profiles").select("email").eq("id", fid).maybeSingle(); const e = (p as { email: string | null } | null)?.email; if (e && e.includes("@")) return e; }
  }
  return null;
}

// ── Entrepreneur profile (Share Project + Task form tab) ────────────────────
export type EntrepreneurProfile = { company: string; founder: string | null; membershipType: string | null; portalPlan: string | null; raise: string | null; stage: string | null; industry: string | null; companyId: string | null; founderContactId: string | null };
export async function entrepreneurProfile(project: IrProject): Promise<EntrepreneurProfile> {
  const out: EntrepreneurProfile = { company: project.title, founder: project.founder_name, membershipType: null, portalPlan: null, raise: null, stage: null, industry: null, companyId: project.company_id, founderContactId: project.founder_contact_id };
  if (project.company_id) {
    const { data } = await db().from("companies").select("company_name, founder_id, industry, funding_amount, revenue_stage").eq("id", project.company_id).maybeSingle();
    const c = data as { company_name: string; founder_id: string | null; industry: string | null; funding_amount: number | null; revenue_stage: string | null } | null;
    if (c) {
      out.company = c.company_name; out.industry = c.industry; out.stage = c.revenue_stage;
      out.raise = c.funding_amount != null ? `$${Number(c.funding_amount).toLocaleString()}` : null;
      if (c.founder_id) {
        const { data: sub } = await db().from("subscriptions").select("plan_type, subscription_status").eq("profile_id", c.founder_id).maybeSingle();
        const sp = sub as { plan_type: string | null; subscription_status: string | null } | null;
        if (sp?.plan_type) out.portalPlan = `${PLAN_LABELS[sp.plan_type as PlanType] ?? sp.plan_type}${sp.subscription_status ? ` · ${sp.subscription_status}` : ""}`;
      }
    }
  }
  if (project.founder_contact_id) {
    const { data } = await db().from("crm_contacts").select("profile, company").eq("id", project.founder_contact_id).maybeSingle();
    const c = data as { profile: Record<string, unknown> | null; company: string | null } | null;
    const p = c?.profile ?? {};
    out.membershipType = (p.membershipType as string | undefined) ?? (p.membership_type as string | undefined) ?? null;
    out.portalPlan = out.portalPlan ?? ((p.plan as string | undefined) ?? null);
    if (!out.raise && typeof p.raise === "string") out.raise = p.raise;
    if (!out.stage) { const st = p.operatingStages ?? p.fundingStages; out.stage = Array.isArray(st) ? (st as string[]).join(", ") : typeof st === "string" ? st : null; }
    if (!out.industry) { const ind = p.industries; out.industry = Array.isArray(ind) ? (ind as string[]).join(", ") : null; }
  }
  return out;
}
