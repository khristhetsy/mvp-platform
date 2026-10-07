import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getSchedules } from "@/lib/marketing/sequence-schedule-store";
import { describeSchedule, nextRuns } from "@/lib/marketing/sequence-schedule";

export const dynamic = "force-dynamic";

// GET /api/marketing/sequence-schedules: every sequence schedule, with its label and next run.
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  try {
    const now = new Date();
    const rows = await getSchedules();
    return NextResponse.json(rows.map((s) => ({ ...s, label: describeSchedule(s), next_run: s.enabled ? nextRuns(s, now, 1)[0]?.toISOString() ?? null : null })));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
