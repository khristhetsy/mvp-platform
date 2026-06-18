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
import { FounderEmptyState } from "@/components/founder/FounderEmptyState";

function formatStatusCounts(counts: Record<string, number>) {
  const entries = Object.entries(counts);
  if (entries.length === 0) return "None yet";
  return entries.map(([status, count]) => `${status}: ${count}`).join(" · ");
}

export default async function FounderAnalyticsPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);
  const analytics = await loadFounderAnalytics(profile);

  // Determine if the founder has generated any meaningful activity yet
  const hasActivity = analytics
    ? analytics.privateContactCount > 0 ||
      (analytics.readinessScore !== null && analytics.readinessScore > 0) ||
      analytics.investorInterestCount > 0
    : false;

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
          <WorkspacePanel title="No company linked" subtitle="Complete setup to view analytics">
            <FounderEmptyState
              icon="📊"
              title="Analytics start after onboarding"
              description="Complete your company profile and add at least one document to unlock readiness, outreach, and funding analytics."
              steps={[
                { icon: "🏢", label: "Complete your company profile in Settings" },
                { icon: "📄", label: "Upload your pitch deck or financial model" },
                { icon: "🎯", label: "Add investors to your CRM and track outreach" },
                { icon: "📊", label: "Analytics populate automatically from your activity" },
              ]}
              action={{ label: "Continue onboarding", href: "/founder/onboarding" }}
              secondaryAction={{ label: "Upload documents", href: "/founder/documents" }}
            />
          </WorkspacePanel>
        ) : !hasActivity ? (
          <>
            {/* Zero-data banner */}
            <div style={{
              background: "linear-gradient(135deg, #EEEDFE 0%, #f5f3ff 100%)",
              border: "1px solid #c4b5fd",
              borderRadius: 14,
              padding: "20px 24px",
              marginBottom: 24,
              display: "flex",
              alignItems: "flex-start",
              gap: 16,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: "#534AB7",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, flexShrink: 0,
              }}>
                💡
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#3C3489", margin: "0 0 4px" }}>
                  Your analytics are ready — now generate some activity
                </p>
                <p style={{ fontSize: 13, color: "#534AB7", margin: "0 0 12px", lineHeight: 1.6 }}>
                  Charts and metrics populate as you upload documents, add investors, and build your readiness score. Here&apos;s what to do first:
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <a href="/founder/documents" style={{
                    fontSize: 12, fontWeight: 600, color: "white",
                    background: "#534AB7", borderRadius: 8, padding: "6px 14px",
                    textDecoration: "none",
                  }}>
                    Upload documents
                  </a>
                  <a href="/founder/investors/outreach" style={{
                    fontSize: 12, fontWeight: 600, color: "#534AB7",
                    background: "white", border: "1px solid #c4b5fd", borderRadius: 8,
                    padding: "6px 14px", textDecoration: "none",
                  }}>
                    Add investors to CRM
                  </a>
                  <a href="/founder/readiness" style={{
                    fontSize: 12, fontWeight: 600, color: "#534AB7",
                    background: "white", border: "1px solid #c4b5fd", borderRadius: 8,
                    padding: "6px 14px", textDecoration: "none",
                  }}>
                    Check readiness score
                  </a>
                </div>
              </div>
            </div>

            {/* Show the charts anyway — they'll show zeros but at least the UI is legible */}
            <AnalyticsCardsClient analytics={analytics} />
            <AnalyticsChartPanelsClient analytics={analytics} />
          </>
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
