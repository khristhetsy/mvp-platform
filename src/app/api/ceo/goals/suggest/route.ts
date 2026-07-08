import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { suggestGoals } from "@/lib/ceo/goal-suggestions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/ceo/goals/suggest — AI-proposed goals from KPI trends (admin).
export async function POST(): Promise<Response> {
  try {
    await requireRole(["admin"]);
    return NextResponse.json(await suggestGoals());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Suggestion failed." }, { status: 500 });
  }
}
