import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { loadRollup, type GoalPeriod } from "@/lib/meetings/kpi";

export const dynamic = "force-dynamic";

const PERIODS = new Set<GoalPeriod>(["weekly", "monthly", "quarterly", "yearly"]);

// GET ?period=&dept= — roll-up (actual / goal / pct / owed) for the comparison graphs.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const period = (req.nextUrl.searchParams.get("period") ?? "weekly") as GoalPeriod;
  const dept = req.nextUrl.searchParams.get("dept") ?? undefined;
  if (!PERIODS.has(period)) return NextResponse.json({ error: "Invalid period." }, { status: 400 });
  return NextResponse.json({ rows: await loadRollup(period, dept) });
}
