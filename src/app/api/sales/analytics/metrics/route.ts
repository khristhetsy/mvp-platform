/** GET /api/sales/analytics/metrics?grain=&compare=&viewAs= → SalesMetric[] for the period. Staff-only. */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getSalesScope, effectiveSalesOwner } from "@/lib/sales/scope";
import { loadSalesAnalytics } from "@/lib/sales-analytics/metrics";
import { GRAINS, type Compare, type Grain } from "@/lib/sales/followup-period";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const p = req.nextUrl.searchParams;
  const grainRaw = p.get("grain") ?? "30d";
  const grain = (GRAINS as string[]).includes(grainRaw) ? (grainRaw as Grain) : "30d";
  const compare: Compare = p.get("compare") === "yoy" ? "yoy" : "prev";
  const scope = await getSalesScope(profile, p.get("viewAs"));
  return NextResponse.json({ metrics: await loadSalesAnalytics(effectiveSalesOwner(scope), { grain, compare }) });
}
