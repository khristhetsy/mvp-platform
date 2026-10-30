import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { WorkspaceSection } from "@/components/admin/company-workspace/WorkspaceSection";
import { DbHealthAlertRules } from "@/components/admin/db-health/DbHealthAlertRules";
import { DbHealthAskAi } from "@/components/admin/db-health/DbHealthAskAi";
import { DbHealthFixes } from "@/components/admin/db-health/DbHealthFixes";
import { requirePermissionPage } from "@/lib/api/permissions";
import { formatWhen } from "@/lib/cron/schedule";
import { listCronJobs } from "@/lib/cron/jobs";
import { findPatterns } from "@/lib/db-health/patterns";
import { loadDbHealth, type IncidentRow } from "@/lib/db-health/load";
import { buildTiles, fmtMs } from "@/lib/db-health/tiles";
import { VERDICT_LABEL, labelQuery, queryVerdict, type Verdict } from "@/lib/db-health/baseline";
import { CAUSE_LABEL, classifyCause, type IncidentCause } from "@/lib/db-health/evaluate";

export const dynamic = "force-dynamic";

const VERDICT_STYLE: Record<Verdict, string> = {
  above: "bg-red-100 text-red-800",
  normal: "bg-emerald-100 text-emerald-800",
  below: "bg-blue-100 text-blue-800",
};

function VerdictBadge({ verdict }: Readonly<{ verdict: Verdict }>) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${VERDICT_STYLE[verdict]}`}>{VERDICT_LABEL[verdict]}</span>;
}

function Bar({ label, sub, percent, value, tone }: Readonly<{ label: string; sub: string; percent: number; value: string; tone: "bad" | "ok" | "info" }>) {
  const fill = tone === "bad" ? "bg-red-500" : tone === "ok" ? "bg-slate-300" : "bg-indigo-500";
  return (
    <div className="flex items-start gap-3 py-2 text-sm">
      <div className="w-40 shrink-0"><p className="text-slate-800">{label}</p><p className="text-[11px] text-slate-500">{sub}</p></div>
      <div className="mt-1.5 h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${fill}`} style={{ width: `${Math.max(0, Math.min(100, percent))}%`, minWidth: percent > 0 ? 4 : 0 }} /></div>
      <p className="w-14 shrink-0 text-right font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function Should({ children }: Readonly<{ children: React.ReactNode }>) {
  return <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs leading-relaxed text-slate-700"><b className="text-slate-900">Should be:</b> {children}</p>;
}

function duration(startIso: string, endIso: string | null, now: number): string {
  const mins = Math.max(1, Math.round(((endIso ? new Date(endIso).getTime() : now) - new Date(startIso).getTime()) / 60_000));
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

function incidentNote(i: IncidentRow, now: number): string {
  const parts = [CAUSE_LABEL[i.cause as IncidentCause] ?? i.cause];
  if (i.peak_response_ms) parts.push(`peak ${fmtMs(i.peak_response_ms)}`);
  if (i.peak_query_s) parts.push(`longest query ${Math.round(i.peak_query_s)} s`);
  if (i.cron_timeouts) parts.push(`${i.cron_timeouts} job timeout${i.cron_timeouts === 1 ? "" : "s"}`);
  void now;
  return parts.join(", ");
}

const GUIDE = [
  { t: "Check the load", d: "Open the Supabase Database report for the time of the alert. Look for CPU, memory or disk IO at the limit.", href: "https://supabase.com/dashboard/project/raowjbhbtmwkycmwvavd/reports/database", label: "Open Supabase report" },
  { t: "Add capacity", d: "If any of them hit the limit, pick the next compute size up. The database restarts, so choose a quiet hour. You can switch back down later.", href: "https://supabase.com/dashboard/project/raowjbhbtmwkycmwvavd/settings/compute-and-disk", label: "Open compute settings" },
  { t: "Pause the job that keeps timing out", d: "Use Pause under Fix it. Check its next run before turning it back on.", href: null, label: "" },
  { t: "Cancel a stuck query", d: "Use Cancel under Fix it for anything running over your limit. The page recovers on its own once it stops.", href: null, label: "" },
  { t: "Review the slowest queries", d: "If the same query keeps showing up below, it needs an index or a row limit.", href: null, label: "" },
];

export default async function AdminDatabaseHealthPage() {
  const { profile } = await requirePermissionPage("view_system_health");
  const data = await loadDbHealth();
  const { now, settings, samples, incidents, jobs, longQueries, queryStats } = data;

  const tiles = buildTiles({ now, settings, samples, jobs });
  const latest = samples[samples.length - 1] ?? null;
  const open = incidents.find((i) => !i.ended_at) ?? null;
  const state = open ? open.peak_state : latest?.state ?? null;
  const timedOut = jobs.filter((j) => j.timeouts > 0);
  const totalRuns = jobs.reduce((n, j) => n + j.runs, 0);
  const otherJobs = jobs.filter((j) => j.timeouts === 0);
  const otherRuns = otherJobs.reduce((n, j) => n + j.runs, 0);

  const reading = latest
    ? { responseMs: latest.response_ms, probeFailed: latest.response_ms === null, longestQueryS: latest.longest_query_s, newCronTimeouts: latest.cron_timeouts }
    : null;
  const cause: IncidentCause | null = open ? (open.cause as IncidentCause) : reading && latest && latest.state !== "ok" ? classifyCause(reading, settings) : null;

  const patterns = findPatterns({ incidents, jobs: listCronJobs().map((j) => ({ name: j.name, schedules: j.schedules })), queryStats });
  const p90 = queryStats?.norms.p90_mean_ms ?? null;
  const median = queryStats?.norms.median_mean_ms ?? null;

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Database health">
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="System"
          title="Database health"
          description="How fast the database answers, what is running, and which scheduled jobs are failing. Admins are notified when it slows down. A check runs every 5 minutes."
          actions={<Link href="/admin/system-health" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">System health</Link>}
        />

        {!tiles || !latest ? (
          <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Not measured yet</p>
            <p className="mt-1 text-xs leading-relaxed">No health check has been recorded. The check runs every 5 minutes once the Database health SQL has been run and the check is deployed. Until then nothing on this page is measured. You can see whether it has run on <Link href="/admin/scheduled-jobs" className="font-semibold underline">Scheduled jobs</Link>, under Database health check.</p>
          </div>
        ) : (
          <>
            <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${state === "overload" ? "border-red-200 bg-red-50 text-red-900" : state === "warn" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
              <p className="font-semibold">{state === "overload" ? "Overloaded" : state === "warn" ? "Slow, watch closely" : "Healthy"}</p>
              <p className="mt-1 text-xs leading-relaxed">
                {open
                  ? `An incident has been open since ${formatWhen(new Date(open.started_at), new Date(now))}: ${incidentNote(open, now)}.`
                  : state === "ok"
                    ? "Response time and scheduled jobs are inside your limits."
                    : "The latest check is outside your limits. An alert opens if it stays that way."}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {tiles.map((t) => (
                <MetricCard key={t.key} label={t.label} value={t.value} unit={t.unit} detail={t.detail} accent="blue" ring={t.ring} flag={t.flag} detailPanel={t.detailPanel} audience="admin" />
              ))}
            </div>
            <p className="text-center text-xs text-slate-500">Tap a tile for its graph. Normal is the 7 day average plus or minus one standard deviation, built from these checks.</p>

            <WorkspaceSection icon="ti-stethoscope" tone="amber" title="What is causing it" subtitle="Worked out from the readings. Likely causes, not proof.">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                {cause ? (
                  <>
                    <p className="font-semibold text-slate-900">{CAUSE_LABEL[cause]} <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Likely</span></p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {cause === "jobs_and_queries" && "A query ran past its limit and a scheduled job timed out in the same check. Jobs and page requests were competing for the database. Cancel the long query, then pause the job that timed out."}
                      {cause === "job_timeout" && "A scheduled job started and never finished. Pause it under Fix it, then check its next run on Scheduled jobs."}
                      {cause === "slow_query" && "One query has run past your limit while the rest looks normal. Cancel it under Fix it, then look at the slowest queries below."}
                      {cause === "slow_response" && "The test query was slow with no long query or job timeout to explain it. If the Supabase report shows CPU, memory or disk IO at the limit, the database needs more capacity."}
                    </p>
                    {state === "overload" ? <p className="mt-2 text-xs text-slate-600"><b className="text-slate-800">Also check:</b> whether the database is too small for the load. This page cannot read CPU or memory, so use the Supabase report in Step 1 of How to fix overload.</p> : null}
                  </>
                ) : (
                  <p className="text-slate-700"><b>Nothing to fix right now.</b> <span className="text-xs text-slate-500">Response time and jobs are inside your limits.</span></p>
                )}
              </div>
            </WorkspaceSection>
          </>
        )}

        <div id="fix-it" className="scroll-mt-24">
        <WorkspaceSection icon="ti-tool" tone="red" title="Fix it" subtitle="Each action asks you to confirm and is written to the audit log.">
          <DbHealthFixes
            longQueries={longQueries}
            queryLimitS={settings.queryLimitS}
            jobs={timedOut.map((j) => ({ path: j.path, name: j.name, timeouts: j.timeouts, paused: data.pausedPaths.includes(j.path) }))}
          />
        </WorkspaceSection>
        </div>

        <WorkspaceSection icon="ti-sparkles" tone="purple" title="Ask AI to fix this" subtitle="Explains the readings in plain words. You confirm every action under Fix it.">
          <DbHealthAskAi />
        </WorkspaceSection>

        <WorkspaceSection icon="ti-clock-exclamation" tone="amber" title="Timeouts by job, last 24 hours" subtitle="Share of runs that did not finish. From the Scheduled jobs run log.">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2">
            {timedOut.map((j) => <Bar key={j.path} label={j.name} sub={`${j.timeouts} of ${j.runs} runs`} percent={(j.timeouts / j.runs) * 100} value={`${((j.timeouts / j.runs) * 100).toFixed(1)}%`} tone="bad" />)}
            <Bar label="All other jobs" sub={`${otherRuns} runs, none timed out`} percent={0} value="0%" tone="ok" />
            <Should>0% timeouts, out of {totalRuns} runs. A job that does not finish did not do its work.</Should>
          </div>
        </WorkspaceSection>

        <WorkspaceSection icon="ti-chart-bar" tone="blue" title="Slowest queries" subtitle="From the database's own statistics since they were last reset, by share of total query time.">
          {queryStats ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white px-4 py-2">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500"><th className="py-2 pr-3 font-semibold">Query</th><th className="py-2 pr-3 font-semibold">Average</th><th className="py-2 pr-3 font-semibold">Worst</th><th className="py-2 pr-3 font-semibold">Share of time</th><th className="py-2 font-semibold">Verdict</th></tr></thead>
                <tbody>
                  {queryStats.top.map((q) => {
                    const v = queryVerdict(q.mean_ms, p90);
                    return (
                      <tr key={q.q} className="border-t border-slate-100 align-top">
                        <td className="py-2 pr-3"><p className="font-medium text-slate-800">{labelQuery(q.q)}</p><p className="text-[11px] text-slate-500">{q.calls.toLocaleString("en-US")} calls, {q.call_pct}% of calls{v.timesOver !== null && v.verdict === "above" ? `, ${v.timesOver}x the normal limit` : ""}</p></td>
                        <td className="whitespace-nowrap py-2 pr-3 tabular-nums">{fmtMs(q.mean_ms)}</td>
                        <td className="whitespace-nowrap py-2 pr-3 tabular-nums">{fmtMs(q.max_ms)}</td>
                        <td className="whitespace-nowrap py-2 pr-3 tabular-nums">{q.time_pct}%</td>
                        <td className="py-2">{v.verdict ? <VerdictBadge verdict={v.verdict} /> : <span className="text-xs text-slate-400">n/a</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs leading-relaxed text-slate-700">
                <b className="text-slate-900">Typical:</b> {median === null ? "not available" : `${median} ms`} average across {queryStats.norms.queries.toLocaleString("en-US")} queries with at least 10 calls. <b className="text-slate-900">Should be:</b> an average of {p90 === null ? "n/a" : `${p90} ms`} or less, the 90th percentile of your own queries. The verdict uses the average. Share is time spent, not slowness, so a fast query that runs very often can top the list.
              </p>
            </div>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">Not measured. Run the Database health SQL (part 2) in the Supabase SQL editor to read the query statistics.</p>
          )}
        </WorkspaceSection>

        <WorkspaceSection icon="ti-history" tone="gray" title="Incident log" subtitle="Every slowdown: when it started, how long it lasted, the likely cause and what was done.">
          {incidents.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">No incident recorded yet. Should be: none.</p>
          ) : (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {incidents.map((i) => (
                <div key={i.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{formatWhen(new Date(i.started_at), new Date(now))}, {i.ended_at ? `lasted ${duration(i.started_at, i.ended_at, now)}` : `open for ${duration(i.started_at, null, now)}`}</p>
                    <p className="text-xs text-slate-500">{incidentNote(i, now)}</p>
                    <p className="text-xs text-slate-500">{i.action_taken ? `Action: ${i.action_taken}` : "Action: none recorded"}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${i.peak_state === "overload" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{i.peak_state === "overload" ? "Overloaded" : "Warning"}</span>
                </div>
              ))}
            </div>
          )}
        </WorkspaceSection>

        <WorkspaceSection icon="ti-chart-dots" tone="purple" title="Patterns and improvements" subtitle="Counted from the incident log and the query statistics. Incident patterns need 3 incidents.">
          <div className="space-y-3">
            {patterns.patterns.map((p) => (
              <div key={p.key} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <p className="font-semibold text-slate-900">{p.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{p.detail}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-700"><b className="text-slate-900">Suggested improvement:</b> {p.suggestion}</p>
              </div>
            ))}
            {patterns.incidents < patterns.needed ? (
              <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">Not enough incidents yet to show a pattern over time: {patterns.incidents} of {patterns.needed} needed.</p>
            ) : patterns.patterns.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">{patterns.incidents} incidents logged and no repeating hour or cause found.</p>
            ) : null}
          </div>
        </WorkspaceSection>

        <DbHealthAlertRules initial={settings} />

        <WorkspaceSection icon="ti-list-check" tone="green" title="How to fix overload" subtitle="Follow these in order.">
          <ol className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {GUIDE.map((g, i) => (
              <li key={g.t} className="flex gap-3 px-4 py-3 text-sm">
                <span className="w-14 shrink-0 text-xs font-semibold text-indigo-700">Step {i + 1}</span>
                <div><p className="font-semibold text-slate-900">{g.t}</p><p className="text-xs leading-relaxed text-slate-600">{g.d}</p>{g.href ? <a href={g.href} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold text-indigo-700 hover:underline">{g.label}</a> : null}</div>
              </li>
            ))}
          </ol>
        </WorkspaceSection>
      </WorkspacePageContainer>
    </AppShell>
  );
}
