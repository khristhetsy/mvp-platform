import { AppShell } from "@/components/AppShell";
import { InvestorFeatureGate } from "@/components/InvestorFeatureGate";
import { getTranslations } from "next-intl/server";
import { InvestorSpvWorkspace } from "@/components/InvestorSpvWorkspace";
import { PageHeader } from "@/components/ui/PageHeader";
import { canInvestorPerformSensitiveActions } from "@/lib/investor/access";
import { listInvestorParticipationRequirements } from "@/lib/spv/participation-requirements";
import { loadInvestorSpvWorkspace } from "@/lib/spv/spv-workflow";
import { loadInvestorWorkspaceContext } from "@/lib/investor/load-investor-workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import { resolveInvestorDependencies } from "@/lib/automation/dependencies";
import { CollaborationDiscussionPanel } from "@/components/collaboration/CollaborationDiscussionPanel";
import { DraftEmailPanel } from "@/components/email/DraftEmailPanel";
import { WorkflowDependencyPanel } from "@/components/workflow/WorkflowDependencyPanel";

export const dynamic = "force-dynamic";

export default async function InvestorSpvsPage() {
  const { profile } = await requireInvestorWorkspaceSession();
  const t = await getTranslations("appPages");
  const { investorProfile } = await loadInvestorWorkspaceContext(profile);
  const investorProfileId = investorProfile?.id;

  if (!canInvestorPerformSensitiveActions(investorProfile)) {
    redirect("/investor/dashboard");
  }

  const supabase = await createServerSupabaseClient();
  const [workspace, requirementsResult] = await Promise.all([
    loadInvestorSpvWorkspace(supabase, profile.id),
    listInvestorParticipationRequirements(supabase, profile.id),
  ]);
  const requirements =
    "data" in requirementsResult ? (requirementsResult.data ?? []) : [];
  const workflowDependencies = investorProfileId
    ? await resolveInvestorDependencies(supabase, investorProfileId).catch(() => [])
    : [];

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle={t("spv_participation")}
    >
      <PageHeader
        eyebrow={t("portfolio_deals")}
        title={t("spvs")}
        description={t("review_admin_managed_spv_opportunities_and_exp")}
      />

      {investorProfileId ? (
        <div className="mb-6 space-y-4">
          <DraftEmailPanel
            role="investor"
            entityType="investor"
            entityId={investorProfileId}
            defaultTemplate="investor_spv_requirement_reminder"
          />
          <CollaborationDiscussionPanel
            entityType="investor"
            entityId={investorProfileId}
            title={t("investor_workspace_discussion")}
          />
        </div>
      ) : null}

      {workflowDependencies.length > 0 ? (
        <div className="mb-6">
          <WorkflowDependencyPanel dependencies={workflowDependencies} title={t("participation_blockers")} />
        </div>
      ) : null}

      <InvestorFeatureGate>
        <InvestorSpvWorkspace
          openOpportunities={workspace.openOpportunities}
          participations={workspace.participations}
          requirements={requirements}
        />
      </InvestorFeatureGate>
    </AppShell>
  );
}
