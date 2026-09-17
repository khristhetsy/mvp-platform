/**
 *   PATCH { title?, status?, assigneeId?, starred?, notes?, deadline?, milestoneId? } → { ok }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { updateTask } from "@/lib/ir/db";

export const dynamic = "force-dynamic";

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
