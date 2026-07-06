import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { gateBusinessPlanApi } from "@/lib/business-plan/gate";
import { getBusinessPlan } from "@/lib/business-plan/store";
import { getPitchDeck } from "@/lib/pitch-deck/store";
import { prefillSlides } from "@/lib/pitch-deck/prefill";
import { renderDeckPptx } from "@/lib/pitch-deck/pptx";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const g = await gateBusinessPlanApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [deck, plan] = await Promise.all([getPitchDeck(g.supabase, g.company.id), getBusinessPlan(g.supabase, g.company.id)]);
    const company = { name: g.company.company_name, industry: g.company.industry ?? null, stage: g.company.revenue_stage ?? null, fundingAmount: g.company.funding_amount ?? null, description: g.company.business_description ?? null };
    const slides = prefillSlides(company, plan, deck?.slides ?? {});
    const buffer = await renderDeckPptx({ id: deck?.id ?? "", companyId: g.company.id, slides, theme: deck?.theme ?? "navy", status: deck?.status ?? "draft", shareToken: null, aiAssisted: false, generatedAt: null, finalizedAt: null, updatedAt: null }, { name: g.company.company_name });
    const name = `${g.company.company_name} — Pitch deck.pptx`.replace(/[^a-zA-Z0-9._ -]/g, "");
    return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to export PPTX." }, { status: 500 });
  }
}
