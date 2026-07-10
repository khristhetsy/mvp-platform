import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getSalesAnalyticsInsight } from "@/lib/sales-analytics/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

// GET (cached-or-generate) / POST (force refresh) — AI Sales analyst insight per metric.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ metric: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { metric } = await params;
  try {
    return NextResponse.json({ insight: await getSalesAnalyticsInsight(metric, { createdBy: profile.id }) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load insight." }, { status: 500 });
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ metric: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { metric } = await params;
  try {
    return NextResponse.json({ insight: await getSalesAnalyticsInsight(metric, { force: true, createdBy: profile.id }) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to regenerate." }, { status: 500 });
  }
}
