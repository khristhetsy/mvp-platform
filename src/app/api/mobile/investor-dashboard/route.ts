// GET /api/mobile/investor-dashboard  (Authorization: Bearer <supabase access token>)
// The top of the investor dashboard for the phone: the four stage journey, the current stage's checklist, the one
// next step, the counts behind the dashboard tiles and the next best actions. Same loaders and the same wording as
// /investor/dashboard (src/app/investor/dashboard/page.tsx). Read only: nothing is written or synced.
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { investorCompanyLabel, loadInvestorWorkspacePageData } from "@/lib/data/investor-workspace-page";
import { loadInvestorWorkspaceContext } from "@/lib/investor/load-investor-workspace";
import { loadInvestorGates, loadInvestorJourney } from "@/lib/investor-journey/load";
import { currentInvestorGate } from "@/lib/investor-journey/gate";
import { loadInvestorRecommendedMatches } from "@/lib/matching/load-investor-recommendations";
import { loadAndMergeNextBestActions } from "@/lib/next-best-actions/lifecycle";
import { withBearerInvestor } from "../_bearer-investor";

export const dynamic = "force-dynamic";

const STRONG_FIT = 80;

export async function GET(req: Request) {
  const result = await withBearerInvestor(req, async ({ profile }) => {
    const supabase = await createServerSupabaseClient();
    const { investorProfile } = await loadInvestorWorkspaceContext(profile);
    if (!investorProfile) return { hasProfile: false as const };

    const [{ workspace }, { matches }, actions] = await Promise.all([
      loadInvestorWorkspacePageData(profile.id, 1),
      loadInvestorRecommendedMatches(supabase, profile.id, 25),
      loadAndMergeNextBestActions({ profile, supabase, options: { role: "investor", limit: 3, sync: false } }).catch(() => null),
    ]);

    const hasEngaged = workspace.interests.length > 0 || workspace.introRequests.length > 0;
    const [journey, gates] = await Promise.all([
      loadInvestorJourney(investorProfile, { hasEngaged }),
      loadInvestorGates(investorProfile),
    ]);
    const gate = currentInvestorGate(gates);

    return {
      hasProfile: true as const,
      name: profile.full_name ?? profile.email ?? "Investor",
      approvalStatus: investorProfile.approval_status,
      kycStatus: investorProfile.kyc_status,
      stage: {
        current: journey.stageView.current.key,
        number: journey.stageView.current.number,
        label: journey.stageView.current.label,
        percent: journey.stageView.percent,
        stages: journey.stageView.stages.map((s) => ({ key: s.key, number: s.number, label: s.label, short: s.short, status: s.status })),
      },
      coach: { headline: journey.coach.headline, body: journey.coach.body, action: journey.coach.action },
      gate: {
        headline: gate.headline,
        items: gate.items,
        primaryCta: gate.primaryCta ?? null,
        review: gate.review ?? null,
      },
      counts: {
        // The matches are the best fits (up to 25), the same ranking the website dashboard uses.
        matches: matches.length,
        strongMatches: matches.filter((m) => m.matchScore >= STRONG_FIT).length,
        strongFit: STRONG_FIT,
        watchlist: workspace.savedDeals.length,
        interests: workspace.interests.length,
        intros: workspace.introRequests.length,
        introsAwaiting: workspace.introRequests.filter((r) => (r.status ?? "pending") === "pending").length,
      },
      watchlistNames: workspace.savedDeals.slice(0, 3).map(investorCompanyLabel),
      actions: (actions?.actions ?? []).slice(0, 3).map((a) => ({ id: a.id, title: a.title, description: a.description, href: a.href })),
    };
  });
  if (!result.ok) return NextResponse.json({ error: "unauthorized" }, { status: result.status });
  return NextResponse.json(result.value, { headers: { "Cache-Control": "no-store" } });
}
