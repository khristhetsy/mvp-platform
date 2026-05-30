import { formatPledgeTotal } from "@/lib/data/investor-pledges";
import { loadInvestorWorkspacePageData } from "@/lib/data/investor-workspace-page";
import { loadInvestorRecommendedMatches } from "@/lib/matching/load-investor-recommendations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type InvestorAnalyticsSnapshot = {
  savedDeals: number;
  expressedInterests: number;
  introRequests: number;
  messageThreadCount: number;
  meetingsScheduled: number;
  recommendedOpportunities: number;
  averageMatchScore: number | null;
  pledgeTotalDisplay: string;
  indicativeTotalDisplay: string;
  pendingInterestCount: number;
  portfolioInterestCount: number;
  recentActivityCount: number;
};

export async function loadInvestorAnalytics(
  investorId: string,
  crmLimit = 30,
): Promise<InvestorAnalyticsSnapshot> {
  const supabase = await createServerSupabaseClient();
  const { workspace, crmActivity } = await loadInvestorWorkspacePageData(investorId, crmLimit);
  const recommendations = await loadInvestorRecommendedMatches(supabase, investorId, 50);

  const pledgeCurrency =
    workspace.interests.find((row) => row.pledge_currency)?.pledge_currency ?? "USD";

  let pledgeTotal = 0;
  let indicativeTotal = 0;
  let pendingInterestCount = 0;

  for (const row of workspace.interests) {
    if (row.pledge_amount != null && Number(row.pledge_amount) > 0) {
      pledgeTotal += Number(row.pledge_amount);
      pendingInterestCount += 1;
    } else if (row.interest_amount != null && Number(row.interest_amount) > 0) {
      indicativeTotal += Number(row.interest_amount);
      pendingInterestCount += 1;
    } else {
      pendingInterestCount += 1;
    }
  }

  const matchScores = recommendations.matches.map((row) => row.matchScore);
  const averageMatchScore =
    matchScores.length > 0
      ? Math.round(matchScores.reduce((sum, score) => sum + score, 0) / matchScores.length)
      : null;

  const threads = await supabase
    .from("message_threads")
    .select("id", { count: "exact", head: true })
    .eq("investor_id", investorId);

  const threadRows = await supabase.from("message_threads").select("id").eq("investor_id", investorId);
  const threadIds = (threadRows.data ?? []).map((row) => row.id);
  let meetingsScheduled = 0;
  if (threadIds.length > 0) {
    const { count } = await supabase
      .from("thread_meetings")
      .select("id", { count: "exact", head: true })
      .in("thread_id", threadIds)
      .eq("status", "scheduled");
    meetingsScheduled = count ?? 0;
  }

  return {
    savedDeals: workspace.savedDeals.length,
    expressedInterests: workspace.interests.length,
    introRequests: workspace.introRequests.length,
    messageThreadCount: threads.count ?? 0,
    meetingsScheduled,
    recommendedOpportunities: recommendations.matches.length,
    averageMatchScore,
    pledgeTotalDisplay: formatPledgeTotal(pledgeTotal, pledgeCurrency),
    indicativeTotalDisplay: formatPledgeTotal(indicativeTotal, pledgeCurrency),
    pendingInterestCount,
    portfolioInterestCount: workspace.interests.length,
    recentActivityCount: crmActivity.rows.length,
  };
}
