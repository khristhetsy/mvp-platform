import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { computeWeekSnapshots } from "@/lib/ceo/snapshot";

export const dynamic = "force-dynamic";

// POST /api/ceo/snapshots — manually recompute the weekly KPI snapshots (admin).
// Body: { week?: "YYYY-MM-DD" (Monday) }. The scheduled cron reuses computeWeekSnapshots.
export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireRole(["admin"]);
    const body = (await req.json().catch(() => ({}))) as { week?: string };
    const week = typeof body.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.week) ? body.week : undefined;
    const result = await computeWeekSnapshots(week);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Snapshot failed." }, { status: 500 });
  }
}
