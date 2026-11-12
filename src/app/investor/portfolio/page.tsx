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
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { createServiceRoleClient } from "@/lib/supabase/admin";
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

  const pledgesOn = isFeatureEnabled(
    await loadFeatureFlags(createServiceRoleClient()),
    "investor",
    "pledged",
  );

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
          description={
            pledgesOn
              ? t("track_your_pledges_investments_and_returns_acr")
              : "Track your investments and returns across your portfolio."
          }
        />
        <InvestorFeatureGate>
          {/* Facilitated intro connections — server-rendered */}
          <Suspense fallback={null}>
            <InvestorFacilitatedIntrosPanel investorId={investorId} />
          </Suspense>
          {/* Full investment tracker — client-rendered */}
          <Suspense fallback={null}>
            <InvestorPortfolioPageClient showPledges={pledgesOn} />
          </Suspense>
        </InvestorFeatureGate>
      </WorkspacePageContainer>
    </AppShell>
  );
}
