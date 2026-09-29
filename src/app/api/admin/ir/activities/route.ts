/**
 * Activities — a to-do while open, a log entry once done.
 *   POST { projectId, matchId?, taskId?, type, subject, description?, outcome?, nextStep?, dueAt?, done?, founderVisible?, assigneeId? } → { id }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { createActivity } from "@/lib/ir/db";
import { IR_ACTIVITY_TYPES } from "@/lib/ir/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  projectId: z.string().uuid(),
  matchId: z.string().uuid().nullish(),
  taskId: z.string().uuid().nullish(),
  type: z.enum(IR_ACTIVITY_TYPES),
  subject: z.string().min(1).max(200),
  description: z.string().max(4000).nullish(),
  outcome: z.string().max(1000).nullish(),
  nextStep: z.string().max(1000).nullish(),
  dueAt: z.string().datetime().nullish(),
  done: z.boolean().default(false),
  doneAt: z.string().datetime().nullish(),
  founderVisible: z.boolean().default(true),
  assigneeId: z.string().uuid().nullish(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await irStaff();
  if (!profile) return forbidden();
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid activity." }, { status: 400 });
  const d = parsed.data;
  if (!d.matchId && !d.taskId) return NextResponse.json({ error: "An activity belongs to an investor record or a week task." }, { status: 400 });
  try {
    const { id } = await createActivity({
      projectId: d.projectId, matchId: d.matchId ?? null, taskId: d.taskId ?? null, type: d.type, subject: d.subject.trim(),
      description: d.description, outcome: d.outcome, nextStep: d.nextStep, dueAt: d.dueAt,
      doneAt: d.done ? d.doneAt ?? new Date().toISOString() : null, founderVisible: d.founderVisible, assigneeId: d.assigneeId, createdBy: profile.id,
    });
    return NextResponse.json({ id });
  } catch (e) { return failed(e, "Couldn't save the activity."); }
}
