import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { gateBusinessPlanApi } from "@/lib/business-plan/gate";
import { getBusinessPlan } from "@/lib/business-plan/store";
import { getPitchDeck, upsertPitchDeck } from "@/lib/pitch-deck/store";
import { prefillSlides } from "@/lib/pitch-deck/prefill";
import type { PitchDeck } from "@/lib/pitch-deck/types";

export const dynamic = "force-dynamic";

function companyCtx(company: { company_name: string; industry: string | null; revenue_stage: string | null; funding_amount: number | null; business_description: string | null }) {
  return { name: company.company_name, industry: company.industry ?? null, stage: company.revenue_stage ?? null, fundingAmount: company.funding_amount ?? null, description: company.business_description ?? null };
}

export async function GET(): Promise<Response> {
  const g = await gateBusinessPlanApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [deck, plan] = await Promise.all([getPitchDeck(g.supabase, g.company.id), getBusinessPlan(g.supabase, g.company.id)]);
    const company = companyCtx(g.company);
    const slides = prefillSlides(company, plan, deck?.slides ?? {});
    return NextResponse.json({ deck: deck ? { ...deck, slides } : { slides, theme: "navy", status: "draft", shareToken: null }, company });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load pitch deck." }, { status: 500 });
  }
}

export async function PUT(request: Request): Promise<Response> {
  const g = await gateBusinessPlanApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json().catch(() => ({}))) as { slides?: PitchDeck["slides"]; theme?: string; aiAssisted?: boolean };
    const deck = await upsertPitchDeck(g.supabase, g.company.id, g.profile.id, { slides: body.slides, theme: body.theme, aiAssisted: body.aiAssisted });
    return NextResponse.json({ deck });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to save pitch deck." }, { status: 500 });
  }
}
