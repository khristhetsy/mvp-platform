import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createMilestone } from "@/lib/meetings/plan";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().min(2).max(200),
  owner_id: z.string().uuid().nullable().optional(),
  due_date: z.string().nullable().optional(),
});

// POST — add a milestone to an objective.
export async function POST(req: NextRequest, { params }: { params: Promise<{ objectiveId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { objectiveId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid milestone." }, { status: 400 });
  try {
    await createMilestone(objectiveId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to add milestone." }, { status: 500 });
  }
}
