import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import {
  getPlanItem,
  updatePlanItem,
  deletePlanItem,
  type UpdatePlanItemInput,
} from "@/lib/marketing/plans";
import { createTask } from "@/lib/tasks/db";

// PATCH /api/marketing/plans/items/[itemId] — update an initiative
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { itemId } = await params;
    const body = await req.json();
    const allowed: (keyof UpdatePlanItemInput)[] = [
      "title",
      "description",
      "channel",
      "status",
      "priority",
      "start_date",
      "due_date",
      "sort_order",
    ];
    const update: UpdatePlanItemInput = {};
    for (const key of allowed) {
      if (key in body) (update as Record<string, unknown>)[key] = body[key];
    }
    const item = await updatePlanItem(itemId, update);
    return NextResponse.json(item);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE /api/marketing/plans/items/[itemId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { itemId } = await params;
    await deletePlanItem(itemId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/marketing/plans/items/[itemId] — { action: "sync_task" }
// Creates a row in public.tasks linked back to the plan and stores its id
// on the initiative. Idempotent: if already synced, returns existing task_id.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
): Promise<NextResponse> {
  try {
    const profile = await requireRole(["admin"]);
    const { itemId } = await params;
    const body = await req.json().catch(() => ({}));

    if (body.action !== "sync_task") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const item = await getPlanItem(itemId);
    if (!item) {
      return NextResponse.json({ error: "Initiative not found" }, { status: 404 });
    }
    if (item.task_id) {
      return NextResponse.json({ ok: true, task_id: item.task_id, already: true });
    }

    const task = await createTask(profile.id, {
      title: item.title,
      description: item.description ?? undefined,
      priority: item.priority,
      due_date: item.due_date ?? undefined,
      context_type: "marketing_plan",
      context_id: item.plan_id,
      task_category: "marketing",
    });

    const updated = await updatePlanItem(itemId, { task_id: task.id });
    return NextResponse.json({ ok: true, task_id: task.id, item: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
