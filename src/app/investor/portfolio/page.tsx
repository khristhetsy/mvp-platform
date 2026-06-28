import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
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
  const { investorProfile } = await loadInvestorWorkspaceContext(profile);

  if (!canInvestorPerformSensitiveActions(investorProfile)) {
    redirect("/investor/dashboard");
  }

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Investor workspace"
          title="Portfolio"
          description="Track your pledges, investments, and returns across all deals — linked and self-reported."
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
