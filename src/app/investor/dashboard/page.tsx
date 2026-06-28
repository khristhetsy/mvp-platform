import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { TipOfTheDay } from "@/components/tips/TipOfTheDay";
import { InvestorOnboardingProgressCard } from "@/components/InvestorOnboardingProgressCard";
import { investorCompanyLabel, loadInvestorWorkspacePageData } from "@/lib/data/investor-workspace-page";
import { loadInvestorRecommendedMatches } from "@/lib/matching/load-investor-recommendations";
import { loadInvestorWorkspaceContext } from "@/lib/investor/load-investor-workspace";
import { computeInvestorOnboardingProgress } from "@/lib/investor/profile";
import { InvestorJourneyTracker } from "@/components/investor/InvestorJourneyTracker";
import { loadInvestorJourney } from "@/lib/investor-journey/load";
import { InvestorFirstRunModal } from "@/components/investor/InvestorFirstRunModal";
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

  const [{ workspace, crmActivity }, { matches }, nextBestActions] = await Promise.all([
    loadInvestorWorkspacePageData(investorId),
    loadInvestorRecommendedMatches(supabase, investorId, 4),
    loadAndMergeNextBestActions({ profile, supabase, options: { role: "investor", limit: 5, sync: true } }),
  ]);
  const savedDeals = workspace.savedDeals;
  const interests = workspace.interests;
  const introRequests = workspace.introRequests;
  const topMatches = matches.slice(0, 4);

  // 4-stage journey tracker + the one contextual next step.
  const journey = investorProfile
    ? await loadInvestorJourney(investorProfile, {
        hasEngaged: interests.length > 0 || introRequests.length > 0,
      })
    : null;
  const inOnboardStage = journey?.stageView.current.key === "onboard";

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

      {journey ? <InvestorJourneyTracker stageView={journey.stageView} coach={journey.coach} /> : null}

      {inOnboardStage && investorProgress ? (
        <InvestorOnboardingProgressCard progress={investorProgress} />
      ) : null}

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

      <InvestorFirstRunModal isNew={savedDeals.length === 0 && interests.length === 0} />

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
