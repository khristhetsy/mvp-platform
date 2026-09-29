/**
 *   PATCH { done?, subject?, description?, outcome?, nextStep?, dueAt?, founderVisible?, assigneeId?, type? } → { ok }
 *   DELETE → { ok }
 * `done: true` stamps done_at (the to-do becomes a log entry); `done: false` reopens it.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { deleteActivity, updateActivity } from "@/lib/ir/db";
import { IR_ACTIVITY_TYPES } from "@/lib/ir/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  done: z.boolean().optional(),
  subject: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  outcome: z.string().max(1000).nullable().optional(),
  nextStep: z.string().max(1000).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  founderVisible: z.boolean().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  type: z.enum(IR_ACTIVITY_TYPES).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  const d = parsed.data;
  try {
    await updateActivity(id, {
      subject: d.subject, description: d.description, outcome: d.outcome, next_step: d.nextStep, due_at: d.dueAt,
      founder_visible: d.founderVisible, assignee_id: d.assigneeId, type: d.type,
      ...(d.done === undefined ? {} : { done_at: d.done ? new Date().toISOString() : null }),
    });
    return NextResponse.json({ ok: true });
  } catch (e) { return failed(e, "Couldn't update the activity."); }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  try { await deleteActivity(id); return NextResponse.json({ ok: true }); }
  catch (e) { return failed(e, "Couldn't delete the activity."); }
}
