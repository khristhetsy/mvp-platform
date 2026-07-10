import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getSalesInsight, type MetricKey } from "@/lib/forecast/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const METRICS = new Set<MetricKey>(["mrr", "arr", "proj", "variance"]);

// GET /api/sales/forecast/insights/[metric]?scenario=<id> — cached-or-generate.
export async function GET(req: NextRequest, { params }: { params: Promise<{ metric: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { metric } = await params;
  const scenario = req.nextUrl.searchParams.get("scenario");
  if (!METRICS.has(metric as MetricKey)) return NextResponse.json({ error: "Unknown metric." }, { status: 400 });
  if (!scenario) return NextResponse.json({ error: "scenario is required." }, { status: 400 });
  try {
    const insight = await getSalesInsight(metric as MetricKey, scenario, { createdBy: profile.id });
    return NextResponse.json({ insight });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load insight." }, { status: 500 });
  }
}
