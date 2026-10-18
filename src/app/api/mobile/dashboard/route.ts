// GET /api/mobile/dashboard  (Authorization: Bearer <supabase access token>)
// The top of the founder dashboard for the phone: company name, next step, the four stage journey and the
// "raise at a glance" tiles. Same calls and the same wording as /founder (src/app/founder/page.tsx). Read only.
import { NextResponse } from "next/server";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { listCompanyDocuments } from "@/lib/data/documents";
import { computeReadinessScore, getLatestDiligenceReport } from "@/lib/data/founder-readiness";
import { evaluateFounderJourney } from "@/lib/founder-journey/evaluate";
import { crrFor } from "@/lib/crr/crr-for";
import { investableCrrFrom } from "@/lib/crr/investable-score";
import type { CrrSummary } from "@/lib/crr/blocker";
import { getJourneyOverview } from "@/lib/founder/stage-gate-status";
import { loadFounderCompanyMatchContext } from "@/lib/matching/load-matching-data";
import { listFounderInvestorActivity } from "@/lib/data/investor-interests";
import { formatPledgeTotal, getCompanyPledgeSummary, getFounderPledgeCompanyId } from "@/lib/data/investor-pledges";
import { loadListingChecklist } from "@/lib/listing/listing-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { withBearerFounder } from "../_bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const result = await withBearerFounder(req, async ({ profile }) => {
    const { company } = await getActiveCompanyForUser(profile);
    if (!company) return { hasCompany: false as const };

    const supabase = await createServerSupabaseClient();
    const serviceSupabase = createServiceRoleClient();
    const { data: documents } = await listCompanyDocuments(supabase, company.id);
    const { data: diligenceReport } = await getLatestDiligenceReport(supabase, company.id);
    const investorActivity = await listFounderInvestorActivity(supabase, company.id);
    const investorFit = await loadFounderCompanyMatchContext(company).catch(() => null);

    const pledgeCompanyId = await getFounderPledgeCompanyId(serviceSupabase, profile.id, company.id);
    const pledge = await getCompanyPledgeSummary(serviceSupabase, pledgeCompanyId);

    const uploadedTypeCodes = (documents ?? []).flatMap((d) => (d.document_type ? [d.document_type] : []));
    const readinessScore = diligenceReport?.readiness_score ?? computeReadinessScore(uploadedTypeCodes);
    const readinessDetail = diligenceReport ? "Latest stored diligence report" : "Estimate from required document checklist";

    const journeyState = await evaluateFounderJourney(supabase, profile.id);
    const engineCrr = await crrFor(company.id);
    const crrSummary: CrrSummary = {
      score: engineCrr.score,
      gate: engineCrr.gate,
      pointsToGate: engineCrr.pointsToGate,
      outreachUnlocked: engineCrr.outreachUnlocked,
      dimensions: engineCrr.dimensions.map((d) => ({ label: d.label, score: d.score, weight: d.weight, headroom: d.headroom })),
    };
    const crr = investableCrrFrom(engineCrr, journeyState, company);
    const overview = await getJourneyOverview(supabase, profile.id, { outreachReady: crr.outreachReady, crr: crrSummary }).catch(() => null);

    const activityTotal =
      (investorActivity?.interests.length ?? 0) + (investorActivity?.introRequests.length ?? 0) + (investorActivity?.savedDeals.length ?? 0);
    const matched = investorFit?.approvedInvestorCount ?? investorFit?.strongMatchCount ?? 0;

    const tiles = [
      {
        label: "Capital Readiness",
        value: crrSummary.score === null ? "—" : String(crrSummary.score),
        sub: crrSummary.score === null ? "Not scored yet" : crrSummary.outreachUnlocked ? "Outreach open" : `${crrSummary.pointsToGate} to gate ${crrSummary.gate}`,
        good: crrSummary.outreachUnlocked,
        href: "/founder/readiness",
      },
      { label: "Documents", value: `${readinessScore}%`, sub: readinessDetail, good: readinessScore >= 75, href: "/founder/readiness" },
      { label: "Matched investors", value: String(matched), sub: "View pipeline", href: "/founder/matches" },
      {
        label: "Pledged",
        value: formatPledgeTotal(pledge.totalPledged, pledge.currency),
        sub: company.funding_amount ? `of ${formatPledgeTotal(Number(company.funding_amount))}` : undefined,
        href: "/founder/deal-room",
      },
      { label: "Investor activity", value: String(activityTotal), sub: "Signals and intros", href: "/founder/matches" },
    ];

    const listing = await loadListingChecklist(company.id).catch(() => null);

    return {
      hasCompany: true as const,
      companyName: company.company_name ?? "Your company",
      stages: (overview?.stages ?? []).map((s) => ({ slug: s.slug, stageNumber: s.stageNumber, name: s.name, relation: s.relation })),
      nextAction: overview?.nextAction ?? null,
      tiles,
      listedAt: listing?.listingCompletedAt ?? null,
    };
  });
  if (!result.ok) return NextResponse.json({ error: "unauthorized" }, { status: result.status });
  return NextResponse.json(result.value, { headers: { "Cache-Control": "no-store" } });
}
