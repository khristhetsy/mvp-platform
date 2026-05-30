import Link from "next/link";
import { AnalyticsBreakdownPanel } from "@/components/AnalyticsBreakdownPanel";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { loadAdminAnalytics } from "@/lib/analytics/admin-analytics";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const analytics = await loadAdminAnalytics();

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Analytics</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Platform-wide command center using live Supabase data. Aggregate counts only — no external analytics
          providers.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Founders" value={String(analytics.totalFounders)} detail="Registered founder profiles" accent="indigo" />
        <MetricCard label="Investors" value={String(analytics.totalInvestors)} detail="Registered investor profiles" accent="violet" />
        <MetricCard
          label="Companies"
          value={String(analytics.companiesOnboarded)}
          detail={`${analytics.pendingReviews} pending review · ${analytics.publishedDeals} published`}
          accent="blue"
        />
        <MetricCard
          label="Notifications"
          value={String(analytics.notificationsTotal)}
          detail={`${analytics.upgradeRequestsPending} pending upgrade requests`}
          accent="slate"
        />
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Onboarding avg"
          value={`${analytics.onboardingAveragePercent}%`}
          detail="Across companies with progress recorded"
          accent="indigo"
        />
        <MetricCard
          label="Readiness avg"
          value={analytics.readinessAverageScore != null ? String(analytics.readinessAverageScore) : "—"}
          detail="Across diligence reports"
          accent="violet"
        />
        <MetricCard
          label="Message threads"
          value={String(analytics.messageThreadCount)}
          detail={`${analytics.meetingsScheduled} scheduled meetings`}
          accent="blue"
        />
        <MetricCard
          label="Remediation tasks"
          value={String(analytics.remediation.total)}
          detail={`${analytics.remediation.active} active · ${analytics.remediation.completed} completed`}
          accent="slate"
        />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <AnalyticsBreakdownPanel
          title="Founder outreach activity"
          subtitle="Aggregate — no private contact content"
          rows={[
            { label: "Private contacts", value: String(analytics.outreach.privateContactCount) },
            { label: "Outreach targets", value: String(analytics.outreach.outreachTargetCount) },
            { label: "Draft campaigns", value: String(analytics.outreach.draftCampaignCount) },
            { label: "Active/queued campaigns", value: String(analytics.outreach.activeCampaignCount) },
            { label: "Queued messages", value: String(analytics.outreach.queuedMessageCount) },
            { label: "Social drafts", value: String(analytics.outreach.socialDraftCount) },
            { label: "Flagged social drafts", value: String(analytics.outreach.socialDraftFlaggedCount) },
            { label: "Copied social drafts", value: String(analytics.outreach.socialDraftCopiedCount) },
          ]}
        />
        <AnalyticsBreakdownPanel
          title="Matching & engagement"
          subtitle="Current platform snapshot"
          rows={[
            { label: "Approved investors", value: String(analytics.approvedInvestors) },
            { label: "Platform outreach targets", value: String(analytics.platformOutreachTargets) },
            { label: "Learning engagement rows", value: String(analytics.learningEngagementRows) },
          ]}
        />
        <WorkspacePanel title="Subscription plan distribution" subtitle="All subscription records">
          <div className="space-y-2">
            {analytics.planDistribution.length === 0 ? (
              <p className="text-sm text-slate-500">No subscriptions recorded.</p>
            ) : (
              analytics.planDistribution.map((row) => (
                <div key={row.plan} className="flex justify-between text-sm">
                  <span className="text-slate-600">{row.plan}</span>
                  <span className="font-medium text-slate-900">{row.count}</span>
                </div>
              ))
            )}
          </div>
        </WorkspacePanel>
        <WorkspacePanel title="Remediation volume" subtitle="All companies">
          <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <p>Open: {analytics.remediation.open}</p>
            <p>In progress: {analytics.remediation.inProgress}</p>
            <p>Completed: {analytics.remediation.completed}</p>
            <p>Dismissed: {analytics.remediation.dismissed}</p>
          </div>
        </WorkspacePanel>
      </section>

      <p className="mt-6 text-sm text-slate-600">
        <Link href="/admin/dashboard" className="font-semibold text-indigo-700">
          Open admin dashboard
        </Link>{" "}
        for company review workflows.
      </p>
    </AppShell>
  );
}
