import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { gateBusinessPlanApi } from "@/lib/business-plan/gate";
import { getBusinessPlan } from "@/lib/business-plan/store";
import { generateSectionDraft } from "@/lib/business-plan/generate";

export const dynamic = "force-dynamic";

const schema = z.object({ sectionId: z.string().min(1) });

/** AI draft for one section, grounded in the company's data. */
export async function POST(request: Request): Promise<Response> {
  const g = await gateBusinessPlanApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const plan = await getBusinessPlan(g.supabase, g.company.id).catch(() => null);
    const draft = await generateSectionDraft(
      parsed.data.sectionId,
      {
        name: g.company.company_name,
        industry: g.company.industry ?? null,
        stage: g.company.revenue_stage ?? null,
        description: g.company.business_description ?? null,
        fundingAmount: g.company.funding_amount ?? null,
      },
      plan?.sections ?? null,
    );
    return NextResponse.json(draft);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to draft section." }, { status: 500 });
  }
}
