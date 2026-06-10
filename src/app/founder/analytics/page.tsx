import Link from "next/link";
import { AnalyticsBreakdownPanel } from "@/components/AnalyticsBreakdownPanel";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { MetricCard } from "@/components/MetricCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { loadFounderAnalytics } from "@/lib/analytics/founder-analytics";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

function formatStatusCounts(counts: Record<string, number>) {
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return "None yet";
  }
  return entries.map(([status, count]) => `${status}: ${count}`).join(" · ");
}

export default async function FounderAnalyticsPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);
  const analytics = await loadFounderAnalytics(profile);

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="analytics">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Founder Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Analytics</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Command center snapshot from your company profile, readiness, outreach, and investor engagement. Current
            values only — no external analytics tracking.
          </p>
        </div>

        {!analytics ? (
          <WorkspacePanel title="Company required" subtitle="Complete setup to view analytics">
            <p className="text-sm text-slate-600">
              Link a company profile to see onboarding, readiness, and outreach metrics.
            </p>
            <Link href="/founder/onboarding" className="mt-3 inline-block text-sm font-semibold text-indigo-700">
              Continue onboarding
            </Link>
          </WorkspacePanel>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Onboarding progress"
                value={`${analytics.onboardingPercent}%`}
                detail={
                  analytics.onboardingCompletedAt
                    ? `Completed ${new Date(analytics.onboardingCompletedAt).toLocaleDateString("en-US")}`
                    : "Current snapshot"
                }
                accent="indigo"
                href="/founder/onboarding"
              />
              <MetricCard
                label="Readiness score"
                value={analytics.readinessScore != null ? String(analytics.readinessScore) : "—"}
                detail="Latest diligence report"
                accent="violet"
                href="/founder/readiness"
              />
              <MetricCard
                label="Private contacts"
                value={String(analytics.privateContactCount)}
                detail="Founder CRM contacts"
                accent="blue"
                href="/founder/investors"
              />
              <MetricCard
                label="Investor pledges"
                value={analytics.pledgeTotalDisplay}
                detail={`${analytics.pledgeInvestorCount} investors · platform activity`}
                accent="slate"
                href="/founder/investors"
              />
            </section>

            <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Remediation active"
                value={String(analytics.remediation.active)}
                detail={`${analytics.remediation.completed} completed · ${analytics.remediation.open} open`}
                accent="slate"
                href="/founder/readiness"
              />
              <MetricCard
                label="Learning progress"
                value={`${analytics.learningPercent}%`}
                detail={`${analytics.learningModulesCompleted}/${analytics.learningModulesPublished} modules completed`}
                accent="indigo"
                href="/founder/learning"
              />
              <MetricCard
                label="Message threads"
                value={String(analytics.messageThreadCount)}
                detail={`${analytics.meetingsScheduled} meetings scheduled`}
                accent="blue"
                href="/founder/messages"
              />
              <MetricCard
                label="Queued outreach"
                value={String(analytics.queuedMessageCount)}
                detail={`${analytics.campaignDraftCount} draft · ${analytics.campaignQueuedCount} queued campaigns`}
                accent="violet"
                href="/founder/capital-raise"
              />
            </section>

            <section className="mt-8 grid gap-6 xl:grid-cols-2">
              <AnalyticsBreakdownPanel
                title="Outreach pipeline"
                subtitle="By status (current snapshot)"
                rows={[
                  { label: "Total targets", value: String(Object.values(analytics.outreachByStatus).reduce((a, b) => a + b, 0)) },
                  ...Object.entries(analytics.outreachByStatus).map(([status, count]) => ({
                    label: status,
                    value: String(count),
                  })),
                ]}
              />
              <AnalyticsBreakdownPanel
                title="Social drafts"
                subtitle="Generated in CapitalOS"
                rows={[
                  { label: "Total drafts", value: String(analytics.socialDraftGenerated) },
                  { label: "Copied", value: String(analytics.socialDraftCopied) },
                  { label: "Flagged compliance", value: String(analytics.socialDraftFlagged) },
                ]}
              />
              <AnalyticsBreakdownPanel
                title="Platform investor activity"
                subtitle="Inbound from registered investors"
                rows={[
                  { label: "Expressed interest", value: String(analytics.investorInterestCount) },
                  { label: "Intro requests", value: String(analytics.introRequestCount) },
                  { label: "Saved deals", value: String(analytics.savedByInvestorsCount) },
                ]}
              />
              <WorkspacePanel title="Readiness score history" subtitle="Recent report snapshots (not a live trend chart)">
                {analytics.readinessSnapshots.length === 0 ? (
                  <p className="text-sm text-slate-500">No diligence reports yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm text-slate-700">
                    {analytics.readinessSnapshots.map((row) => (
                      <li key={row.createdAt} className="flex justify-between gap-4">
                        <span>{new Date(row.createdAt).toLocaleDateString("en-US", { timeZone: "UTC" })}</span>
                        <span className="font-medium text-slate-900">{row.score ?? "—"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </WorkspacePanel>
            </section>

            <p className="mt-6 text-xs text-slate-500">
              Outreach pipeline summary: {formatStatusCounts(analytics.outreachByStatus)}.{" "}
              <Link href="/founder/investors" className="font-semibold text-indigo-700">
                Manage investors
              </Link>
            </p>
          </>
        )}
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
