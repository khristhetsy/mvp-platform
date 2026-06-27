import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { gateFinancialModelApi } from "@/lib/financial-model/gate";
import { resolveAssumptions } from "@/lib/financial-model/resolve";
import { getBusinessPlan } from "@/lib/business-plan/store";
import { ASSUMPTION_DEFS } from "@/lib/business-plan/assumptions";
import { computeProjections } from "@/lib/business-plan/projections";
import { computeMonthlyModel } from "@/lib/financial-model/monthly";

export const dynamic = "force-dynamic";

/**
 * Initial state for the financial model. If the founder already built drivers in
 * the AI Business Plan, reuse them (source "business-plan"); otherwise start from
 * stage-appropriate defaults the founder can edit ("fresh").
 */
export async function GET(): Promise<Response> {
  const g = await gateFinancialModelApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const stage = g.company.revenue_stage ?? null;
    const raise = g.company.funding_amount ?? null;

    const plan = await getBusinessPlan(g.supabase, g.company.id);
    const planHasDrivers = Boolean(plan && plan.assumptions && Object.keys(plan.assumptions).length > 0);
    const source: "business-plan" | "fresh" = planHasDrivers ? "business-plan" : "fresh";

    const assumptions = resolveAssumptions(planHasDrivers ? plan!.assumptions : null, stage, raise);
    const projections = computeProjections(assumptions);
    const monthly = computeMonthlyModel(assumptions);

    return NextResponse.json({
      source,
      hasBusinessPlan: Boolean(plan),
      companyName: g.company.company_name,
      defs: ASSUMPTION_DEFS,
      assumptions,
      projections,
      monthly,
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load the financial model." }, { status: 500 });
  }
}
