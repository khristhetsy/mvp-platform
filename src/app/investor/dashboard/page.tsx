import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { InvestorPipelineStages } from "@/components/ui/InvestorPipelineStages";
import { MetricRow } from "@/components/ui/OperationalMetric";
import { PageHeader } from "@/components/ui/PageHeader";
import { DashboardInsightPanel } from "@/components/ui/DashboardInsightPanel";
import { InvestorActivityTimeline } from "@/components/InvestorActivityTimeline";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { InvestorApprovalBanner } from "@/components/InvestorApprovalBanner";
import { investorCompanyLabel, loadInvestorWorkspacePageData } from "@/lib/data/investor-workspace-page";
import { InvestorMatchOpportunityCard } from "@/components/InvestorMatchOpportunityCard";
import { loadInvestorRecommendedMatches } from "@/lib/matching/load-investor-recommendations";
import { loadInvestorWorkspaceContext } from "@/lib/investor/load-investor-workspace";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { loadAndMergeNextBestActions } from "@/lib/next-best-actions/lifecycle";
import { NextBestActionsPanel } from "@/components/next-best-actions/NextBestActionsPanel";

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

      <div className="mb-6">
        <NextBestActionsPanel
          role="investor"
          initialActions={nextBestActions.actions}
          limit={5}
          viewAllHref="/investor/actions"
        />
      </div>

      <section className="mb-6">
        <InvestorPipelineStages
          watchlistCount={savedDeals.length}
          interestCount={interests.length}
          introCount={introRequests.length}
        />
      </section>

      <MetricRow title="Workspace metrics" subtitle="Non-binding indicators only">
        <MetricCard
          label="Active Opportunities"
          value={String(matches.length)}
          detail="Published listings ranked for your profile"
          accent="indigo"
          sparklineValues={[1, 2, 3, matches.length, matches.length, matches.length, matches.length]}
          href="/investor/opportunities"
        />
        <MetricCard
          label="Watchlist"
          value={String(savedDeals.length)}
          detail={savedDeals.slice(0, 2).map(investorCompanyLabel).join(", ") || "No saved deals yet"}
          accent="violet"
          sparklineValues={[0, 1, 1, savedDeals.length, savedDeals.length, savedDeals.length, savedDeals.length]}
          href="/investor/portfolio"
        />
        <MetricCard
          label="Expressed Interest"
          value={String(interests.length)}
          detail={interests.slice(0, 2).map(investorCompanyLabel).join(", ") || "None yet"}
          accent="blue"
          sparklineValues={[0, 0, 1, interests.length, interests.length, interests.length, interests.length]}
          href="/investor/portfolio"
        />
        <MetricCard
          label="Portfolio"
          value={String(savedDeals.length + interests.length)}
          detail="Watchlist, commitments, and company updates"
          accent="slate"
          sparklineValues={[0, 1, 2, savedDeals.length + interests.length, savedDeals.length + interests.length, savedDeals.length + interests.length, savedDeals.length + interests.length]}
          href="/investor/portfolio"
        />
      </MetricRow>

      <section className="mb-5">
        <DashboardInsightPanel title="Pipeline momentum" subtitle="Watchlist and interest activity" />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title="Portfolio" subtitle="Watchlist, pipeline, and company updates">
          <p className="text-sm text-slate-600">
            Review saved deals, expressed interest, SPV participations, and founder updates in one place.
          </p>
          <Link
            href="/investor/portfolio"
            className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white"
          >
            Open portfolio
          </Link>
          <p className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            {introRequests.length} intro {introRequests.length === 1 ? "request" : "requests"} pending follow-up.
          </p>
        </WorkspacePanel>

        <WorkspacePanel
          title="Recommended for you"
          subtitle="Match score from your onboarding preferences"
          action={
            <Link href="/investor/opportunities" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
              View all matches
            </Link>
          }
        >
          {topMatches.length === 0 ? (
            <p className="text-sm text-slate-600">No published listings yet. Complete onboarding to improve matches.</p>
          ) : (
            <div className="grid gap-3">
              {topMatches.map((row) => (
                <InvestorMatchOpportunityCard
                  key={row.company.id}
                  companyId={row.company.id}
                  companyName={row.company.companyName}
                  slug={row.company.slug}
                  industry={row.company.industry}
                  stage={row.company.stage}
                  location={row.company.geography}
                  fundingTarget={
                    row.company.fundingAmount != null
                      ? new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        }).format(row.company.fundingAmount)
                      : null
                  }
                  matchScore={row.matchScore}
                  matchReasons={row.matchReasons}
                  missingFitReasons={row.missingFitReasons}
                />
              ))}
            </div>
          )}
        </WorkspacePanel>
      </section>

      <section className="mt-8">
        <InvestorActivityTimeline activities={crmActivity.rows} error={crmActivity.error} />
      </section>
    </AppShell>
  );
}
