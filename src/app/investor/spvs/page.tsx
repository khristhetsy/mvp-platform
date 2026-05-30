import { AppShell } from "@/components/AppShell";
import { InvestorFeatureGate } from "@/components/InvestorFeatureGate";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorSpvsPage() {
  const { profile } = await requireInvestorWorkspaceSession();

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Investor Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">SPVs</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Co-investment vehicles and SPV participation tied to your investor account.
        </p>
      </div>

      <InvestorFeatureGate>
      <WorkspacePanel title="SPV participation" subtitle="No SPV records available yet">
        <p className="text-sm leading-6 text-slate-600">
          SPV participation will appear here when you join or are invited to an SPV.
        </p>
        <p className="mt-3 text-sm text-slate-500">Coming soon — SPV subscription and allocation tracking is not yet available.</p>
      </WorkspacePanel>
      </InvestorFeatureGate>
    </AppShell>
  );
}
