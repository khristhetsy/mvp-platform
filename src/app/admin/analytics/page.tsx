import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { AdminConversionFunnel } from "@/components/admin/AdminConversionFunnel";
import { AdminPlatformInsights } from "@/components/admin/AdminPlatformInsights";
import { AdminOperationalViewToolbar } from "@/components/admin/AdminOperationalViewToolbar";
import { clampTrendWindowDays, formatCurrencyAmount, formatPct } from "@/lib/analytics/display";
import { loadPlatformAnalyticsSnapshot } from "@/lib/analytics/metrics";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

function Sparkline({ values }: Readonly<{ values: number[] }>) {
  const max = Math.max(1, ...values);
  const w = 120;
  const h = 28;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = h - (v / max) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        points={points}
        className="text-indigo-600"
      />
    </svg>
  );
}

export default async function AdminAnalyticsPage({
  searchParams,
}: Readonly<{ searchParams?: Record<string, string | string[] | undefined> }>) {
  const profile = await requireRole(["admin", "analyst"]);
  const windowDays = clampTrendWindowDays(
    typeof searchParams?.window === "string" ? searchParams.window : null,
  );
  const view = typeof searchParams?.view === "string" ? searchParams.view : null;
  const supabase = createServiceRoleClient();
  const [analytics, funnelRes] = await Promise.all([
    loadPlatformAnalyticsSnapshot(supabase, windowDays),
    supabase
      .from("intro_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "facilitated"),
  ]);
  const facilitatedIntros = funnelRes.count ?? 0;

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
          profileEmail={profile.email ?? undefined}
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Analytics</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Platform-wide command center using live Supabase data. Aggregate counts only — no external analytics
          providers. Windowed trends: 7/30/90 days.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500">Trend window:</span>
        {[7, 30, 90].map((d) => (
          <Link
            key={d}
            href={`/admin/analytics?window=${d}`}
            className={`rounded-full border px-3 py-1 font-semibold ${
              d === windowDays
                ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {d}d
          </Link>
        ))}
        <span className="ml-2 text-slate-500">Export:</span>
        <a
          href={`/api/admin/analytics/export?format=json&window=${windowDays}`}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
        >
          JSON
        </a>
        <a
          href={`/api/admin/analytics/export?format=csv&window=${windowDays}`}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
        >
          CSV
        </a>
      </div>

      <div className="mt-4">
        <AdminOperationalViewToolbar moduleId="admin-analytics" />
      </div>

      {view === "table" ? (
        <section className="mt-4">
          <WorkspacePanel title="Core metrics (table)" subtitle="Aggregate only">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm" aria-label="Core metrics">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th scope="col" className="px-3 py-2">Metric</th>
                    <th scope="col" className="px-3 py-2">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ["Total companies", analytics.metrics.totalCompanies],
                    ["Pending company reviews", analytics.metrics.pendingCompanyReviews],
                    ["Published companies", analytics.metrics.publishedCompanies],
                    ["Total investors", analytics.metrics.totalInvestors],
                    ["Approved investors", analytics.metrics.approvedInvestors],
                    ["Investor interests", analytics.metrics.expressedInterests],
                    ["Active SPVs", analytics.metrics.activeSpvs],
                    ["Overdue actions", analytics.metrics.overdueActions],
                    ["Open compliance", analytics.metrics.complianceOpen],
                    ["Critical compliance", analytics.metrics.complianceCriticalOpen],
                    ["Automation ok", analytics.metrics.automationRunsSucceeded],
                    ["Automation failed/partial", analytics.metrics.automationRunsFailedOrPartial],
                  ].map(([label, value]) => (
                    <tr key={String(label)}>
                      <td className="px-3 py-2 font-medium text-slate-900">{label as string}</td>
                      <td className="px-3 py-2 text-slate-700">{String(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </WorkspacePanel>
        </section>
      ) : null}

      {view === "segments" ? (
        <section className="mt-4 grid gap-6 xl:grid-cols-2">
          <WorkspacePanel title="Bottlenecks (segments)" subtitle="Counts only · drill down via links below">
            <div className="grid gap-2 text-sm text-slate-700">
              {analytics.bottlenecks.cards.map((card) => (
                <div key={card.key} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <span className="font-medium text-slate-900">{card.label}</span>
                  <span className="text-slate-600">{card.count}</span>
                </div>
              ))}
            </div>
          </WorkspacePanel>
          <WorkspacePanel title="Health reasons" subtitle="Deterministic scoring">
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {analytics.health.reasons.length ? analytics.health.reasons.map((r) => <li key={r}>{r}</li>) : <li>No critical backlogs detected</li>}
            </ul>
          </WorkspacePanel>
        </section>
      ) : null}

      {view === "table" || view === "segments" ? null : (
      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Companies"
          value={String(analytics.metrics.totalCompanies)}
          detail={`${analytics.metrics.pendingCompanyReviews} pending review · ${analytics.metrics.publishedCompanies} published`}
          accent="indigo"
          href="/admin/companies"
        />
        <MetricCard
          label="Investors"
          value={String(analytics.metrics.totalInvestors)}
          detail={`${analytics.metrics.approvedInvestors} approved · ${analytics.metrics.expressedInterests} interests`}
          accent="violet"
          href="/admin/investors"
        />
        <MetricCard
          label="Active SPVs"
          value={String(analytics.metrics.activeSpvs)}
          detail={`Avg readiness: ${formatPct(analytics.metrics.spvChecklistReadinessAvg)} checklist`}
          accent="blue"
          href="/admin/spvs"
        />
        <MetricCard
          label="Health"
          value={analytics.health.score}
          detail={analytics.health.reasons.slice(0, 2).join(" · ") || "No critical backlogs detected"}
          accent="slate"
          href="/admin/insights"
        />
      </section>
      )}

      {/* Conversion funnel */}
      <section className="mt-8">
        <WorkspacePanel
          title="Marketplace Conversion Funnel"
          subtitle="Platform-wide deal flow from company registration to facilitated intro"
        >
          <AdminConversionFunnel
            stages={[
              {
                label: "Total companies",
                count: analytics.metrics.totalCompanies,
                href: "/admin/companies",
                description: "All registered",
              },
              {
                label: "Published",
                count: analytics.metrics.publishedCompanies,
                href: "/admin/companies",
                description: "Live on marketplace",
              },
              {
                label: "Interests expressed",
                count: analytics.metrics.expressedInterests,
                href: "/admin/crm",
                description: "At least 1 investor interest",
              },
              {
                label: "Intro requests",
                count: analytics.metrics.introRequests,
                href: "/admin/crm/outreach",
                description: "Investor-requested intros",
              },
              {
                label: "Intros facilitated",
                count: facilitatedIntros,
                href: "/admin/crm/outreach",
                description: "Completed by admin",
              },
            ]}
          />
          <p className="mt-4 text-xs text-slate-500">
            Conv. column shows step-over-step conversion rate. Counts are cumulative totals, not windowed.
          </p>
        </WorkspacePanel>
      </section>

      {/* Admin platform insights */}
      <section className="mt-6">
        <AdminPlatformInsights />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title="Platform Overview" subtitle={`Aggregate metrics · last ${windowDays} days for windowed cards`}>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-slate-600">Indicative amount (aggregate)</p>
              <p className="mt-1 font-semibold text-slate-900">
                {formatCurrencyAmount(analytics.metrics.totalIndicativeAmount)}
              </p>
            </div>
            <div>
              <p className="text-slate-600">Actions</p>
              <p className="mt-1 font-semibold text-slate-900">
                {analytics.metrics.overdueActions} overdue · {analytics.metrics.completedActions} completed
              </p>
            </div>
            <div>
              <p className="text-slate-600">Compliance</p>
              <p className="mt-1 font-semibold text-slate-900">
                {analytics.metrics.complianceOpen} open · {analytics.metrics.complianceCriticalOpen} critical
              </p>
            </div>
            <div>
              <p className="text-slate-600">Automation</p>
              <p className="mt-1 font-semibold text-slate-900">
                {analytics.metrics.automationRunsSucceeded} ok · {analytics.metrics.automationRunsFailedOrPartial} failed/partial
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Privacy: aggregates only. No message bodies, documents, tokens, file paths, or legal notes.
          </p>
        </WorkspacePanel>

        <WorkspacePanel title="Capital Pipeline" subtitle="SPV readiness trends and bottlenecks">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p className="text-slate-700">
              Checklist avg: <span className="font-semibold">{formatPct(analytics.metrics.spvChecklistReadinessAvg)}</span>
            </p>
            <p className="text-slate-700">
              Packages avg: <span className="font-semibold">{formatPct(analytics.metrics.spvPackageReadinessAvg)}</span>
            </p>
            <p className="text-slate-700">
              Closing avg: <span className="font-semibold">{formatPct(analytics.metrics.spvClosingReadinessAvg)}</span>
            </p>
            <p className="text-slate-700">
              Active SPVs: <span className="font-semibold">{analytics.metrics.activeSpvs}</span>
            </p>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Drill-down:{" "}
            <Link href="/admin/spvs" className="font-semibold text-indigo-700 hover:underline">
              Open SPVs
            </Link>
            .
          </p>
        </WorkspacePanel>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title="Founder Readiness" subtitle="Aggregate indicators (no private docs or notes)">
          <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <p>
              Pending company reviews:{" "}
              <span className="font-semibold">{analytics.metrics.pendingCompanyReviews}</span>
            </p>
            <p>
              Low readiness companies:{" "}
              <span className="font-semibold">
                {analytics.bottlenecks.cards.find((c) => c.key === "companies_low_readiness")?.count ?? 0}
              </span>
            </p>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Drill-down:{" "}
            <Link href="/admin/companies" className="font-semibold text-indigo-700 hover:underline">
              Companies
            </Link>
          </p>
        </WorkspacePanel>

        <WorkspacePanel title="Investor Engagement" subtitle={`Last ${windowDays} days`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-700">
              <p>
                Interests: <span className="font-semibold">{analytics.metrics.expressedInterests}</span>
              </p>
              <p>
                Intro requests: <span className="font-semibold">{analytics.metrics.introRequests}</span>
              </p>
              <p>
                Saved deals: <span className="font-semibold">{analytics.metrics.savedDeals}</span>
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Drill-down:{" "}
                <Link href="/admin/crm" className="font-semibold text-indigo-700 hover:underline">
                  CRM activity
                </Link>
              </p>
            </div>
            <Sparkline
              values={analytics.trends.investorEngagement[0]?.points.map((p) => p.value) ?? []}
            />
          </div>
        </WorkspacePanel>

        <WorkspacePanel title="Workflow Automation Health" subtitle={`Last ${windowDays} days`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-700">
              <p>
                Succeeded: <span className="font-semibold">{analytics.metrics.automationRunsSucceeded}</span>
              </p>
              <p>
                Failed/partial:{" "}
                <span className="font-semibold">{analytics.metrics.automationRunsFailedOrPartial}</span>
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Drill-down:{" "}
                <Link href="/admin/automation" className="font-semibold text-indigo-700 hover:underline">
                  Automation console
                </Link>
              </p>
            </div>
            <Sparkline values={analytics.trends.automation[0]?.points.map((p) => p.value) ?? []} />
          </div>
        </WorkspacePanel>

        <WorkspacePanel title="Compliance Trends" subtitle={`Last ${windowDays} days`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-700">
              <p>
                Open: <span className="font-semibold">{analytics.metrics.complianceOpen}</span> · Critical:{" "}
                <span className="font-semibold">{analytics.metrics.complianceCriticalOpen}</span>
              </p>
              <p>
                Resolved in window: <span className="font-semibold">{analytics.metrics.complianceResolvedWindow}</span>
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Drill-down:{" "}
                <Link href="/admin/compliance" className="font-semibold text-indigo-700 hover:underline">
                  Compliance center
                </Link>
              </p>
            </div>
            <Sparkline values={analytics.trends.compliance[0]?.points.map((p) => p.value) ?? []} />
          </div>
        </WorkspacePanel>

        <WorkspacePanel title="Import/Export Activity" subtitle={`Last ${windowDays} days`}>
          <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <p>
              Imports processed: <span className="font-semibold">{analytics.metrics.importsProcessedWindow}</span>
            </p>
            <p>
              Imports failed: <span className="font-semibold">{analytics.metrics.importsFailedWindow}</span>
            </p>
            <p>
              Exports generated: <span className="font-semibold">{analytics.metrics.exportsGeneratedWindow}</span>
            </p>
            <p>
              Collaboration comments: <span className="font-semibold">{analytics.metrics.collaborationCommentsWindow}</span>
            </p>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Drill-down:{" "}
            <Link href="/admin/imports" className="font-semibold text-indigo-700 hover:underline">
              Import / Export
            </Link>
          </p>
        </WorkspacePanel>

        <WorkspacePanel title="Collaboration Activity" subtitle={`Last ${windowDays} days (metadata only)`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-700">
              <p>
                Comments: <span className="font-semibold">{analytics.metrics.collaborationCommentsWindow}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                No comment bodies are displayed in analytics (counts only).
              </p>
            </div>
            <Sparkline values={analytics.trends.collaboration[0]?.points.map((p) => p.value) ?? []} />
          </div>
        </WorkspacePanel>

        <WorkspacePanel title="SPV Bottlenecks" subtitle="Operational blockers (sample list)">
          {analytics.bottlenecks.cards.filter((c) => c.count > 0).length === 0 ? (
            <p className="text-sm text-slate-600">No bottlenecks detected in the current snapshot.</p>
          ) : (
            <div className="space-y-2">
              {analytics.bottlenecks.cards
                .filter((c) => c.count > 0)
                .slice(0, 6)
                .map((card) => (
                  <div key={card.key} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <a href={card.href} className="font-semibold text-indigo-700 hover:underline">
                        {card.label}
                      </a>
                      <p className="text-xs text-slate-500">{card.description}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">
                      {card.count}
                    </span>
                  </div>
                ))}
            </div>
          )}
          {analytics.bottlenecks.entities.length > 0 ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                Examples (sanitized)
              </p>
              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                {analytics.bottlenecks.entities.slice(0, 8).map((row) => (
                  <li key={`${row.entityType}:${row.entityId}`}>
                    •{" "}
                    <a href={row.href} className="font-semibold text-indigo-700 hover:underline">
                      {row.label}
                    </a>{" "}
                    — {row.reason} · {row.ageDays}d
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </WorkspacePanel>
      </section>

      <p className="mt-6 text-sm text-slate-600">
        <Link href="/admin/dashboard" className="font-semibold text-indigo-700">
          Open admin dashboard
        </Link>{" "}
        for company review workflows.{" "}
        <Link href="/admin/compliance" className="font-semibold text-indigo-700">
          Open compliance center
        </Link>
        .
      </p>
    </AppShell>
  );
}
