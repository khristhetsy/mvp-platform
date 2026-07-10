import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listStageWeights, saveStageWeights } from "@/lib/forecast/store";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return NextResponse.json({ weights: await listStageWeights() });
}

const putSchema = z.object({
  weights: z.array(z.object({
    stage_id: z.string().uuid(),
    win_probability: z.number().min(0).max(1),
    expected_lag_days: z.number().int().min(0).max(720),
    is_active: z.boolean(),
  })).max(50),
});

export async function PUT(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  try {
    await saveStageWeights(parsed.data.weights, profile.id);
    return NextResponse.json({ weights: await listStageWeights() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to save weights." }, { status: 500 });
  }
}
