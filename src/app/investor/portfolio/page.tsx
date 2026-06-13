import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { InvestorPortfolioPageClient } from "@/components/investor/InvestorPortfolioPageClient";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorPortfolioPage() {
  const { profile } = await requireInvestorWorkspaceSession();

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Portfolio & deals"
    >
      <PageHeader
        eyebrow="Investor workspace"
        title="Portfolio & deals"
        description="Track your startup investments. Valuations are self-reported or synced from active deal rooms — not a securities ownership record."
      />
      <InvestorPortfolioPageClient />
    </AppShell>
  );
}
