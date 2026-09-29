"use client";

/**
 * Founder portal — "Your investor outreach summary" (mockup 5, founder view). Period picker
 * (weekly / monthly / custom within the term), compare toggle, metric cards with change,
 * summary, communications log (firms named once a meeting is booked), notes from the IR
 * team, pipeline at period end, upcoming meetings, and the reports the IR team sent, each
 * with its executive summary and a PDF download. Read-only.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatRange } from "@/lib/ir/milestones";
import type { FounderProject, FounderReportPayload } from "@/lib/ir/founder-report";
import type { ReportKind } from "@/lib/ir/report";

const seg = (on: boolean) => `rounded-md px-2.5 py-1 text-[12px] font-medium ${on ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"}`;
const inp = "rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] focus:border-indigo-400 focus:outline-none";
const METRICS: Array<[keyof FounderReportPayload["metrics"], string]> = [["intros", "Introductions sent"], ["contacted", "Investors contacted"], ["booked", "Meetings booked"], ["held", "Meetings held"], ["committed", "Commitments"]];

export function OutreachReportClient({ projects }: { projects: FounderProject[] }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [kind, setKind] = useState<ReportKind>("week");
  const [milestone, setMilestone] = useState("");
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [custom, setCustom] = useState<{ start: string; end: string } | null>(null);
  const [compare, setCompare] = useState(true);
  const [data, setData] = useState<FounderReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const project = projects.find((p) => p.id === projectId) ?? projects[0];

  const load = useCallback(async () => {
    if (!projectId) return;
    const q = new URLSearchParams({ project: projectId, kind, compare: compare ? "1" : "0" });
    if (kind === "custom") { if (!custom) return; q.set("start", custom.start); q.set("end", custom.end); } else if (milestone) q.set("milestone", milestone);
    const r = await fetch(`/api/founder/ir/report?${q}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? "Couldn't load your report."); return; }
    setData(j); setError(null);
  }, [projectId, kind, milestone, custom, compare]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set
  useEffect(() => { void load(); }, [load]);

  const total = useMemo(() => (data?.pipeline ?? []).reduce((s, p) => s + p.count, 0), [data]);
  const delta = (k: keyof FounderReportPayload["metrics"]) => (data?.prevMetrics ? data.metrics[k] - data.prevMetrics[k] : null);
  function applyCustom() {
    if (!from || !to) { setError("Pick both dates."); return; }
    if (from >= to) { setError("The start date must come before the end date."); return; }
    setError(null); setCustom({ start: from, end: to });
  }

  if (error && !data) return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>;
  if (!data) return <p className="text-[13px] text-slate-400">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold text-slate-900">Your investor outreach summary</h1>
          <p className="text-[13px] text-slate-500">{data.project.title} · Project {data.project.termLabel} · {data.project.monthLabel}</p>
        </div>
        {projects.length > 1 ? <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setMilestone(""); }} className={inp}>{projects.map((p) => <option key={p.id} value={p.id}>{p.title} · {formatRange(p.start_date, p.end_date)}</option>)}</select> : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Report period">
          {(["week", "month", "custom"] as ReportKind[]).map((k) => <button key={k} type="button" className={seg(kind === k)} onClick={() => { setKind(k); setMilestone(""); }}>{k === "week" ? "Weekly" : k === "month" ? "Monthly" : "Custom range"}</button>)}
        </div>
        {kind !== "custom" ? (
          <label className="text-[12px] text-slate-600">{kind === "week" ? "Week" : "Month"}
            <select value={milestone || data.options[kind === "week" ? "weeks" : "months"].find((m) => m.starts_on === data.period.start)?.id || ""} onChange={(e) => setMilestone(e.target.value)} className={`ml-2 ${inp}`}>
              {[...data.options[kind === "week" ? "weeks" : "months"]].reverse().map((m) => <option key={m.id} value={m.id}>{m.label} · {formatRange(m.starts_on, m.ends_on)}</option>)}
            </select>
          </label>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-600">
            <label>From <input type="date" value={from} min={project?.start_date} max={project?.end_date} onChange={(e) => setFrom(e.target.value)} className={`ml-1 ${inp}`} /></label>
            <label>To <input type="date" value={to} min={project?.start_date} max={project?.end_date} onChange={(e) => setTo(e.target.value)} className={`ml-1 ${inp}`} /></label>
            <button type="button" onClick={applyCustom} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50">Apply</button>
          </div>
        )}
        <label className="ml-auto flex items-center gap-2 text-[12.5px] text-slate-700"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Compare with previous period</label>
      </div>
      {error ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div> : null}
      <p className="text-[12.5px] text-slate-500">Showing <strong className="font-semibold text-slate-900">{data.period.label}</strong></p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {METRICS.map(([k, label]) => { const d = delta(k); return (
          <div key={k} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="text-[26px] font-semibold text-slate-900">{data.metrics[k]}</p>
            <p className={`text-[12px] ${d == null ? "text-slate-400" : d > 0 ? "text-emerald-700" : d < 0 ? "text-rose-600" : "text-slate-500"}`}>{!compare ? "" : data.period.kind === "custom" ? "No previous period for a custom range" : d == null ? "No previous period in the term" : d > 0 ? `Up ${d} vs ${data.previous?.label.split(" · ")[0].toLowerCase()}` : d < 0 ? `Down ${-d} vs ${data.previous?.label.split(" · ")[0].toLowerCase()}` : "No change"}</p>
          </div>
        ); })}
      </div>

      {data.sentReport ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><h2 className="text-[15px] font-semibold text-indigo-900">Executive summary from your IR team</h2><a href={`/api/founder/ir/report/pdf?report=${data.sentReport.id}`} className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-[12.5px] font-medium text-indigo-800 hover:bg-indigo-100">Download the report (PDF)</a></div>
          <p className="text-[13.5px] text-indigo-950"><strong className="font-semibold">Bottom line.</strong> {data.sentReport.summary.bottom}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-indigo-950">{data.sentReport.summary.lead}</p>
          {data.sentReport.summary.asks.length ? <><p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-indigo-700">Asks of {data.project.title}</p><ul className="list-disc pl-5 text-[13px] text-indigo-950">{data.sentReport.summary.asks.map((a, i) => <li key={i}>{a}</li>)}</ul></> : null}
          <p className="mt-2 text-[11.5px] text-indigo-700">Sent {new Date(data.sentReport.sentAt).toLocaleDateString()}</p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="mb-1 text-[15px] font-semibold text-slate-900">Summary</h2><p className="text-[14px] leading-relaxed text-slate-800">{data.summary}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-[15px] font-semibold text-slate-900">Communications log</h2>
            <table className="w-full text-[12.5px]">
              <thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1 pr-2 font-medium">Date</th><th className="py-1 pr-2 font-medium">Channel</th><th className="py-1 pr-2 font-medium">Firm</th><th className="py-1 pr-2 font-medium">What happened</th><th className="py-1 font-medium">Next step</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{data.comms.map((c, i) => <tr key={i}><td className="py-1.5 pr-2 text-slate-600">{c.date}</td><td className="py-1.5 pr-2 text-slate-800">{c.channel}</td><td className="py-1.5 pr-2 text-slate-800">{c.firm}</td><td className="py-1.5 pr-2 text-slate-700">{c.what}</td><td className="py-1.5 text-slate-500">{c.next}</td></tr>)}
                {data.comms.length === 0 ? <tr><td colSpan={5} className="py-3 text-slate-400">No investor contact logged in this period.</td></tr> : null}</tbody>
            </table>
            <h2 className="mb-2 mt-5 text-[15px] font-semibold text-slate-900">Notes from your IR team</h2>
            {data.notes.length === 0 ? <p className="text-[12.5px] text-slate-400">No notes this period.</p> : <ul className="flex flex-col gap-2 text-[13px]">{data.notes.map((n, i) => <li key={i} className="flex gap-3"><span className="w-14 shrink-0 text-slate-500">{n.date}</span><span className="text-slate-800">{n.body}</span></li>)}</ul>}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-baseline justify-between"><h2 className="text-[15px] font-semibold text-slate-900">Pipeline at period end</h2><span className="text-[12px] text-slate-500">{data.asOf}</span></div>
            <ul className="flex flex-col gap-1.5 text-[12.5px]">{data.pipeline.map((p) => <li key={p.stage} className="grid grid-cols-[130px_1fr_32px] items-center gap-2"><span className="text-slate-700">{p.label}</span><span className="h-2 rounded bg-slate-100"><span className="block h-2 rounded" style={{ width: `${total ? (p.count / total) * 100 : 0}%`, background: p.stage === "committed" ? "#1E8A57" : p.stage === "passed" ? "#9AA6BA" : "#1A6CE4" }} /></span><span className="text-right font-medium text-slate-900">{p.count}</span></li>)}</ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-1 text-[15px] font-semibold text-slate-900">Upcoming meetings</h2>
            {data.upcoming.length === 0 ? <p className="text-[12.5px] text-slate-400">None booked right now.</p> : <ul className="text-[12.5px]">{data.upcoming.map((u, i) => <li key={i} className="flex justify-between py-1"><span className="text-slate-800">{u.firm}</span><span className="text-slate-500">{u.when}</span></li>)}</ul>}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-1 text-[15px] font-semibold text-slate-900">Reports from your IR team</h2>
            {data.sentReports.length === 0 ? <p className="text-[12.5px] text-slate-400">No written reports yet. Your IR contact sends one at the end of each reporting period.</p> : <ul className="divide-y divide-slate-100 text-[12.5px]">{data.sentReports.map((r) => <li key={r.id} className="flex items-start justify-between gap-2 py-2"><span><span className="block text-slate-800">{r.kind === "week" ? "Weekly" : r.kind === "month" ? "Monthly" : "Custom"} · {r.period}</span>{r.bottom ? <span className="block text-slate-500">{r.bottom}</span> : null}</span><a href={`/api/founder/ir/report/pdf?report=${r.id}`} className="shrink-0 text-indigo-700 hover:underline">PDF</a></li>)}</ul>}
          </div>
          <p className="text-[11.5px] text-slate-400">Investor names and contact details are held by iCFO Capital Global, Inc. and are not shown here. Firms appear once a meeting is booked. Ask your iCFO contact before approaching any investor directly, so outreach is not duplicated. This summary is not an offer to sell securities.</p>
        </div>
      </div>
    </div>
  );
}
