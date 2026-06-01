import { AppShell } from "@/components/AppShell";
import { InvestorFeatureGate } from "@/components/InvestorFeatureGate";
import { InvestorSpvWorkspace } from "@/components/InvestorSpvWorkspace";
import { canInvestorPerformSensitiveActions } from "@/lib/investor/access";
import { listInvestorParticipationRequirements } from "@/lib/spv/participation-requirements";
import { loadInvestorSpvWorkspace } from "@/lib/spv/spv-workflow";
import { loadInvestorWorkspaceContext } from "@/lib/investor/load-investor-workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import { resolveInvestorDependencies } from "@/lib/automation/dependencies";
import { CollaborationDiscussionPanel } from "@/components/collaboration/CollaborationDiscussionPanel";
import { WorkflowDependencyPanel } from "@/components/workflow/WorkflowDependencyPanel";

export const dynamic = "force-dynamic";

export default async function InvestorSpvsPage() {
  const { profile } = await requireInvestorWorkspaceSession();
  const { investorProfile } = await loadInvestorWorkspaceContext(profile);
  const investorProfileId = investorProfile?.id;

  if (!canInvestorPerformSensitiveActions(investorProfile?.approval_status)) {
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
      profileSubtitle="SPV participation"
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Investor Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">SPVs</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Review admin-managed SPV opportunities and express non-binding indicative interest. Legal documents
          and eligibility checks are required before any investment.
        </p>
      </div>

      {investorProfileId ? (
        <div className="mb-6">
          <CollaborationDiscussionPanel
            entityType="investor"
            entityId={investorProfileId}
            title="Investor workspace discussion"
          />
        </div>
      ) : null}

      {workflowDependencies.length > 0 ? (
        <div className="mb-6">
          <WorkflowDependencyPanel dependencies={workflowDependencies} title="Participation blockers" />
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
