import { AppShell } from "@/components/AppShell";
import { InvestorFeatureGate } from "@/components/InvestorFeatureGate";
import { InvestorActivityTimeline } from "@/components/InvestorActivityTimeline";
import { InterestPipelineKanban } from "@/components/InterestPipelineKanban";
import { loadInvestorWorkspacePageData } from "@/lib/data/investor-workspace-page";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorInterestPipelinePage() {
  const { profile, investorId } = await requireInvestorWorkspaceSession();
  const { workspace, crmActivity } = await loadInvestorWorkspacePageData(investorId, 20);

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Investor Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Interest Pipeline</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Track expressed interest, pledge amounts, intro requests, and follow-ups across marketplace listings.
        </p>
      </div>

      <InvestorFeatureGate>
        <InterestPipelineKanban
          interests={workspace.interests}
          introRequests={workspace.introRequests}
          savedDeals={workspace.savedDeals}
        />

        <section className="mt-8">
          <InvestorActivityTimeline activities={crmActivity.rows} error={crmActivity.error} />
        </section>
      </InvestorFeatureGate>
    </AppShell>
  );
}
