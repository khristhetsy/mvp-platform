import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sequenceSender } from "@/lib/marketing/approve-permission";
import { deleteSchedule, getSchedule, saveSchedule, validateScheduleInput } from "@/lib/marketing/sequence-schedule-store";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  enabled: z.boolean().default(true),
  start_date: z.string(),
  end_date: z.string().nullable(),
  repeat: z.enum(["once", "daily", "weekdays", "weekly", "monthly"]),
  weekdays: z.array(z.number().int().min(0).max(6)).default([]),
  send_time: z.string(),
  max_per_run: z.number().int(),
  reminder_minutes: z.number().int().min(0),
  unreviewed_action: z.enum(["send", "hold"]),
});

// GET /api/marketing/sequences/[id]/schedule
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const who = await sequenceSender();
  if (!who) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  return NextResponse.json({ schedule: await getSchedule(id), canEdit: who.canApprove });
}

// PUT /api/marketing/sequences/[id]/schedule: save. Scheduling releases sends, so it
// takes the same permission as releasing a batch.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const who = await sequenceSender();
  if (!who) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  if (!who.canApprove) return NextResponse.json({ error: "You don't have permission to schedule sends. Ask an approver or a super admin." }, { status: 403 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const problem = validateScheduleInput(parsed.data);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const { id } = await params;
  try {
    await saveSchedule(id, parsed.data, who.profile.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

// DELETE /api/marketing/sequences/[id]/schedule: back to manual release.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const who = await sequenceSender();
  if (!who) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  if (!who.canApprove) return NextResponse.json({ error: "You don't have permission to change schedules." }, { status: 403 });
  const { id } = await params;
  try {
    await deleteSchedule(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
