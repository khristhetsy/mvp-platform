import type { SupabaseClient } from "@supabase/supabase-js";
import { buildActionId, createNextBestAction } from "@/lib/next-best-actions/action-catalog";
import type { NextBestAction } from "@/lib/next-best-actions/types";
import { loadInvestorWorkspacePageData } from "@/lib/data/investor-workspace-page";
import { getInvestorProfileByProfileId, isInvestorProfileComplete } from "@/lib/investor/profile";
import { listInvestorParticipationRequirements } from "@/lib/spv/participation-requirements";
import { loadInvestorSpvWorkspace } from "@/lib/spv/spv-workflow";
import { countUnreadNotifications } from "@/lib/notifications/notifications";
import type { Profile, Database } from "@/lib/supabase/types";

export type InvestorNbaContext = {
  approvalStatus: string;
  profileComplete: boolean;
  savedDealsCount: number;
  interestsCount: number;
  introRequestsCount: number;
  savedWithoutInterest: number;
  interestWithoutIntro: number;
  pendingRequirementsCount: number;
  rejectedRequirementsCount: number;
  proposedMeetingsCount: number;
  unreadNotifications: number;
  unreadCompanyUpdates: number;
};

export async function loadInvestorNbaContext(
  profile: Profile,
  supabase: SupabaseClient<Database>,
): Promise<InvestorNbaContext> {
  const investorProfile = await getInvestorProfileByProfileId(profile.id);
  const approvalStatus = investorProfile?.approval_status ?? "draft";
  const profileComplete = investorProfile ? isInvestorProfileComplete(investorProfile) : false;

  const [{ workspace }, requirementsResult, proposedMeetings, unreadNotifications, unreadUpdates] = await Promise.all([
    loadInvestorWorkspacePageData(profile.id, 50),
    listInvestorParticipationRequirements(supabase, profile.id),
    supabase
      .from("thread_meetings")
      .select("id", { count: "exact", head: true })
      .eq("investor_id", profile.id)
      .eq("status", "proposed"),
    countUnreadNotifications(profile.id).catch(() => 0),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", profile.id)
      .eq("is_read", false)
      .eq("type", "company_update_published"),
  ]);

  const requirements = requirementsResult.data ?? [];
  const pendingRequirements = requirements.filter((row) =>
    ["pending", "uploaded", "under_review"].includes(row.status),
  );
  const rejectedRequirements = requirements.filter((row) => row.status === "rejected");

  const interestCompanyIds = new Set(workspace.interests.map((row) => row.company_id));
  const introCompanyIds = new Set(workspace.introRequests.map((row) => row.company_id));
  const savedWithoutInterest = workspace.savedDeals.filter((row) => row.company_id && !interestCompanyIds.has(row.company_id)).length;
  const interestWithoutIntro = workspace.interests.filter((row) => row.company_id && !introCompanyIds.has(row.company_id)).length;

  return {
    approvalStatus,
    profileComplete,
    savedDealsCount: workspace.savedDeals.length,
    interestsCount: workspace.interests.length,
    introRequestsCount: workspace.introRequests.length,
    savedWithoutInterest,
    interestWithoutIntro,
    pendingRequirementsCount: pendingRequirements.length,
    rejectedRequirementsCount: rejectedRequirements.length,
    proposedMeetingsCount: proposedMeetings.count ?? 0,
    unreadNotifications,
    unreadCompanyUpdates: unreadUpdates.count ?? 0,
  };
}

export function computeInvestorActions(ctx: InvestorNbaContext, entityFilter?: { entityType?: string; entityId?: string }): NextBestAction[] {
  const actions: NextBestAction[] = [];
  const investorId = entityFilter?.entityType === "investor" ? entityFilter.entityId : undefined;

  if (!ctx.profileComplete && ctx.approvalStatus === "draft") {
    actions.push(
      createNextBestAction({
        id: buildActionId(["investor", "profile_incomplete"]),
        role: "investor",
        title: "Complete investor profile",
        description: "Add investment preferences so opportunity matching and SPV workflows can personalize to you.",
        priority: "high",
        category: "onboarding",
        entityType: "investor",
        investorId,
        href: "/investor/onboarding",
        sourceModule: "investor_profiles",
        reason: "Investor onboarding profile is incomplete.",
        createdFrom: "investor_nba",
      }),
    );
  }

  if (ctx.approvalStatus === "draft" && ctx.profileComplete) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["investor", "submit_approval"]),
        role: "investor",
        title: "Submit for approval",
        description: "Submit your investor profile for admin review to unlock marketplace and SPV participation.",
        priority: "high",
        category: "onboarding",
        entityType: "investor",
        investorId,
        href: "/investor/onboarding",
        sourceModule: "investor_profiles",
        reason: "Profile is complete but not yet submitted for approval.",
        createdFrom: "investor_nba",
      }),
    );
  }

  if (ctx.approvalStatus === "changes_requested") {
    actions.push(
      createNextBestAction({
        id: buildActionId(["investor", "changes_requested"]),
        role: "investor",
        title: "Address approval feedback",
        description: "Admin requested changes to your investor profile before approval.",
        priority: "critical",
        category: "onboarding",
        entityType: "investor",
        investorId,
        href: "/investor/onboarding",
        sourceModule: "investor_profiles",
        reason: "Approval status is changes_requested.",
        createdFrom: "investor_nba",
      }),
    );
  }

  if (ctx.approvalStatus === "submitted") {
    actions.push(
      createNextBestAction({
        id: buildActionId(["investor", "pending_approval"]),
        role: "investor",
        title: "Awaiting admin approval",
        description: "Your profile is under review. You can still update preferences while waiting.",
        priority: "medium",
        category: "onboarding",
        entityType: "investor",
        investorId,
        href: "/investor/settings",
        sourceModule: "investor_profiles",
        reason: "Investor profile submitted and pending admin approval.",
        blockers: ["Admin approval pending"],
        createdFrom: "investor_nba",
      }),
    );
  }

  if (ctx.approvalStatus === "approved" && ctx.savedWithoutInterest > 0) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["investor", "saved_review"]),
        role: "investor",
        title: "Review saved opportunities",
        description: `${ctx.savedWithoutInterest} saved ${ctx.savedWithoutInterest === 1 ? "deal" : "deals"} without expressed interest yet.`,
        priority: "medium",
        category: "investor_engagement",
        entityType: "investor",
        investorId,
        href: "/investor/watchlist",
        sourceModule: "saved_deals",
        reason: "Watchlist items may be ready for interest or intro requests.",
        createdFrom: "investor_nba",
      }),
    );
  }

  if (ctx.approvalStatus === "approved" && ctx.interestWithoutIntro > 0) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["investor", "intro_from_interest"]),
        role: "investor",
        title: "Request intro for interested companies",
        description: `${ctx.interestWithoutIntro} ${ctx.interestWithoutIntro === 1 ? "company has" : "companies have"} interest recorded without an intro request.`,
        priority: "medium",
        category: "investor_engagement",
        entityType: "investor",
        investorId,
        href: "/investor/opportunities",
        sourceModule: "investor_interests",
        reason: "Intro requests are the next step after expressing interest.",
        createdFrom: "investor_nba",
      }),
    );
  }

  if (ctx.rejectedRequirementsCount > 0) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["investor", "spv_rejected_reqs"]),
        role: "investor",
        title: "Resubmit SPV documents",
        description: `${ctx.rejectedRequirementsCount} SPV requirement${ctx.rejectedRequirementsCount === 1 ? "" : "s"} were rejected and need resubmission.`,
        priority: "critical",
        category: "spv",
        entityType: "investor",
        investorId,
        href: "/investor/spvs",
        sourceModule: "spv_requirements",
        reason: "Rejected requirements block SPV progression.",
        createdFrom: "investor_nba",
      }),
    );
  } else if (ctx.pendingRequirementsCount > 0) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["investor", "spv_pending_reqs"]),
        role: "investor",
        title: "Complete SPV requirements",
        description: `${ctx.pendingRequirementsCount} SPV document requirement${ctx.pendingRequirementsCount === 1 ? "" : "s"} need attention.`,
        priority: "high",
        category: "spv",
        entityType: "investor",
        investorId,
        href: "/investor/spvs",
        sourceModule: "spv_requirements",
        reason: "Pending requirements block operational SPV readiness.",
        createdFrom: "investor_nba",
      }),
    );
  }

  if (ctx.proposedMeetingsCount > 0) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["investor", "meeting_proposed"]),
        role: "investor",
        title: "Respond to meeting request",
        description: `${ctx.proposedMeetingsCount} proposed meeting${ctx.proposedMeetingsCount === 1 ? "" : "s"} await your response.`,
        priority: "high",
        category: "investor_engagement",
        entityType: "investor",
        investorId,
        href: "/investor/messages",
        sourceModule: "messaging",
        reason: "Meeting proposals need accept or decline.",
        createdFrom: "investor_nba",
      }),
    );
  }

  if (ctx.unreadCompanyUpdates > 0) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["investor", "company_updates"]),
        role: "investor",
        title: "Review company updates",
        description: `${ctx.unreadCompanyUpdates} unread company update notification${ctx.unreadCompanyUpdates === 1 ? "" : "s"}.`,
        priority: "low",
        category: "investor_engagement",
        entityType: "investor",
        investorId,
        href: "/investor/portfolio",
        sourceModule: "notifications",
        reason: "Founders published updates relevant to your portfolio.",
        createdFrom: "investor_nba",
      }),
    );
  }

  if (ctx.approvalStatus === "approved" && actions.length < 3) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["investor", "opportunities"]),
        role: "investor",
        title: "Browse matched opportunities",
        description: "Review marketplace listings ranked for your investment preferences.",
        priority: "low",
        category: "investor_engagement",
        entityType: "investor",
        investorId,
        href: "/investor/opportunities",
        sourceModule: "matching",
        reason: "Stay current on new marketplace opportunities.",
        createdFrom: "investor_nba",
      }),
    );
  }

  return actions;
}
