/**
 *   GET → { tasks: [{ id, title, milestone_id }] } — the project's weekly tasks in week order,
 *   for the matching queue's Prev / Next pager. Lighter than GET /tasks/[id].
 */
import { NextRequest, NextResponse } from "next/server";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { getTask, listMilestones, listTasks } from "@/lib/ir/db";
import { orderWeeklyTasks } from "@/lib/ir/week-pager";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  try {
    const task = await getTask(id);
    if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });
    const [milestones, tasks] = await Promise.all([listMilestones(task.project_id), listTasks(task.project_id)]);
    const weeks = milestones.filter((m) => m.kind === "week");
    const ordered = orderWeeklyTasks(tasks.map((t) => ({ id: t.id, title: t.title, milestone_id: t.milestone_id })), weeks);
    return NextResponse.json({ tasks: ordered });
  } catch (e) { return failed(e, "Couldn't load the weekly tasks."); }
}
