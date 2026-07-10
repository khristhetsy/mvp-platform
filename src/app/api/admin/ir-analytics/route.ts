import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { loadIrAnalytics } from "@/lib/ir-analytics/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/admin/ir-analytics — all IR metric cards.
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return NextResponse.json({ metrics: await loadIrAnalytics() });
}
