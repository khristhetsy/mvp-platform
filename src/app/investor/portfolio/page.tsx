import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { InvestorFeatureGate } from "@/components/InvestorFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { InvestorPortfolioPageClient } from "@/components/investor/InvestorPortfolioPageClient";
import { InvestorFacilitatedIntrosPanel } from "@/components/investor/InvestorFacilitatedIntrosPanel";
import { canInvestorPerformSensitiveActions } from "@/lib/investor/access";
import { loadInvestorWorkspaceContext } from "@/lib/investor/load-investor-workspace";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function InvestorPortfolioPage() {
  const { profile, investorId } = await requireInvestorWorkspaceSession();
  const t = await getTranslations("appPages");
  const { investorProfile } = await loadInvestorWorkspaceContext(profile);

  if (!canInvestorPerformSensitiveActions(investorProfile)) {
    redirect("/investor/dashboard");
  }

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle={t("investor_account")}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow={t("investor_workspace_2")}
          title={t("portfolio")}
          description={t("track_your_pledges_investments_and_returns_acr")}
        />
        <InvestorFeatureGate>
          {/* Facilitated intro connections — server-rendered */}
          <Suspense fallback={null}>
            <InvestorFacilitatedIntrosPanel investorId={investorId} />
          </Suspense>
          {/* Full investment tracker — client-rendered */}
          <Suspense fallback={null}>
            <InvestorPortfolioPageClient />
          </Suspense>
        </InvestorFeatureGate>
      </WorkspacePageContainer>
    </AppShell>
  );
}
