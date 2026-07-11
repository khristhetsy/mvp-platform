import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { updateObjective } from "@/lib/meetings/plan";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  period_label: z.string().max(40).nullable().optional(),
  target_date: z.string().nullable().optional(),
  status: z.enum(["on_track", "at_risk", "off_track", "done"]).optional(),
  position: z.number().int().optional(),
  archived: z.boolean().optional(),
});

// PATCH — update an objective (status, fields, or archive).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ objectiveId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { objectiveId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  try {
    await updateObjective(objectiveId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to update objective." }, { status: 500 });
  }
}
