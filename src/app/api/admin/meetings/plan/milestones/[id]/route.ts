import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { updateMilestone } from "@/lib/meetings/plan";

export const dynamic = "force-dynamic";

const schema = z.object({
  done: z.boolean().optional(),
  title: z.string().min(2).max(200).optional(),
  owner_id: z.string().uuid().nullable().optional(),
  due_date: z.string().nullable().optional(),
});

// PATCH — toggle done / edit a milestone.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  try {
    await updateMilestone(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to update milestone." }, { status: 500 });
  }
}
