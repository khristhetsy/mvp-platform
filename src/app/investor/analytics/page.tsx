import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { InvestorActivityTimeline } from "@/components/InvestorActivityTimeline";
import {
  InvestorWorkspaceDebugBox,
  InvestorWorkspaceRawDiagnosticLists,
  loadInvestorWorkspacePageDataForDebug,
} from "@/components/InvestorWorkspaceDebugBox";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { summarizeInvestorWorkspace } from "@/lib/data/investor-crm";
import { formatPledgeTotal } from "@/lib/data/investor-pledges";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorAnalyticsPage() {
  const { profile, investorId } = await requireInvestorWorkspaceSession();
  const { data, loadError } = await loadInvestorWorkspacePageDataForDebug(investorId, 30);
  const { workspace, crmActivity } = data;
  const summary = summarizeInvestorWorkspace(workspace, crmActivity);

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <InvestorWorkspaceDebugBox
        route="/investor/analytics"
        authUserId={investorId}
        profileId={profile.id}
        profileRole={String(profile.role)}
        workspace={workspace}
        crmActivity={crmActivity}
        error={loadError}
      />
      <InvestorWorkspaceRawDiagnosticLists workspace={workspace} crmActivity={crmActivity} />
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Investor Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Analytics</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Engagement summaries calculated from your saved deals, interests, intro requests, and CRM activity.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Saved deals"
          value={String(summary.savedCount)}
          detail="Companies on your watchlist"
          accent="indigo"
        />
        <MetricCard
          label="Expressed interests"
          value={String(summary.interestsCount)}
          detail="Interest records across listings"
          accent="violet"
        />
        <MetricCard
          label="Intro requests"
          value={String(summary.introRequestsCount)}
          detail="Warm intro and follow-up requests"
          accent="blue"
        />
        <MetricCard
          label="Pledged total"
          value={formatPledgeTotal(summary.pledgeTotal, summary.pledgeCurrency)}
          detail={
            summary.indicativeTotal > 0
              ? `${formatPledgeTotal(summary.indicativeTotal, summary.pledgeCurrency)} indicative interest`
              : "From your interest records"
          }
          accent="slate"
        />
        <MetricCard
          label="Recent activity"
          value={String(summary.crmActivityCount)}
          detail="CRM events in your timeline"
          accent="slate"
        />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title="Engagement summary" subtitle="Calculated from your investor records">
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              <span className="font-medium text-slate-900">{summary.savedCount}</span> saved deals
            </p>
            <p>
              <span className="font-medium text-slate-900">{summary.interestsCount}</span> expressed interests
            </p>
            <p>
              <span className="font-medium text-slate-900">{summary.introRequestsCount}</span> intro requests
            </p>
            <p>
              <span className="font-medium text-slate-900">
                {formatPledgeTotal(summary.pledgeTotal, summary.pledgeCurrency)}
              </span>{" "}
              pledged ·{" "}
              <span className="font-medium text-slate-900">
                {formatPledgeTotal(summary.indicativeTotal, summary.pledgeCurrency)}
              </span>{" "}
              indicative
            </p>
            <p>
              <span className="font-medium text-slate-900">{summary.crmActivityCount}</span> recent CRM activity events
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
    </AppShell>
  );
}
