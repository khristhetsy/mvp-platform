/**
 * Weekly batch tasks.
 *   POST { projectId, milestoneId, title?, assigneeId? } → { id }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { createTask, getProject, listMilestones } from "@/lib/ir/db";

export const dynamic = "force-dynamic";

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
