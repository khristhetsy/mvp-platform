/**
 * Odoo ↔ IR Hub reconciliation (rollout steps 6 and 8) — server only, Odoo read-only.
 *   reconcileProject: for one imported project, Odoo's tasks / investor tags / Agent Field
 *   entries against the IR Hub's tasks / matches / activities, per month and per project
 *   week, with drift lists (Odoo tasks not yet imported, tags with no match).
 *   odooSnapshot: the full Deals2Match export (projects, tasks with tags, assignees and
 *   the Agent Field) for the pre-cutover backup.
 */
import { db, getProject, listMilestones } from "@/lib/ir/db";
import { isOutreach, type ActivityLite } from "@/lib/ir/metrics";
type Act = ActivityLite & { task_id: string | null };
import { discover, odooProjects, odooTasks, taskEntries, type OdooTaskLite } from "@/lib/ir/odoo-import";
import { executeKw } from "@/lib/crm-connectors/odoo/client";

export type ReconcileRow = { label: string; odoo: number; ir: number };
export type ReconcileResult = {
  project: { id: string; title: string; odooProjectIds: number[] };
  totals: { tasks: ReconcileRow; investors: ReconcileRow; activities: ReconcileRow };
  byMonth: Array<{ odooProject: string; month: number | null; tasks: ReconcileRow; entries: ReconcileRow }>;
  byWeek: Array<{ week: string; range: string; odoo: { emails: number; calls: number; meetings: number }; ir: { emails: number; calls: number; meetings: number } }>;
  drift: { tasksNotImported: Array<{ id: number; name: string; project: string }>; tagsUnmatched: string[]; irTasksNotInOdoo: number };
  readAt: string;
};

const isCall = (t: string) => t === "call" || t === "voicemail";

export async function reconcileProject(projectId: string): Promise<ReconcileResult> {
  const project = await getProject(projectId);
  if (!project) throw new Error("Project not found.");
  const ids = ((await db().from("ir_projects").select("odoo_project_ids").eq("id", projectId).single()).data as { odoo_project_ids: number[] | null } | null)?.odoo_project_ids ?? [];
  if (!ids.length) throw new Error("This project was not imported from Odoo (no Odoo project ids on record).");
  const d = await discover();
  if (!d.configured) throw new Error("Odoo isn't configured on this environment.");
  type IrTaskLite = { id: string; odoo_task_id: number | null; milestone_id: string };
  type IrMatchLite = { id: string; odoo_tag: string | null };
  const [tasks, milestones, tRes, mRes, aRes] = await Promise.all([
    odooTasks(ids, d, d.agentField), listMilestones(projectId),
    db().from("ir_tasks").select("id, odoo_task_id, milestone_id").eq("project_id", projectId),
    db().from("ir_matches").select("id, odoo_tag").eq("project_id", projectId),
    db().from("ir_activities").select("id, project_id, match_id, task_id, type, subject, created_at, done_at").eq("project_id", projectId).not("done_at", "is", null).limit(20000),
  ]);
  const irTasks = (tRes.data ?? []) as IrTaskLite[];
  const irMatches = (mRes.data ?? []) as IrMatchLite[];
  const irActs = (aRes.data ?? []) as Act[];
  const irByOdoo = new Map(irTasks.filter((t) => t.odoo_task_id != null).map((t) => [t.odoo_task_id as number, t]));
  const entriesByTask = new Map(tasks.map((t) => [t.id, taskEntries(t)]));
  const outreach = irActs.filter(isOutreach);

  // Totals
  const odooTags = [...new Set(tasks.flatMap((t) => t.tags.map((g) => g.name)))];
  const matchedTags = new Set(irMatches.map((m) => m.odoo_tag).filter((x): x is string => Boolean(x)));
  const totals = {
    tasks: { label: "Tasks", odoo: tasks.length, ir: irTasks.length },
    investors: { label: "Investors", odoo: odooTags.length, ir: irMatches.length },
    activities: { label: "Activities", odoo: [...entriesByTask.values()].reduce((n, e) => n + e.length, 0), ir: outreach.length },
  };

  // Per Odoo project (= month)
  const byMonth = ids.map((oid) => {
    const ts = tasks.filter((t) => t.projectId === oid);
    const first = ts[0];
    const irCount = ts.filter((t) => irByOdoo.has(t.id)).length;
    const irTaskIds = new Set(ts.map((t) => irByOdoo.get(t.id)?.id).filter(Boolean));
    return { odooProject: first?.projectName ?? `Odoo project ${oid}`, month: first?.month ?? null, tasks: { label: "Tasks", odoo: ts.length, ir: irCount }, entries: { label: "Entries", odoo: ts.reduce((n, t) => n + (entriesByTask.get(t.id)?.length ?? 0), 0), ir: outreach.filter((a) => a.task_id && irTaskIds.has(a.task_id)).length } };
  });

  // Per project week: dated Agent Field entries vs IR Hub activities done in the week
  const weeks = milestones.filter((m) => m.kind === "week");
  const allEntries = [...entriesByTask.values()].flat();
  const byWeek = weeks.map((w) => {
    const inW = (day: string | null) => Boolean(day) && (day as string) >= w.starts_on && (day as string) < w.ends_on;
    const o = allEntries.filter((e) => inW(e.date)); const i = outreach.filter((a) => inW(a.done_at ? a.done_at.slice(0, 10) : null));
    return { week: w.label, range: `${w.starts_on} to ${w.ends_on}`, odoo: { emails: o.filter((e) => e.type === "email").length, calls: o.filter((e) => isCall(e.type)).length, meetings: o.filter((e) => e.type === "meeting").length }, ir: { emails: i.filter((a) => a.type === "email").length, calls: i.filter((a) => isCall(a.type)).length, meetings: i.filter((a) => a.type === "meeting").length } };
  }).filter((r) => r.odoo.emails + r.odoo.calls + r.odoo.meetings + r.ir.emails + r.ir.calls + r.ir.meetings > 0);

  return {
    project: { id: project.id, title: project.title, odooProjectIds: ids },
    totals, byMonth, byWeek,
    drift: { tasksNotImported: tasks.filter((t) => !irByOdoo.has(t.id)).map((t) => ({ id: t.id, name: t.name, project: t.projectName })), tagsUnmatched: odooTags.filter((t) => !matchedTags.has(t)), irTasksNotInOdoo: irTasks.filter((t) => t.odoo_task_id == null).length },
    readAt: new Date().toISOString(),
  };
}

/** Full read of Deals2Match for the pre-cutover backup: every project, every task (tags, assignee, dates, Agent Field), every tag. */
export async function odooSnapshot(): Promise<{ readAt: string; agentField: string | null; projects: unknown[]; tasks: OdooTaskLite[]; tags: unknown[]; messages: unknown[] }> {
  const d = await discover();
  if (!d.configured) throw new Error("Odoo isn't configured on this environment.");
  const { groups } = await odooProjects(d);
  const ids = groups.flatMap((g) => g.projects.map((p) => p.id));
  const tasks = await odooTasks(ids, d, d.agentField);
  const tags = await executeKw<unknown[]>("project.tags", "search_read", [[]], { fields: ["id", "name"], limit: 5000 });
  // Chatter on the tasks (mail.message) — the part of the Odoo record the import doesn't carry.
  const messages = tasks.length ? await executeKw<unknown[]>("mail.message", "search_read", [[["model", "=", "project.task"], ["res_id", "in", tasks.map((t) => t.id)]]], { fields: ["id", "res_id", "date", "author_id", "message_type", "subject", "body"], limit: 20000, order: "date asc" }).catch(() => []) : [];
  return { readAt: new Date().toISOString(), agentField: d.agentField, projects: groups.flatMap((g) => g.projects.map((p) => ({ ...p, founder: g.founder }))), tasks, tags, messages };
}
