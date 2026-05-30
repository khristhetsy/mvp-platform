import { AppShell } from "@/components/AppShell";
import { InvestorFeatureGate } from "@/components/InvestorFeatureGate";
import { InvestorPortfolioSections } from "@/components/InvestorPortfolioSections";
import { canInvestorPerformSensitiveActions } from "@/lib/investor/access";
import { loadInvestorPortfolio } from "@/lib/investor/load-portfolio";
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

  const portfolio = await loadInvestorPortfolio(investorId);

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Portfolio & updates"
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Investor Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Portfolio</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Watchlist, pending indicative commitments, relationship tracking, and company updates. Not a legal
          investment account or securities ownership record.
        </p>
      </div>

      <InvestorFeatureGate>
        <InvestorPortfolioSections portfolio={portfolio} />
      </InvestorFeatureGate>
    </AppShell>
  );
}
