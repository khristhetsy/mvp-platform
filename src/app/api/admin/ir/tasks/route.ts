/**
 * Weekly batch tasks.
 *   GET  → every task on the active projects, for the Tasks hub boards:
 *          { projects: [{ id, title, founder_name }], months: [{ id, project_id, label, sort_order, starts_on, ends_on }],
 *            weeks: [{ id, project_id, parent_id, label, sort_order, starts_on, ends_on }],
 *            tasks: [{ id, project_id, milestone_id, title, status, starred, deadline, created_at, assignee_id, assignee_name, week, investors, investor_names }] }
 *          investor_names is sorted by name, so the Odoo-style kanban can show its tags and search them.
 *   POST { projectId, milestoneId, title?, assigneeId? } → { id }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { createTask, db, getProject, investorMap, listMilestones, listProjects, nameMap } from "@/lib/ir/db";

export const dynamic = "force-dynamic";

/** Every match that sits on a task, paged past PostgREST's 1,000-row response cap. */
async function allMatches(projectIds: string[]): Promise<Array<{ task_id: string; investor_contact_id: string }>> {
  const out: Array<{ task_id: string; investor_contact_id: string }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from("ir_matches").select("id, task_id, investor_contact_id").in("project_id", projectIds).not("task_id", "is", null).order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ task_id: string; investor_contact_id: string }>;
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

export async function GET(): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  try {
    const projects = await listProjects({ status: "active" });
    const ids = projects.map((p) => p.id);
    if (!ids.length) return NextResponse.json({ projects: [], months: [], weeks: [], tasks: [] });
    const [{ data: tasks, error }, { data: ms }, matches] = await Promise.all([
      db().from("ir_tasks").select("id, project_id, milestone_id, title, status, starred, deadline, created_at, assignee_id").in("project_id", ids).order("created_at"),
      db().from("ir_milestones").select("id, project_id, parent_id, kind, label, sort_order, starts_on, ends_on").in("project_id", ids).order("sort_order"),
      allMatches(ids),
    ]);
    if (error) throw new Error(error.message);
    type T = { id: string; project_id: string; milestone_id: string; title: string; status: string; starred: boolean; deadline: string | null; created_at: string; assignee_id: string | null };
    const rows = (tasks ?? []) as T[];
    type M = { id: string; project_id: string; parent_id: string | null; kind: "month" | "week"; label: string; sort_order: number; starts_on: string; ends_on: string };
    const milestones = (ms ?? []) as M[];
    const week = new Map(milestones.filter((m) => m.kind === "week").map((w) => [w.id, w]));
    const count = new Map<string, number>();
    const mrows = matches;
    for (const m of mrows) count.set(m.task_id, (count.get(m.task_id) ?? 0) + 1);
    const [names, inv] = await Promise.all([nameMap(rows.map((r) => r.assignee_id)), investorMap(mrows.map((m) => m.investor_contact_id))]);
    const invNames = new Map<string, string[]>();
    for (const m of mrows) {
      const i = inv.get(m.investor_contact_id);
      const label = i?.name && i?.firm && i.firm !== i.name ? `${i.firm}, ${i.name}` : i?.name ?? i?.firm ?? "Investor";
      const list = invNames.get(m.task_id) ?? []; list.push(label); invNames.set(m.task_id, list);
    }
    for (const l of invNames.values()) l.sort((a, b) => a.localeCompare(b));
    return NextResponse.json({
      projects: projects.map((p) => ({ id: p.id, title: p.title, founder_name: p.founder_name })),
      months: milestones.filter((m) => m.kind === "month").map((m) => ({ id: m.id, project_id: m.project_id, label: m.label, sort_order: m.sort_order, starts_on: m.starts_on, ends_on: m.ends_on })),
      weeks: milestones.filter((m) => m.kind === "week").map((m) => ({ id: m.id, project_id: m.project_id, parent_id: m.parent_id, label: m.label, sort_order: m.sort_order, starts_on: m.starts_on, ends_on: m.ends_on })),
      tasks: rows.map((r) => {
        const w = week.get(r.milestone_id);
        return { id: r.id, project_id: r.project_id, milestone_id: r.milestone_id, title: r.title, status: r.status, starred: r.starred, deadline: r.deadline, created_at: r.created_at, assignee_id: r.assignee_id, assignee_name: r.assignee_id ? names.get(r.assignee_id) ?? null : null, week: w ? { label: w.label, starts_on: w.starts_on, ends_on: w.ends_on } : null, investors: count.get(r.id) ?? 0, investor_names: invNames.get(r.id) ?? [] };
      }),
    });
  } catch (e) { return failed(e, "Couldn't load tasks."); }
}

const schema = z.object({ projectId: z.string().uuid(), milestoneId: z.string().uuid(), title: z.string().max(160).nullish(), assigneeId: z.string().uuid().nullish() });

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await irStaff();
  if (!profile) return forbidden();
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid task." }, { status: 400 });
  const d = parsed.data;
  try {
    const project = await getProject(d.projectId);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const week = (await listMilestones(d.projectId)).find((m) => m.id === d.milestoneId && m.kind === "week");
    if (!week) return NextResponse.json({ error: "Pick a week milestone on this project." }, { status: 400 });
    const title = d.title?.trim() || `${project.founder_name ?? project.title} ${week.label}`;
    const { id } = await createTask({ projectId: d.projectId, milestoneId: week.id, title, assigneeId: d.assigneeId ?? project.owner_id, deadline: week.ends_on });
    return NextResponse.json({ id });
  } catch (e) { return failed(e, "Couldn't create the task."); }
}
