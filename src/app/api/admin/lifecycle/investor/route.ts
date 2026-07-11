import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { investorLifecycle } from "@/lib/lifecycle/counts";

export const dynamic = "force-dynamic";

// GET — investor pipeline lifecycle funnel counts (5-stage) for the IR Hub dashboard.
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return NextResponse.json({ stages: await investorLifecycle() });
}
