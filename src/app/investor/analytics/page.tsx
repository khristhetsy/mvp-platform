import Link from "next/link";
import { AnalyticsBreakdownPanel } from "@/components/AnalyticsBreakdownPanel";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("appPages");
  const [analytics] = await Promise.all([
    loadInvestorAnalytics(investorId, 30),
  ]);

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle={t("investor_account")}
    >
      <PageHeader
        eyebrow={t("investor_workspace_2")}
        title={t("analytics")}
        description={t("your_engagement_command_center_saved_deals_int")}
      />

      <InvestorFeatureGate>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label={t("saved_deals")}
            value={String(analytics.savedDeals)}
            detail="Companies on your watchlist"
            accent="indigo"
            href="/investor/portfolio"
            // No ceiling on a watchlist, so the ring is a presence indicator, not a proportion.
            ring={{ percent: null, center: String(analytics.savedDeals), pending: analytics.savedDeals === 0, color: analytics.savedDeals > 0 ? "#4F46E5" : undefined }}
            flag={analytics.savedDeals === 0 ? { text: "Browse the marketplace to start a watchlist.", tone: "warn" } : null}
          />
          <MetricCard
            label={t("expressed_interests")}
            value={String(analytics.expressedInterests)}
            detail="Interest records across listings"
            accent="violet"
            href="/investor/portfolio"
            unit={analytics.savedDeals > 0 ? `of ${analytics.savedDeals} saved` : undefined}
            ring={{
              percent: analytics.savedDeals > 0 ? Math.round((analytics.expressedInterests / analytics.savedDeals) * 100) : null,
              center: String(analytics.expressedInterests),
              sublabel: analytics.savedDeals > 0 ? `of ${analytics.savedDeals}` : undefined,
              pending: analytics.savedDeals === 0,
              color: "#7C3AED",
            }}
          />
          <MetricCard
            label={t("intro_requests")}
            value={String(analytics.introRequests)}
            detail="Warm intro and follow-up requests"
            accent="blue"
            href="/investor/messages"
            ring={{ percent: null, center: String(analytics.introRequests), pending: analytics.introRequests === 0, color: analytics.introRequests > 0 ? "#2563EB" : undefined }}
          />
          <MetricCard
            label={t("recommended_deals")}
            value={String(analytics.recommendedOpportunities)}
            detail={
              analytics.averageMatchScore != null
                ? `${analytics.averageMatchScore}% average match score`
                : "Match scores from marketplace listings"
            }
            accent="indigo"
            href="/investor/opportunities"
            unit={analytics.averageMatchScore != null ? `${analytics.averageMatchScore}% avg match` : undefined}
            ring={{
              percent: analytics.averageMatchScore,
              center: String(analytics.recommendedOpportunities),
              pending: analytics.recommendedOpportunities === 0,
            }}
            flag={
              analytics.recommendedOpportunities === 0
                ? { text: "Add a sector and cheque size to your profile to get matches.", tone: "warn" }
                : null
            }
          />
          <MetricCard
            label={t("message_threads")}
            value={String(analytics.messageThreadCount)}
            detail={`${analytics.meetingsScheduled} meetings scheduled`}
            accent="slate"
            href="/investor/messages"
            ring={{ percent: null, center: String(analytics.messageThreadCount), pending: analytics.messageThreadCount === 0 }}
            flag={analytics.meetingsScheduled > 0 ? { text: `${analytics.meetingsScheduled} scheduled.`, tone: "good" } : null}
          />
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label={t("pledged_total")}
            value={analytics.pledgeTotalDisplay}
            detail={`${analytics.indicativeTotalDisplay} indicative interest`}
            accent="slate"
            href="/investor/portfolio"
          />
          <MetricCard
            label={t("pending_indicative")}
            value={String(analytics.pendingInterestCount)}
            detail={`${analytics.portfolioInterestCount} portfolio interest rows`}
            accent="violet"
            href="/investor/portfolio"
          />
          <MetricCard
            label={t("recent_crm_activity")}
            value={String(analytics.recentActivityCount)}
            detail="Events in your timeline"
            accent="blue"
          />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <AnalyticsBreakdownPanel
            title={t("engagement_summary")}
            subtitle={t("current_snapshot_from_your_records")}
            rows={[
              { label: "Saved deals", value: String(analytics.savedDeals) },
              { label: "Expressed interests", value: String(analytics.expressedInterests) },
              { label: "Intro requests", value: String(analytics.introRequests) },
              { label: "Message threads", value: String(analytics.messageThreadCount) },
              { label: "Meetings scheduled", value: String(analytics.meetingsScheduled) },
              { label: "Avg match score", value: analytics.averageMatchScore != null ? `${analytics.averageMatchScore}%` : "—" },
            ]}
          />
          <WorkspacePanel title={t("portfolio_pending_interest")} subtitle={t("from_your_interest_records")}>
            <p className="text-sm text-slate-700">
              <span className="font-medium text-slate-900">{analytics.portfolioInterestCount}</span> companies with
              interest or indicative amounts tracked.
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
