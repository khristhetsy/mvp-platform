import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { addSequenceStep, updateSequenceStep, deleteSequenceStep } from "@/lib/marketing/sequences";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const body = await req.json();
    const step = await addSequenceStep(body);
    return NextResponse.json(step, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH — edit an existing step (template, condition, delay).
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const body = await req.json();
    const { step_id, ...rest } = body ?? {};
    if (!step_id) return NextResponse.json({ error: "step_id is required." }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (rest.template_id !== undefined) patch.template_id = rest.template_id;
    if (rest.condition !== undefined) patch.condition = rest.condition;
    if (rest.delay_days !== undefined) patch.delay_days = Number(rest.delay_days);
    if (rest.from_name !== undefined) patch.from_name = rest.from_name;
    if (rest.from_email !== undefined) patch.from_email = rest.from_email;
    const step = await updateSequenceStep(step_id, patch);
    return NextResponse.json(step);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE ?step_id=… — remove a step.
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const stepId = req.nextUrl.searchParams.get("step_id");
    if (!stepId) return NextResponse.json({ error: "step_id is required." }, { status: 400 });
    await deleteSequenceStep(stepId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
