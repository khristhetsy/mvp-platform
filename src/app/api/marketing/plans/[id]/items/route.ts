import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createPlanItem } from "@/lib/marketing/plans";

// POST /api/marketing/plans/[id]/items — add an initiative to a plan
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { id: plan_id } = await params;
    const body = await req.json();

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const item = await createPlanItem({
      plan_id,
      title: body.title,
      description: body.description,
      channel: body.channel,
      status: body.status,
      priority: body.priority,
      start_date: body.start_date,
      due_date: body.due_date,
      sort_order: body.sort_order,
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
