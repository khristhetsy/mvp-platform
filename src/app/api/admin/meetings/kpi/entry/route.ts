import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { upsertEntry } from "@/lib/meetings/kpi";

export const dynamic = "force-dynamic";

const schema = z.object({
  kpi_id: z.string().uuid(),
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number().finite(),
});

// POST — upsert a department-level KPI value for a week (the Data Input cell).
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "kpi_id, week_start and value are required." }, { status: 400 });
  try {
    await upsertEntry(parsed.data.kpi_id, parsed.data.week_start, parsed.data.value, profile.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to save." }, { status: 500 });
  }
}
