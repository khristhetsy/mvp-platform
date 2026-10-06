import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { getFinderStats } from "@/lib/verify/lookups";

export const dynamic = "force-dynamic";

// GET /api/prospects/finder-stats?days=30 — find rate per source from contact_lookups.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days")) || 30, 1), 365);
  try {
    return NextResponse.json(await getFinderStats(serviceRoleClientUntyped(), days));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not load stats." }, { status: 500 });
  }
}
