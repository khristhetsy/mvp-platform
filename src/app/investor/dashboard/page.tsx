import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { TipOfTheDay } from "@/components/tips/TipOfTheDay";
import { InvestorOnboardingProgressCard } from "@/components/InvestorOnboardingProgressCard";
import { investorCompanyLabel, loadInvestorWorkspacePageData } from "@/lib/data/investor-workspace-page";
import { loadInvestorRecommendedMatches } from "@/lib/matching/load-investor-recommendations";
import { loadInvestorWorkspaceContext } from "@/lib/investor/load-investor-workspace";
import { computeInvestorOnboardingProgress, isInvestorProfileComplete } from "@/lib/investor/profile";
import { InvestorStatusCard } from "@/components/investor/InvestorStatusCard";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { loadAndMergeNextBestActions } from "@/lib/next-best-actions/lifecycle";
import { NextBestActionsPanel } from "@/components/next-best-actions/NextBestActionsPanel";
import { UpcomingMeetingsCard } from "@/components/calendar/UpcomingMeetingsCard";
import { InvestorMetricCards } from "@/components/investor/InvestorMetricCards";
import { InvestorDashboardCondensedGrid } from "@/components/investor/InvestorDashboardCondensedGrid";
import { TaskReminderToast } from "@/components/investor/TaskReminderToast";

export const dynamic = "force-dynamic";

export default async function InvestorDashboardPage() {
  const { profile, supabase, investorId } = await requireInvestorWorkspaceSession();
  const { investorProfile } = await loadInvestorWorkspaceContext(profile);
  const investorProgress = investorProfile ? computeInvestorOnboardingProgress(investorProfile) : null;
  const approvalStatus = investorProfile?.approval_status ?? "draft";
  const profileComplete = investorProfile ? isInvestorProfileComplete(investorProfile) : false;

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

      <TipOfTheDay profileId={profile.id} audience="investor" />

      {investorProgress ? <InvestorOnboardingProgressCard progress={investorProgress} /> : null}

      <InvestorStatusCard approvalStatus={approvalStatus} profileComplete={profileComplete} />

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

      <div className="mb-6">
        <UpcomingMeetingsCard calendarHref="/investor/calendar" scheduleHref="/investor/schedule" />
      </div>

      <TaskReminderToast />

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
