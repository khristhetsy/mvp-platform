import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { gateBusinessPlanApi } from "@/lib/business-plan/gate";
import { getBusinessPlan } from "@/lib/business-plan/store";
import { renderBusinessPlanPdf } from "@/lib/business-plan/pdf";

export const dynamic = "force-dynamic";

/** Download the current plan as a PDF (does not save or finalize). */
export async function GET(): Promise<Response> {
  const g = await gateBusinessPlanApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const plan = await getBusinessPlan(g.supabase, g.company.id);
    if (!plan) return NextResponse.json({ error: "Nothing to export yet." }, { status: 400 });
    const buffer = await renderBusinessPlanPdf(plan, {
      name: g.company.company_name,
      industry: g.company.industry ?? null,
      stage: g.company.revenue_stage ?? null,
      fundingAmount: g.company.funding_amount ?? null,
    });
    const name = `${g.company.company_name} — Business plan.pdf`.replace(/[^a-zA-Z0-9._ -]/g, "");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to export PDF." }, { status: 500 });
  }
}
