import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { updateMeetingTask } from "@/lib/meetings/tasks";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(["not_started", "in_progress", "done", "cancelled"]).optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  priority: z.enum(["urgent", "high", "med", "low"]).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  agent_note: z.string().max(4000).nullable().optional(),
  ceo_note: z.string().max(4000).nullable().optional(),
});

// PATCH — update a meeting task. ceo_note is admin-only; a non-admin ceo_note edit is ignored.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid task payload." }, { status: 400 });
  const allowCeoNote = profile.role === "admin";
  if (parsed.data.ceo_note !== undefined && !allowCeoNote) {
    return NextResponse.json({ error: "Only the CEO/Admin can edit the CEO note." }, { status: 403 });
  }
  try {
    await updateMeetingTask(id, parsed.data, allowCeoNote);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to update task." }, { status: 500 });
  }
}
