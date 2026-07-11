import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { setGoal, type GoalPeriod } from "@/lib/meetings/kpi";

export const dynamic = "force-dynamic";

const schema = z.object({
  kpi_id: z.string().uuid(),
  period: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
  mode: z.enum(["auto", "pinned"]).optional(),
  pinned_value: z.number().finite().nullable().optional(),
  growth_factor: z.number().positive().max(10).optional(),
  ratchet_only: z.boolean().optional(),
});

// POST — pin/override a KPI goal or set growth/ratchet. Admin only (growth/pin are CEO controls).
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Only the CEO/Admin can set goals." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid goal payload." }, { status: 400 });
  try {
    await setGoal(parsed.data.kpi_id, parsed.data.period as GoalPeriod, parsed.data, profile.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to set goal." }, { status: 500 });
  }
}
