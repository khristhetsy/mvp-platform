import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { updateTask } from "@/lib/operations/tasks";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  status: z.enum(["open", "in_progress", "done"]).optional(),
  archived: z.boolean().optional(),
});

// PATCH /api/operations/tasks/[id] — edit / reassign / complete / archive.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  try {
    await updateTask(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed." }, { status: 500 });
  }
}
