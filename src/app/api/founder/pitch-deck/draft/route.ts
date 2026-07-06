import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { gateBusinessPlanApi } from "@/lib/business-plan/gate";
import { getBusinessPlan } from "@/lib/business-plan/store";
import { generateSlideDraft } from "@/lib/pitch-deck/generate";

export const dynamic = "force-dynamic";

const schema = z.object({ slideId: z.string().min(1).max(40) });

// POST /api/founder/pitch-deck/draft — AI-draft a single slide from the plan.
export async function POST(request: Request): Promise<Response> {
  const g = await gateBusinessPlanApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A slide is required." }, { status: 400 });
  try {
    const plan = await getBusinessPlan(g.supabase, g.company.id);
    const company = { name: g.company.company_name, industry: g.company.industry ?? null, stage: g.company.revenue_stage ?? null, fundingAmount: g.company.funding_amount ?? null, description: g.company.business_description ?? null };
    const draft = await generateSlideDraft(parsed.data.slideId, company, plan);
    return NextResponse.json({ draft });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to draft slide." }, { status: 500 });
  }
}
