import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { InvestorApprovalBanner } from "@/components/InvestorApprovalBanner";
import { investorCompanyLabel, loadInvestorWorkspacePageData } from "@/lib/data/investor-workspace-page";
import { loadInvestorRecommendedMatches } from "@/lib/matching/load-investor-recommendations";
import { loadInvestorWorkspaceContext } from "@/lib/investor/load-investor-workspace";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { loadAndMergeNextBestActions } from "@/lib/next-best-actions/lifecycle";
import { NextBestActionsPanel } from "@/components/next-best-actions/NextBestActionsPanel";
import { InvestorMetricCards } from "@/components/investor/InvestorMetricCards";
import { InvestorDashboardCondensedGrid } from "@/components/investor/InvestorDashboardCondensedGrid";

export const dynamic = "force-dynamic";

export default async function InvestorDashboardPage() {
  const { profile, supabase, investorId } = await requireInvestorWorkspaceSession();
  const { investorProfile } = await loadInvestorWorkspaceContext(profile);

  const [{ workspace, crmActivity }, { matches }, nextBestActions] = await Promise.all([
    loadInvestorWorkspacePageData(investorId),
    loadInvestorRecommendedMatches(supabase, investorId, 4),
    loadAndMergeNextBestActions({ profile, supabase, options: { role: "investor", limit: 5, sync: true } }),
  ]);
  const savedDeals = workspace.savedDeals;
  const interests = workspace.interests;
  const introRequests = workspace.introRequests;
  const topMatches = matches.slice(0, 4);

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <PageHeader
        eyebrow="Investor terminal"
        title="Dashboard"
        description="Opportunity pipeline, watchlist, expressed interest, and relationship activity."
      />

      <InvestorApprovalBanner investorProfile={investorProfile} />

      <InvestorMetricCards
        data={{
          matchCount: matches.length,
          watchlistCount: savedDeals.length,
          interestCount: interests.length,
          introRequestCount: introRequests.length,
          watchlistNames: savedDeals.slice(0, 4).map(investorCompanyLabel),
          interestNames: interests.slice(0, 4).map(investorCompanyLabel),
        }}
      />

      <div className="mb-6">
        <NextBestActionsPanel
          role="investor"
          initialActions={nextBestActions.actions}
          limit={5}
          viewAllHref="/investor/actions"
        />
      </div>

      <section className="mt-2">
        <InvestorDashboardCondensedGrid
          watchlistCount={savedDeals.length}
          interestCount={interests.length}
          introCount={introRequests.length}
          topMatches={topMatches}
          recentActivity={crmActivity.rows}
        />
      </section>
    </AppShell>
  );
}
