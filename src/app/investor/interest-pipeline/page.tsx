import { AppShell } from "@/components/AppShell";
import { InvestorFeatureGate } from "@/components/InvestorFeatureGate";
import { getTranslations } from "next-intl/server";
import { InterestPipelineKanban } from "@/components/InterestPipelineKanban";
import { PageHeader } from "@/components/ui/PageHeader";
import { loadInvestorWorkspacePageData } from "@/lib/data/investor-workspace-page";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorInterestPipelinePage() {
  const { profile, investorId } = await requireInvestorWorkspaceSession();
  const t = await getTranslations("appPages");
  const { workspace } = await loadInvestorWorkspacePageData(investorId, 20);

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle={t("investor_account")}
    >
      <PageHeader
        eyebrow={t("deal_flow_2")}
        title={t("interest_pipeline")}
        description={t("track_expressed_interest_pledge_amounts_intro")}
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
