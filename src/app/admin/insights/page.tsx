import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminOperationalViewToolbar } from "@/components/admin/AdminOperationalViewToolbar";
import { requireRole } from "@/lib/supabase/auth";
import { loadPlatformInsights } from "@/lib/predictive-intelligence/signals";
import { clampTrendWindowDays } from "@/lib/analytics/display";
import { formatRiskScore, riskSeverityBadgeStatus } from "@/lib/predictive-intelligence/display";

export const dynamic = "force-dynamic";

export default async function AdminInsightsPage({
  searchParams,
}: Readonly<{ searchParams?: Record<string, string | string[] | undefined> }>) {
  const profile = await requireRole(["admin", "analyst"]);
  const windowDays = clampTrendWindowDays(
    typeof searchParams?.window === "string" ? searchParams.window : null,
  );
  const view = typeof searchParams?.view === "string" ? searchParams.view : null;
  const insights = await loadPlatformInsights({ window: String(windowDays) });

  const topSignals = insights.signals.slice(0, 10);
  const topRecs = insights.recommendations.slice(0, 8);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Predictive insights</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Rules-based risk signals from operational data. Deterministic scoring only — no black-box AI, no workflow state
          changes, and no investment recommendations.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500">Window:</span>
        {[7, 30, 90].map((d) => (
          <Link
            key={d}
            href={`/admin/insights?window=${d}`}
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
          href={`/api/admin/insights/export?format=json&window=${windowDays}`}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
        >
          JSON
        </a>
        <a
          href={`/api/admin/insights/export?format=csv&window=${windowDays}`}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
        >
          CSV
        </a>
      </div>

      <div className="mt-4">
        <AdminOperationalViewToolbar moduleId="admin-insights" />
      </div>

      {view === "table" ? (
        <section className="mt-4 grid gap-6 xl:grid-cols-2">
          <WorkspacePanel title="Top risk signals (table)" subtitle="Platform-level · aggregate only">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Severity</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topSignals.map((s) => (
                    <tr key={s.id}>
                      <td className="px-3 py-2">{s.severity}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{s.title}</td>
                      <td className="px-3 py-2 text-slate-700">{formatRiskScore(s.score)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </WorkspacePanel>
          <WorkspacePanel title="Recommended actions (table)" subtitle="No actions auto-created">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Priority</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topRecs.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2">{r.priority}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{r.title}</td>
                      <td className="px-3 py-2">
                        <a href={r.href} className="font-semibold text-indigo-700 hover:underline">Open</a>
                      </td>
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
          <WorkspacePanel title="Risk distribution" subtitle="Counts by severity">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["critical", insights.riskOverview.critical],
                ["high", insights.riskOverview.high],
                ["medium", insights.riskOverview.medium],
                ["low", insights.riskOverview.low],
              ].map(([label, count]) => (
                <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{String(label)}</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950">{String(count)}</p>
                </div>
              ))}
            </div>
          </WorkspacePanel>
          <WorkspacePanel title="Top signal domains" subtitle="Grouped by signal type">
            <div className="grid gap-2 text-sm text-slate-700">
              {Array.from(
                insights.signals.reduce((acc, s) => {
                  acc.set(s.type, (acc.get(s.type) ?? 0) + 1);
                  return acc;
                }, new Map<string, number>()),
              )
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <span className="font-medium text-slate-900">{type}</span>
                    <span className="text-slate-600">{count}</span>
                  </div>
                ))}
            </div>
          </WorkspacePanel>
        </section>
      ) : null}

      {view === "table" || view === "segments" ? null : (
      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Critical risks" value={String(insights.riskOverview.critical)} detail="Score ≥ 85" accent="indigo" />
        <MetricCard label="High risks" value={String(insights.riskOverview.high)} detail="Score 65–84" accent="violet" />
        <MetricCard label="Medium risks" value={String(insights.riskOverview.medium)} detail="Score 40–64" accent="blue" />
        <MetricCard label="Avg risk score" value={String(insights.riskOverview.scoreAvg)} detail="Across platform signals" accent="slate" />
      </section>
      )}

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title="Risk overview" subtitle="Platform-level signals (aggregate only)">
          {topSignals.length === 0 ? (
            <p className="text-sm text-slate-600">No signals available.</p>
          ) : (
            <div className="space-y-3">
              {topSignals.map((s) => (
                <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge label={s.severity} status={riskSeverityBadgeStatus(s.severity)} />
                      <p className="font-semibold text-slate-900">{s.title}</p>
                    </div>
                    <p className="text-xs font-semibold text-slate-700">{formatRiskScore(s.score)}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{s.explanation}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="rounded bg-slate-100 px-2 py-0.5">confidence: {s.confidence}</span>
                    <a href={s.href} className="font-semibold text-indigo-700 hover:underline">
                      Open module
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Entity-scoped risks appear inside Company and SPV workspaces (lightweight panels).
          </p>
        </WorkspacePanel>

        <WorkspacePanel title="Recommended actions" subtitle="No actions are auto-created in Phase 1">
          {topRecs.length === 0 ? (
            <p className="text-sm text-slate-600">No recommendations generated.</p>
          ) : (
            <div className="space-y-3">
              {topRecs.map((r) => (
                <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Priority: {r.priority} · Source: {r.sourceSignalType}
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">{r.title}</p>
                  <p className="mt-1 text-xs text-slate-600">{r.recommendedAction}</p>
                  <a href={r.href} className="mt-2 inline-block text-xs font-semibold text-indigo-700 hover:underline">
                    Open
                  </a>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Safety: recommendations are operational priorities only — no approvals/rejections and no investment guidance.
          </p>
        </WorkspacePanel>
      </section>

      <p className="mt-6 text-sm text-slate-600">
        Related:{" "}
        <Link href="/admin/analytics" className="font-semibold text-indigo-700 hover:underline">
          Analytics
        </Link>{" "}
        ·{" "}
        <Link href="/admin/queues" className="font-semibold text-indigo-700 hover:underline">
          Queues
        </Link>{" "}
        ·{" "}
        <Link href="/admin/actions" className="font-semibold text-indigo-700 hover:underline">
          Action Center
        </Link>
      </p>
    </AppShell>
  );
}

