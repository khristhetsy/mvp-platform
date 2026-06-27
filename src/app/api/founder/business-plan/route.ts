import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { gateBusinessPlanApi } from "@/lib/business-plan/gate";
import { getBusinessPlan, upsertBusinessPlan } from "@/lib/business-plan/store";
import { defaultAssumptions } from "@/lib/business-plan/assumptions";
import type { BusinessPlan } from "@/lib/business-plan/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const g = await gateBusinessPlanApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const plan = await getBusinessPlan(g.supabase, g.company.id);
    return NextResponse.json({
      plan,
      company: {
        id: g.company.id,
        name: g.company.company_name,
        industry: g.company.industry ?? null,
        stage: g.company.revenue_stage ?? null,
        fundingAmount: g.company.funding_amount ?? null,
        description: g.company.business_description ?? null,
      },
      defaultAssumptions: defaultAssumptions(g.company.revenue_stage ?? null, g.company.funding_amount ?? null),
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load business plan." }, { status: 500 });
  }
}

export async function PUT(request: Request): Promise<Response> {
  const g = await gateBusinessPlanApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json().catch(() => ({}))) as {
      sections?: BusinessPlan["sections"];
      assumptions?: BusinessPlan["assumptions"];
      projections?: BusinessPlan["projections"];
      execSummary?: string | null;
      status?: BusinessPlan["status"];
      aiAssisted?: boolean;
    };
    const plan = await upsertBusinessPlan(g.supabase, g.company.id, g.profile.id, {
      sections: body.sections,
      assumptions: body.assumptions,
      projections: body.projections,
      execSummary: body.execSummary,
      status: body.status,
      aiAssisted: body.aiAssisted,
    });
    return NextResponse.json({ plan });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to save business plan." }, { status: 500 });
  }
}
