/**
 *   PATCH { title?, status?, assigneeId?, starred?, notes?, deadline?, milestoneId? } → { ok }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { getProject, getTask, listActivities, listMatches, listMilestones, listNotes, listStaff, listTasks, updateTask } from "@/lib/ir/db";

export const dynamic = "force-dynamic";

/** GET → { task, project, weeks, matches (on this task, with next open activity), activities (task-level + those matches), notes, staff, siblings } */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  try {
    const task = await getTask(id);
    if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });
    const [project, milestones, allMatches, taskActs, notes, staff, siblings] = await Promise.all([
      getProject(task.project_id), listMilestones(task.project_id), listMatches(task.project_id), listActivities({ taskId: id }), listNotes({ projectId: task.project_id }), listStaff(), listTasks(task.project_id),
    ]);
    const matches = allMatches.filter((m) => m.task_id === id);
    const matchIds = new Set(matches.map((m) => m.id));
    const projectActs = matches.length ? await listActivities({ projectId: task.project_id }) : [];
    const activities = [...taskActs, ...projectActs.filter((a) => a.match_id && matchIds.has(a.match_id) && !taskActs.some((t) => t.id === a.id))];
    const weeks = milestones.filter((m) => m.kind === "week");
    return NextResponse.json({ task, project, weeks, months: milestones.filter((m) => m.kind === "month"), matches, activities, notes: notes.filter((n) => !n.match_id || matchIds.has(n.match_id)), staff, siblings: siblings.map((t) => ({ id: t.id, title: t.title, milestone_id: t.milestone_id })) });
  } catch (e) { return failed(e, "Couldn't load the task."); }
}

const schema = z.object({
  title: z.string().min(1).max(160).optional(), status: z.enum(["new", "in_progress", "done"]).optional(),
  assigneeId: z.string().uuid().nullable().optional(), starred: z.boolean().optional(), notes: z.string().max(4000).nullable().optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), milestoneId: z.string().uuid().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  const d = parsed.data;
  try {
    await updateTask(id, { title: d.title, status: d.status, assignee_id: d.assigneeId, starred: d.starred, notes: d.notes, deadline: d.deadline, milestone_id: d.milestoneId });
    return NextResponse.json({ ok: true });
  } catch (e) { return failed(e, "Couldn't update the task."); }
}
