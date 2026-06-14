import { AppShell } from "@/components/AppShell";
import { InvestorFeatureGate } from "@/components/InvestorFeatureGate";
import { InvestorPortfolioPageClient } from "@/components/investor/InvestorPortfolioPageClient";
import { canInvestorPerformSensitiveActions } from "@/lib/investor/access";
import { loadInvestorWorkspaceContext } from "@/lib/investor/load-investor-workspace";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function InvestorPortfolioPage() {
  const { profile, investorId } = await requireInvestorWorkspaceSession();
  const { investorProfile } = await loadInvestorWorkspaceContext(profile);

  if (!canInvestorPerformSensitiveActions(investorProfile?.approval_status)) {
    redirect("/investor/dashboard");
  }

  void investorId; // used for session auth; portfolio loaded client-side via API

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Portfolio & deals"
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Investor Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Portfolio</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Track your pledges, investments, and returns across all deals — linked and self-reported.
          Not a legal investment account or securities ownership record.
        </p>
      </div>

      <InvestorFeatureGate>
        <InvestorPortfolioPageClient />
      </InvestorFeatureGate>
    </AppShell>
  );
}
