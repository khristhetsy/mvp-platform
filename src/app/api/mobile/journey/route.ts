// GET /api/mobile/journey  (Authorization: Bearer ...)
// The data behind My Progress (/founder/journey): current stage, the Qualify
// requirements, and the scores. Mirrors that page's own calls. Read only.
import { NextResponse } from "next/server";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { evaluateFounderJourney } from "@/lib/founder-journey/evaluate";
import { crrFor } from "@/lib/crr/crr-for";
import { OUTREACH_THRESHOLD, investableCrrFrom } from "@/lib/crr/investable-score";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { withBearerFounder } from "../_bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const result = await withBearerFounder(req, async ({ profile }) => {
    const { company } = await getActiveCompanyForUser(profile);
    if (!company) return { hasCompany: false as const };
    const supabase = await createServerSupabaseClient();
    const state = await evaluateFounderJourney(supabase, profile.id);
    const engineCrr = await crrFor(company.id);
    const { crr, readiness, profilePercent, outreachReady } = investableCrrFrom(engineCrr, state, company);
    const c = state.conditions;
    return {
      hasCompany: true as const,
      stageIndex: state.stageIndex,
      approvalStatus: state.approvalStatus ?? null,
      approvalFeedback: state.approvalFeedback ?? null,
      qualifyRequirements: [
        { label: "Onboarding complete", met: c.onboardingComplete },
        { label: "Required documents uploaded (financials, cap table, pitch deck)", met: c.requiredDocsUploaded },
        { label: "Preparation complete ≥ 75%", met: c.readinessQualified },
      ],
      readiness,
      crr,
      profilePercent,
      outreachReady,
      outreachThreshold: OUTREACH_THRESHOLD,
      outreachGap: engineCrr.pointsToGate,
    };
  });
  if (!result.ok) return NextResponse.json({ error: "unauthorized" }, { status: result.status });
  return NextResponse.json(result.value, { headers: { "Cache-Control": "no-store" } });
}
