import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { loadFounderAnalytics } from "@/lib/analytics/founder-analytics";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

// ─── Inline stat icons ────────────────────────────────────────────────────────

function IcoCheck({ c = "#3B6D11" }: { c?: string }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
}
function IcoShield({ c = "#534AB7" }: { c?: string }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}
function IcoUsers({ c = "#0369a1" }: { c?: string }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function IcoDollar({ c = "#854F0B" }: { c?: string }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
}
function IcoWrench({ c = "#A32D2D" }: { c?: string }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>;
}
function IcoBook({ c = "#534AB7" }: { c?: string }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>;
}
function IcoMail({ c = "#0369a1" }: { c?: string }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
}
function IcoSend({ c = "#3B6D11" }: { c?: string }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
}

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
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Onboarding progress", value: `${analytics.onboardingPercent}%`, detail: analytics.onboardingCompletedAt ? `Completed ${new Date(analytics.onboardingCompletedAt).toLocaleDateString("en-US")}` : "Current snapshot", href: "/founder/onboarding", linkText: "Go to onboarding →", icon: <IcoCheck />, iconBg: "#E1F5EE", valColor: "#3B6D11" },
                { label: "Readiness score", value: analytics.readinessScore != null ? `${analytics.readinessScore}` : "—", detail: "Latest diligence report", href: "/founder/readiness", linkText: "Go to readiness →", icon: <IcoShield />, iconBg: "#EEEDFB", valColor: "#3C3489" },
                { label: "Private contacts", value: String(analytics.privateContactCount), detail: "Founder CRM contacts", href: "/founder/investors", linkText: "View contacts →", icon: <IcoUsers />, iconBg: "#E0F2FE", valColor: "#0369a1" },
                { label: "Investor pledges", value: analytics.pledgeTotalDisplay, detail: `${analytics.pledgeInvestorCount} investors · platform activity`, href: "/founder/investors", linkText: "See pledges →", icon: <IcoDollar />, iconBg: "#FEF3CD", valColor: "#854F0B" },
              ].map((card) => (
                <Link
                  key={card.label}
                  href={card.href}
                  className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-sm"
                  style={{ boxShadow: "0 1px 3px rgb(12 35 64 / 0.05)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: card.iconBg }}>
                      {card.icon}
                    </div>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: card.valColor }}>{card.value}</p>
                  </div>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{card.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{card.detail}</p>
                  <p className="mt-3 text-xs font-semibold text-indigo-700">{card.linkText}</p>
                </Link>
              ))}
            </section>

            <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Remediation active", value: String(analytics.remediation.active), detail: `${analytics.remediation.completed} completed · ${analytics.remediation.open} open`, href: "/founder/readiness", linkText: "View tasks →", icon: <IcoWrench />, iconBg: "#FCEBEB", valColor: analytics.remediation.active > 0 ? "#A32D2D" : "#0c2340" },
                { label: "Learning progress", value: `${analytics.learningPercent}%`, detail: `${analytics.learningModulesCompleted}/${analytics.learningModulesPublished} modules`, href: "/founder/learning", linkText: "Continue →", icon: <IcoBook />, iconBg: "#EEEDFB", valColor: "#3C3489" },
                { label: "Message threads", value: String(analytics.messageThreadCount), detail: `${analytics.meetingsScheduled} meetings scheduled`, href: "/founder/messages", linkText: "Open inbox →", icon: <IcoMail />, iconBg: "#E0F2FE", valColor: "#0369a1" },
                { label: "Queued outreach", value: String(analytics.queuedMessageCount), detail: `${analytics.campaignDraftCount} draft · ${analytics.campaignQueuedCount} queued`, href: "/founder/capital-raise", linkText: "View queue →", icon: <IcoSend />, iconBg: "#E1F5EE", valColor: "#3B6D11" },
              ].map((card) => (
                <Link
                  key={card.label}
                  href={card.href}
                  className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-sm"
                  style={{ boxShadow: "0 1px 3px rgb(12 35 64 / 0.05)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: card.iconBg }}>
                      {card.icon}
                    </div>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: card.valColor }}>{card.value}</p>
                  </div>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{card.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{card.detail}</p>
                  <p className="mt-3 text-xs font-semibold text-indigo-700">{card.linkText}</p>
                </Link>
              ))}
            </section>

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
