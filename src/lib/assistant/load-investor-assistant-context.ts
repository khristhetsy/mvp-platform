import type { SupabaseClient } from "@supabase/supabase-js";
import { loadInvestorWorkspacePageData } from "@/lib/data/investor-workspace-page";
import { getInvestorProfileByProfileId, isInvestorProfileComplete } from "@/lib/investor/profile";
import { listInvestorParticipationRequirements } from "@/lib/spv/participation-requirements";
import { loadInvestorSpvWorkspace } from "@/lib/spv/spv-workflow";
import type { SanitizedAssistantContext } from "@/lib/assistant/types";
import {
  inferAssistantMode,
  parseEntityFromPath,
  workspaceLabelForRole,
} from "@/lib/assistant/assistant-context";
import type { Profile, Database } from "@/lib/supabase/types";

export async function loadInvestorAssistantContext(
  profile: Profile,
  supabase: SupabaseClient<Database>,
  input: {
    currentPath?: string;
    mode?: SanitizedAssistantContext["mode"];
    entityType?: string;
    entityId?: string;
  },
): Promise<SanitizedAssistantContext> {
  const currentPath = input.currentPath ?? null;
  const mode = inferAssistantMode({ role: "investor", currentPath, requestedMode: input.mode });
  const investorProfile = await getInvestorProfileByProfileId(profile.id);

  const [{ workspace, crmActivity }, spvWorkspace, requirementsResult] = await Promise.all([
    loadInvestorWorkspacePageData(profile.id, 10),
    loadInvestorSpvWorkspace(supabase, profile.id).catch(() => ({
      openOpportunities: [],
      participations: [],
    })),
    listInvestorParticipationRequirements(supabase, profile.id),
  ]);

  const requirements = requirementsResult.data ?? [];
  const pendingRequirements = requirements.filter((row) =>
    ["pending", "uploaded", "under_review", "rejected"].includes(row.status),
  );

  const approvalStatus = investorProfile?.approval_status ?? "unknown";
  const profileComplete = investorProfile ? isInvestorProfileComplete(investorProfile) : false;

  const summary: SanitizedAssistantContext["summary"] = {
    approvalStatus,
    profileComplete,
    savedDealsCount: workspace.savedDeals.length,
    interestsCount: workspace.interests.length,
    introRequestsCount: workspace.introRequests.length,
    spvParticipationCount: spvWorkspace.participations.length,
    openSpvOpportunitiesCount: spvWorkspace.openOpportunities.length,
    pendingSpvRequirementsCount: pendingRequirements.length,
    crmActivityCount: crmActivity.rows.length,
    messageThreadCount: null,
    meetingCount: null,
    companyUpdatesCount: null,
  };

  const { count: threadCount } = await supabase
    .from("message_threads")
    .select("id", { count: "exact", head: true })
    .eq("investor_id", profile.id);
  summary.messageThreadCount = threadCount ?? 0;

  const highlights: string[] = [];
  if (approvalStatus !== "approved") {
    highlights.push(
      "Investor approval is not complete — SPV participation and some marketplace actions may remain locked until admin approval.",
    );
  } else {
    highlights.push("Investor profile is approved for marketplace and SPV workflows.");
  }
  if (!profileComplete) {
    highlights.push("Investor onboarding profile is incomplete — complete preferences to improve opportunity matching.");
  }
  if (Number(summary.pendingSpvRequirementsCount) > 0) {
    highlights.push(`${summary.pendingSpvRequirementsCount} SPV document requirements need attention.`);
  }
  if (Number(summary.introRequestsCount) > 0) {
    highlights.push(`${summary.introRequestsCount} intro requests are on file (status only — message content is not shared).`);
  }

  const entityFromPath = parseEntityFromPath(currentPath);
  const entity =
    input.entityType && input.entityId
      ? { type: input.entityType, id: input.entityId, label: null }
      : entityFromPath;

  return {
    role: "investor",
    mode,
    workspaceLabel: workspaceLabelForRole("investor"),
    currentPath,
    entity: entity ? { ...entity, label: null } : null,
    summary,
    highlights,
  };
}
