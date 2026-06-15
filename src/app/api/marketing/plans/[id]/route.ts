import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import {
  getPlan,
  updatePlan,
  deletePlan,
  type UpdatePlanInput,
} from "@/lib/marketing/plans";

// GET /api/marketing/plans/[id] — plan with its initiatives
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const plan = await getPlan(id);
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    return NextResponse.json(plan);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH /api/marketing/plans/[id] — update plan fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const body = await req.json();
    const allowed: (keyof UpdatePlanInput)[] = [
      "name",
      "objective",
      "summary",
      "target_audience",
      "budget",
      "status",
      "start_date",
      "end_date",
    ];
    const update: UpdatePlanInput = {};
    for (const key of allowed) {
      if (key in body) (update as Record<string, unknown>)[key] = body[key];
    }
    const plan = await updatePlan(id, update);
    return NextResponse.json(plan);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE /api/marketing/plans/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    await deletePlan(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
