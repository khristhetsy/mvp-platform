import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { loadFounderAnalytics } from "@/lib/analytics/founder-analytics";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { requireRole } from "@/lib/supabase/auth";
import { AnalyticsCardsClient } from "@/components/founder/AnalyticsCardsClient";

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

            <section className="mt-6 grid gap-4 xl:grid-cols-2">
              {/* Outreach pipeline — horizontal bar chart */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white" style={{ boxShadow: "0 1px 3px rgb(12 35 64 / 0.05)" }}>
                <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                  <p className="text-sm font-semibold text-slate-900">Outreach pipeline</p>
                  <p className="mt-0.5 text-xs text-slate-500">By status · current snapshot</p>
                </div>
                <div className="space-y-3 p-5">
                  {(() => {
                    const entries = Object.entries(analytics.outreachByStatus);
                    const maxVal = Math.max(...entries.map(([, v]) => v), 1);
                    const total  = entries.reduce((s, [, v]) => s + v, 0);
                    return entries.length === 0 ? (
                      <p className="text-sm text-slate-400">No outreach data yet.</p>
                    ) : (
                      <>
                        <div className="mb-4 flex items-center justify-between">
                          <span className="text-xs text-slate-500">Total targets</span>
                          <span className="text-sm font-bold text-slate-900">{total}</span>
                        </div>
                        {entries.map(([status, count]) => (
                          <div key={status}>
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-xs capitalize text-slate-600">{status.replace(/_/g, " ")}</span>
                              <span className="text-xs font-semibold text-slate-800">{count}</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full" style={{ width: `${(count / maxVal) * 100}%`, background: "#534AB7" }} />
                            </div>
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Social drafts — horizontal bars */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white" style={{ boxShadow: "0 1px 3px rgb(12 35 64 / 0.05)" }}>
                <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                  <p className="text-sm font-semibold text-slate-900">Social drafts</p>
                  <p className="mt-0.5 text-xs text-slate-500">Generated in CapitalOS</p>
                </div>
                <div className="space-y-3 p-5">
                  {(() => {
                    const rows = [
                      { label: "Total drafts",       value: analytics.socialDraftGenerated, color: "#534AB7" },
                      { label: "Copied",              value: analytics.socialDraftCopied,    color: "#3B6D11" },
                      { label: "Flagged compliance",  value: analytics.socialDraftFlagged,   color: "#A32D2D" },
                    ];
                    const maxVal = Math.max(...rows.map((r) => r.value), 1);
                    return rows.map((row) => (
                      <div key={row.label}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs text-slate-600">{row.label}</span>
                          <span className="text-xs font-semibold text-slate-800">{row.value}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full" style={{ width: `${(row.value / maxVal) * 100}%`, background: row.color }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Platform investor activity — horizontal bars */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white" style={{ boxShadow: "0 1px 3px rgb(12 35 64 / 0.05)" }}>
                <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                  <p className="text-sm font-semibold text-slate-900">Platform investor activity</p>
                  <p className="mt-0.5 text-xs text-slate-500">Inbound from registered investors</p>
                </div>
                <div className="space-y-3 p-5">
                  {(() => {
                    const rows = [
                      { label: "Expressed interest", value: analytics.investorInterestCount,  color: "#534AB7" },
                      { label: "Intro requests",      value: analytics.introRequestCount,      color: "#3B6D11" },
                      { label: "Saved deals",         value: analytics.savedByInvestorsCount,  color: "#0369a1" },
                    ];
                    const maxVal = Math.max(...rows.map((r) => r.value), 1);
                    return rows.map((row) => (
                      <div key={row.label}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs text-slate-600">{row.label}</span>
                          <span className="text-xs font-semibold text-slate-800">{row.value}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full" style={{ width: `${(row.value / maxVal) * 100}%`, background: row.color }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Readiness score history — bar chart */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white" style={{ boxShadow: "0 1px 3px rgb(12 35 64 / 0.05)" }}>
                <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                  <p className="text-sm font-semibold text-slate-900">Readiness score history</p>
                  <p className="mt-0.5 text-xs text-slate-500">Report snapshots over time</p>
                </div>
                <div className="p-5">
                  {analytics.readinessSnapshots.length === 0 ? (
                    <p className="text-sm text-slate-400">No diligence reports yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {analytics.readinessSnapshots.map((row) => (
                        <div key={row.createdAt}>
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-xs text-slate-500">
                              {new Date(row.createdAt).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}
                            </span>
                            <span className="text-xs font-bold text-slate-900">{row.score ?? "—"}</span>
                          </div>
                          {row.score != null && (
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full" style={{ width: `${row.score}%`, background: row.score >= 80 ? "#3B6D11" : row.score >= 50 ? "#534AB7" : "#854F0B" }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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
