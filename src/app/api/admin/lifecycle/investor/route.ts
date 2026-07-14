import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { investorLifecycle, founderLifecycle } from "@/lib/lifecycle/counts";

export const dynamic = "force-dynamic";

// GET — investor pipeline (5-stage) + founder journey (4-stage) funnel counts for the
// IR Hub dashboard's Investor/Founder journey card. `stages` kept for back-compat.
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const [investor, founder] = await Promise.all([investorLifecycle(), founderLifecycle()]);
  return NextResponse.json({ stages: investor, investor, founder });
}
