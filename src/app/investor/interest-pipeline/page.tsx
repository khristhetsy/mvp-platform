import { AppShell } from "@/components/AppShell";
import { InvestorFeatureGate } from "@/components/InvestorFeatureGate";
import { InterestPipelineKanban } from "@/components/InterestPipelineKanban";
import { PageHeader } from "@/components/ui/PageHeader";
import { loadInvestorWorkspacePageData } from "@/lib/data/investor-workspace-page";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorInterestPipelinePage() {
  const { profile, investorId } = await requireInvestorWorkspaceSession();
  const { workspace } = await loadInvestorWorkspacePageData(investorId, 20);

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <PageHeader
        eyebrow="Deal flow"
        title="Interest pipeline"
        description="Track expressed interest, pledge amounts, intro requests, and follow-ups across marketplace listings."
      />

      <InvestorFeatureGate>
        <InterestPipelineKanban
          interests={workspace.interests}
          introRequests={workspace.introRequests}
          savedDeals={workspace.savedDeals}
        />
      </InvestorFeatureGate>
    </AppShell>
  );
}
