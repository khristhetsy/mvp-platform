import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { gateBusinessPlanApi } from "@/lib/business-plan/gate";
import { getBusinessPlan } from "@/lib/business-plan/store";
import { generateExecSummary } from "@/lib/business-plan/generate";

export const dynamic = "force-dynamic";

/** Auto-write the executive summary from the rest of the plan. */
export async function POST(): Promise<Response> {
  const g = await gateBusinessPlanApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const plan = await getBusinessPlan(g.supabase, g.company.id).catch(() => null);
    const result = await generateExecSummary(
      {
        name: g.company.company_name,
        industry: g.company.industry ?? null,
        stage: g.company.revenue_stage ?? null,
        description: g.company.business_description ?? null,
        fundingAmount: g.company.funding_amount ?? null,
      },
      plan?.sections ?? {},
    );
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to write summary." }, { status: 500 });
  }
}
