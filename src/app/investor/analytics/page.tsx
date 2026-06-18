import Link from "next/link";
import { AnalyticsBreakdownPanel } from "@/components/AnalyticsBreakdownPanel";
import { AppShell } from "@/components/AppShell";
import { InvestorFeatureGate } from "@/components/InvestorFeatureGate";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { loadInvestorAnalytics } from "@/lib/analytics/investor-analytics";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorAnalyticsPage() {
  const { profile, investorId } = await requireInvestorWorkspaceSession();
  const [analytics] = await Promise.all([
    loadInvestorAnalytics(investorId, 30),
  ]);

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <PageHeader
        eyebrow="Investor workspace"
        title="Analytics"
        description="Your engagement command center — saved deals, interests, messaging, and match signals from CapitalOS data only."
      />

      <InvestorFeatureGate>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Saved deals" value={String(analytics.savedDeals)} detail="Companies on your watchlist" accent="indigo" href="/investor/portfolio" />
          <MetricCard
            label="Expressed interests"
            value={String(analytics.expressedInterests)}
            detail="Interest records across listings"
            accent="violet"
            href="/investor/portfolio"
          />
          <MetricCard
            label="Intro requests"
            value={String(analytics.introRequests)}
            detail="Warm intro and follow-up requests"
            accent="blue"
            href="/investor/messages"
          />
          <MetricCard
            label="Recommended deals"
            value={String(analytics.recommendedOpportunities)}
            detail={
              analytics.averageMatchScore != null
                ? `${analytics.averageMatchScore}% average match score`
                : "Match scores from marketplace listings"
            }
            accent="indigo"
            href="/investor/opportunities"
          />
          <MetricCard
            label="Message threads"
            value={String(analytics.messageThreadCount)}
            detail={`${analytics.meetingsScheduled} meetings scheduled`}
            accent="slate"
            href="/investor/messages"
          />
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Pledged total"
            value={analytics.pledgeTotalDisplay}
            detail={`${analytics.indicativeTotalDisplay} indicative interest`}
            accent="slate"
            href="/investor/portfolio"
          />
          <MetricCard
            label="Pending / indicative"
            value={String(analytics.pendingInterestCount)}
            detail={`${analytics.portfolioInterestCount} portfolio interest rows`}
            accent="violet"
            href="/investor/portfolio"
          />
          <MetricCard
            label="Recent CRM activity"
            value={String(analytics.recentActivityCount)}
            detail="Events in your timeline"
            accent="blue"
            href="/investor/analytics"
          />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <AnalyticsBreakdownPanel
            title="Engagement summary"
            subtitle="Current snapshot from your records"
            rows={[
              { label: "Saved deals", value: String(analytics.savedDeals) },
              { label: "Expressed interests", value: String(analytics.expressedInterests) },
              { label: "Intro requests", value: String(analytics.introRequests) },
              { label: "Message threads", value: String(analytics.messageThreadCount) },
              { label: "Meetings scheduled", value: String(analytics.meetingsScheduled) },
              { label: "Avg match score", value: analytics.averageMatchScore != null ? `${analytics.averageMatchScore}%` : "—" },
            ]}
          />
          <WorkspacePanel title="Portfolio / pending interest" subtitle="From your interest records">
            <p className="text-sm text-slate-700">
              <span className="font-medium text-slate-900">{analytics.portfolioInterestCount}</span> companies with
              interest, pledge, or indicative amounts tracked.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Pledged: {analytics.pledgeTotalDisplay} · Indicative: {analytics.indicativeTotalDisplay}
            </p>
            <Link href="/investor/portfolio" className="mt-4 inline-block text-sm font-semibold text-indigo-700">
              View portfolio
            </Link>
          </WorkspacePanel>
        </section>

        <p className="mt-6 text-sm text-slate-600">
          <Link href="/investor/opportunities" className="font-semibold text-indigo-700">
            Browse recommended opportunities
          </Link>
        </p>
      </InvestorFeatureGate>
    </AppShell>
  );
}
