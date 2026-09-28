/**
 * Activity burndown for one project.
 *   GET → { project: { id, title, start_date, end_date }, points: [{ weekEnd, open, ideal }], openNow, total }
 */
import { NextRequest, NextResponse } from "next/server";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { getProject, listActivities } from "@/lib/ir/db";
import { activityBurndown } from "@/lib/ir/burndown";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  try {
    const project = await getProject(id);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const acts = await listActivities({ projectId: id });
    return NextResponse.json({
      project: { id: project.id, title: project.title, start_date: project.start_date, end_date: project.end_date },
      points: activityBurndown(acts, project.start_date, project.end_date), openNow: acts.filter((a) => !a.done_at).length, total: acts.length,
    });
  } catch (e) { return failed(e, "Couldn't build the burndown."); }
}
