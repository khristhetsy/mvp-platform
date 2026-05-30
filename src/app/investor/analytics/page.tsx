import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { InvestorFeatureGate } from "@/components/InvestorFeatureGate";
import { MetricCard } from "@/components/MetricCard";
import { InvestorActivityTimeline } from "@/components/InvestorActivityTimeline";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { formatPledgeTotal } from "@/lib/data/investor-pledges";
import { loadInvestorWorkspacePageData } from "@/lib/data/investor-workspace-page";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorAnalyticsPage() {
  const { profile, investorId } = await requireInvestorWorkspaceSession();
  const { workspace, crmActivity } = await loadInvestorWorkspacePageData(investorId, 30);

  const pledgeCurrency =
    workspace.interests.find((row) => row.pledge_currency)?.pledge_currency ?? "USD";
  const pledgeTotal = workspace.interests.reduce((total, row) => {
    if (row.pledge_amount == null || Number(row.pledge_amount) <= 0) {
      return total;
    }

    return total + Number(row.pledge_amount);
  }, 0);
  const indicativeTotal = workspace.interests.reduce((total, row) => {
    if (row.interest_amount == null || Number(row.interest_amount) <= 0) {
      return total;
    }

    return total + Number(row.interest_amount);
  }, 0);

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Investor Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Analytics</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Engagement summaries calculated from your saved deals, interests, intro requests, and CRM activity.
        </p>
      </div>

      <InvestorFeatureGate>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Saved deals"
          value={String(workspace.savedDeals.length)}
          detail="Companies on your watchlist"
          accent="indigo"
        />
        <MetricCard
          label="Expressed interests"
          value={String(workspace.interests.length)}
          detail="Interest records across listings"
          accent="violet"
        />
        <MetricCard
          label="Intro requests"
          value={String(workspace.introRequests.length)}
          detail="Warm intro and follow-up requests"
          accent="blue"
        />
        <MetricCard
          label="Pledged total"
          value={formatPledgeTotal(pledgeTotal, pledgeCurrency)}
          detail={
            indicativeTotal > 0
              ? `${formatPledgeTotal(indicativeTotal, pledgeCurrency)} indicative interest`
              : "From your interest records"
          }
          accent="slate"
        />
        <MetricCard
          label="Recent activity"
          value={String(crmActivity.rows.length)}
          detail="CRM events in your timeline"
          accent="slate"
        />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title="Engagement summary" subtitle="Calculated from your investor records">
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              <span className="font-medium text-slate-900">{workspace.savedDeals.length}</span> saved deals
            </p>
            <p>
              <span className="font-medium text-slate-900">{workspace.interests.length}</span> expressed interests
            </p>
            <p>
              <span className="font-medium text-slate-900">{workspace.introRequests.length}</span> intro requests
            </p>
            <p>
              <span className="font-medium text-slate-900">
                {formatPledgeTotal(pledgeTotal, pledgeCurrency)}
              </span>{" "}
              pledged ·{" "}
              <span className="font-medium text-slate-900">
                {formatPledgeTotal(indicativeTotal, pledgeCurrency)}
              </span>{" "}
              indicative
            </p>
            <p>
              <span className="font-medium text-slate-900">{crmActivity.rows.length}</span> recent CRM activity events
            </p>
          </div>
          <Link
            href="/investor/dashboard"
            className="mt-4 inline-block text-sm font-semibold text-indigo-700 hover:text-indigo-900"
          >
            Open investor dashboard
          </Link>
        </WorkspacePanel>

        <InvestorActivityTimeline activities={crmActivity.rows} error={crmActivity.error} />
      </section>
      </InvestorFeatureGate>
    </AppShell>
  );
}
