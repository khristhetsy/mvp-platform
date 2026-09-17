/**
 * Confirm investors onto a project (from the matching queue or the pipeline's "Add matches").
 *   POST { projectId, taskId?, milestoneId?, investorContactIds[], assigneeId? } → { created[], skipped }
 * Never creates a match without a project (spec 5.7).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { createMatches, getProject, getTask } from "@/lib/ir/db";

export const dynamic = "force-dynamic";

const schema = z.object({
  projectId: z.string().uuid(),
  taskId: z.string().uuid().nullish(),
  milestoneId: z.string().uuid().nullish(),
  investorContactIds: z.array(z.string().uuid()).min(1).max(500),
  assigneeId: z.string().uuid().nullish(),
  /** From the matching queue: what the engine said about each investor at confirm time. */
  meta: z.record(z.string().uuid(), z.object({ fitTier: z.enum(["high", "medium", "low"]).nullish(), dataSource: z.string().nullish() })).optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await irStaff();
  if (!profile) return forbidden();
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Select at least one investor." }, { status: 400 });
  const d = parsed.data;
  try {
    const project = await getProject(d.projectId);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    let milestoneId = d.milestoneId ?? null;
    if (d.taskId) {
      const task = await getTask(d.taskId);
      if (!task || task.project_id !== d.projectId) return NextResponse.json({ error: "Task not found on this project." }, { status: 404 });
      milestoneId = milestoneId ?? task.milestone_id;
    }
    const fitTiers: Record<string, "high" | "medium" | "low" | null> = {}, dataSources: Record<string, string | null> = {};
    for (const [id, m] of Object.entries(d.meta ?? {})) { fitTiers[id] = m.fitTier ?? null; dataSources[id] = m.dataSource ?? null; }
    const r = await createMatches({ projectId: d.projectId, taskId: d.taskId ?? null, milestoneId, investorContactIds: d.investorContactIds, assigneeId: d.assigneeId ?? project.owner_id, createdBy: profile.id, fitTiers, dataSources });
    return NextResponse.json(r);
  } catch (e) { return failed(e, "Couldn't add the investors."); }
}
