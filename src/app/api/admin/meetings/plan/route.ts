import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listObjectives, createObjective } from "@/lib/meetings/plan";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  department_id: z.string().uuid().nullable().optional(),
  title: z.string().min(2).max(200),
  description: z.string().max(2000).nullable().optional(),
  period_label: z.string().max(40).nullable().optional(),
  target_date: z.string().nullable().optional(),
  status: z.enum(["on_track", "at_risk", "off_track", "done"]).optional(),
});

// GET ?dept= — plan objectives (with milestones + progress).
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const dept = req.nextUrl.searchParams.get("dept") ?? undefined;
  return NextResponse.json({ objectives: await listObjectives(dept) });
}

// POST — create a new objective.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid objective." }, { status: 400 });
  try {
    const id = await createObjective(parsed.data, profile.id);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create objective." }, { status: 500 });
  }
}
