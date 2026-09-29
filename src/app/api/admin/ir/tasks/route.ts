/**
 * Weekly batch tasks.
 *   GET  → every task on the active projects, for the Tasks hub "All founders" board:
 *          { projects: [{ id, title, founder_name }], tasks: [{ id, project_id, title, status, starred, deadline, created_at, assignee_name, week, investors }] }
 *   POST { projectId, milestoneId, title?, assigneeId? } → { id }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { createTask, db, getProject, listMilestones, listProjects, nameMap } from "@/lib/ir/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  try {
    const projects = await listProjects({ status: "active" });
    const ids = projects.map((p) => p.id);
    if (!ids.length) return NextResponse.json({ projects: [], tasks: [] });
    const [{ data: tasks, error }, { data: weeks }, { data: matches }] = await Promise.all([
      db().from("ir_tasks").select("id, project_id, milestone_id, title, status, starred, deadline, created_at, assignee_id").in("project_id", ids).order("created_at"),
      db().from("ir_milestones").select("id, label, starts_on, ends_on").in("project_id", ids).eq("kind", "week"),
      db().from("ir_matches").select("task_id").in("project_id", ids).not("task_id", "is", null),
    ]);
    if (error) throw new Error(error.message);
    type T = { id: string; project_id: string; milestone_id: string; title: string; status: string; starred: boolean; deadline: string | null; created_at: string; assignee_id: string | null };
    const rows = (tasks ?? []) as T[];
    const week = new Map(((weeks ?? []) as Array<{ id: string; label: string; starts_on: string; ends_on: string }>).map((w) => [w.id, w]));
    const count = new Map<string, number>();
    for (const m of (matches ?? []) as Array<{ task_id: string }>) count.set(m.task_id, (count.get(m.task_id) ?? 0) + 1);
    const names = await nameMap(rows.map((r) => r.assignee_id));
    return NextResponse.json({
      projects: projects.map((p) => ({ id: p.id, title: p.title, founder_name: p.founder_name })),
      tasks: rows.map((r) => {
        const w = week.get(r.milestone_id);
        return { id: r.id, project_id: r.project_id, title: r.title, status: r.status, starred: r.starred, deadline: r.deadline, created_at: r.created_at, assignee_name: r.assignee_id ? names.get(r.assignee_id) ?? null : null, week: w ? { label: w.label, starts_on: w.starts_on, ends_on: w.ends_on } : null, investors: count.get(r.id) ?? 0 };
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
