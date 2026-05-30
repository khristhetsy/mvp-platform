import { AppShell } from "@/components/AppShell";
import { InvestorFeatureGate } from "@/components/InvestorFeatureGate";
import { InvestorSpvWorkspace } from "@/components/InvestorSpvWorkspace";
import { canInvestorPerformSensitiveActions } from "@/lib/investor/access";
import { loadInvestorSpvWorkspace } from "@/lib/spv/spv-workflow";
import { loadInvestorWorkspaceContext } from "@/lib/investor/load-investor-workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function InvestorSpvsPage() {
  const { profile, investorId } = await requireInvestorWorkspaceSession();
  const { investorProfile } = await loadInvestorWorkspaceContext(profile);

  if (!canInvestorPerformSensitiveActions(investorProfile?.approval_status)) {
    redirect("/investor/dashboard");
  }

  const supabase = await createServerSupabaseClient();
  const workspace = await loadInvestorSpvWorkspace(supabase, investorId);

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

      <InvestorFeatureGate>
        <InvestorSpvWorkspace
          openOpportunities={workspace.openOpportunities}
          participations={workspace.participations}
        />
      </InvestorFeatureGate>
    </AppShell>
  );
}
