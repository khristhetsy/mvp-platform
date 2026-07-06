import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { gateBusinessPlanApi } from "@/lib/business-plan/gate";
import { getBusinessPlan } from "@/lib/business-plan/store";
import { extractCharts, normalizeCharts, DEFAULT_CHARTS } from "@/lib/business-plan/charts";

export const dynamic = "force-dynamic";

// POST /api/founder/business-plan/charts — AI-extract allocation + market figures from the plan.
export async function POST(): Promise<Response> {
  const g = await gateBusinessPlanApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const plan = await getBusinessPlan(g.supabase, g.company.id);
    if (!plan) return NextResponse.json({ charts: DEFAULT_CHARTS });
    const charts = await extractCharts(plan);
    return NextResponse.json({ charts });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ charts: normalizeCharts({}) }, { status: 200 });
  }
}
