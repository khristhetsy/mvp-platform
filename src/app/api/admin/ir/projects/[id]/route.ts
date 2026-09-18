/**
 * One IR project — the pipeline payload.
 *   GET   → { project, milestones, matches, tasks, openActivities, staff }
 *   PATCH { status?, ownerId?, founderReportVisible?, starred?, isSpv?, title?, weeklySummary?, monthlySummary? } → { ok }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { getProject, listActivities, listMatches, listMilestones, listStaff, listTasks, updateProject } from "@/lib/ir/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  try {
    const project = await getProject(id);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const [milestones, matches, tasks, openActivities, staff] = await Promise.all([
      listMilestones(id), listMatches(id), listTasks(id), listActivities({ projectId: id, openOnly: true }), listStaff(),
    ]);
    return NextResponse.json({ project, milestones, matches, tasks, openActivities, staff });
  } catch (e) { return failed(e, "Couldn't load the project."); }
}

const schema = z.object({
  status: z.enum(["active", "paused", "completed", "cancelled"]).optional(),
  ownerId: z.string().uuid().optional(),
  founderReportVisible: z.boolean().optional(),
  starred: z.boolean().optional(),
  isSpv: z.boolean().optional(),
  title: z.string().min(1).max(160).optional(),
  weeklySummary: z.boolean().optional(),
  monthlySummary: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  const d = parsed.data;
  try {
    await updateProject(id, { status: d.status, owner_id: d.ownerId, founder_report_visible: d.founderReportVisible, starred: d.starred, is_spv: d.isSpv, title: d.title, weekly_summary: d.weeklySummary, monthly_summary: d.monthlySummary });
    return NextResponse.json({ ok: true });
  } catch (e) { return failed(e, "Couldn't update the project."); }
}
