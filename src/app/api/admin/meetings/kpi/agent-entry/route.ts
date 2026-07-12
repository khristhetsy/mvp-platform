import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { upsertAgentEntry } from "@/lib/meetings/kpi";

export const dynamic = "force-dynamic";

const schema = z.object({
  kpi_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  goal: z.number().finite().nullable().optional(),
  actual: z.number().finite().nullable().optional(),
}).refine((v) => v.goal !== undefined || v.actual !== undefined, { message: "Provide a goal or actual." });

// POST — upsert a single agent's weekly goal and/or actual (one Data Input cell).
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "kpi_id, agent_id, week_start and a goal or actual are required." }, { status: 400 });
  try {
    const { kpi_id, agent_id, week_start, goal, actual } = parsed.data;
    await upsertAgentEntry(kpi_id, agent_id, week_start, { goal, actual }, profile.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to save." }, { status: 500 });
  }
}
