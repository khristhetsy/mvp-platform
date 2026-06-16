import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { loadFounderAnalytics } from "@/lib/analytics/founder-analytics";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { requireRole } from "@/lib/supabase/auth";
import { AnalyticsCardsClient } from "@/components/founder/AnalyticsCardsClient";
import { AnalyticsChartPanelsClient } from "@/components/founder/AnalyticsChartPanelsClient";

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
        <PageHeader
          eyebrow="Founder workspace"
          title="Analytics"
          description="Overview of your readiness, outreach, funding, and learning progress. Current snapshot — no external tracking."
        />

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
            <AnalyticsCardsClient analytics={analytics} />

            <AnalyticsChartPanelsClient analytics={analytics} />

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
