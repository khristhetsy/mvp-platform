import { NextRequest, NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/supabase/auth";
import { updateTask, deleteTask } from "@/lib/tasks/db";
import type { UpdateTaskInput } from "@/lib/tasks/types";

/** PATCH /api/tasks/[id] — update status, priority, title, assigned_to, etc. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const profile = await requireUserProfile();
    const { id } = await params;
    const body: UpdateTaskInput = await req.json();

    // Non-admins cannot re-assign tasks to other users
    if (body.assigned_to !== undefined && body.assigned_to !== profile.id && body.assigned_to !== null) {
      if (profile.role !== "admin" && profile.role !== "analyst") {
        return NextResponse.json({ error: "Only admins can assign tasks to others" }, { status: 403 });
      }
    }

    const task = await updateTask(id, body);
    return NextResponse.json(task);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** DELETE /api/tasks/[id] */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    await requireUserProfile();
    const { id } = await params;
    await deleteTask(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
