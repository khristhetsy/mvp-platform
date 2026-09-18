"use client";

/**
 * Founder report — two views over one data source.
 *   Interactive: period picker (weekly / monthly / custom within the term), compare toggle,
 *   metric cards with change vs previous, summary, communications log, IR notes, pipeline
 *   at period end.
 *   Send format: executive summary editor (AI drafts, staff edit + approve), the letter-size
 *   document preview, and the send panel (to / subject / message / attach PDF). Sending is
 *   blocked until the summary is approved and a real founder email is present.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatRange } from "@/lib/ir/milestones";
import type { ExecSummary, ReportData, ReportKind } from "@/lib/ir/report";

type View = "live" | "doc";
const seg = (on: boolean) => `rounded-md px-2.5 py-1 text-[12px] font-medium ${on ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"}`;
const inp = "rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] focus:border-indigo-400 focus:outline-none";
const EMPTY: ExecSummary = { bottom: "", lead: "", highlights: [], themes: [], watch: [], asks: [] };
const METRICS: Array<[keyof ReportData["metrics"], string]> = [["intros", "Introductions sent"], ["contacted", "Investors contacted"], ["booked", "Meetings booked"], ["held", "Meetings held"], ["committed", "Commitments"]];

export function ReportClient({ projectId, meName }: { projectId: string; meName: string }) {
  const [kind, setKind] = useState<ReportKind>("week");
  const [milestone, setMilestone] = useState<string>("");
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [custom, setCustom] = useState<{ start: string; end: string } | null>(null);
  const [compare, setCompare] = useState(true);
  const [view, setView] = useState<View>("live");
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ExecSummary>(EMPTY);
  const [summarySource, setSummarySource] = useState<"ai" | "template" | "saved" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sendTo, setSendTo] = useState(""); const [subject, setSubject] = useState(""); const [message, setMessage] = useState(""); const [attach, setAttach] = useState(true);

  const query = useCallback(() => {
    const q = new URLSearchParams({ kind, compare: compare ? "1" : "0" });
    if (kind === "custom") { if (!custom) return null; q.set("start", custom.start); q.set("end", custom.end); }
    else if (milestone) q.set("milestone", milestone);
    return q;
  }, [kind, milestone, custom, compare]);
  const body = useCallback(() => (kind === "custom" ? { kind, start: custom?.start, end: custom?.end, compare } : { kind, milestone: milestone || null, compare }), [kind, milestone, custom, compare]);

  const load = useCallback(async () => {
    const q = query(); if (!q) return;
    const r = await fetch(`/api/admin/ir/projects/${projectId}/report?${q}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? "Couldn't build the report."); return; }
    const d = j as ReportData;
    setData(d); setError(null);
    const saved = d.saved?.exec_summary as ExecSummary | undefined;
    if (saved && typeof saved.bottom === "string") { setSummary({ ...EMPTY, ...saved }); setSummarySource("saved"); } else { setSummary(EMPTY); setSummarySource(null); }
    setSendTo((cur) => cur || d.founder.email || "");
    setSubject(`${d.project.title} investor outreach report · ${d.period.label}`);
    setMessage(`Hi ${d.founder.name.split(/\s+/)[0]}, attached is your outreach report for ${d.period.label}. ${saved?.bottom ?? ""} Happy to walk through it on a call.`.replace(/\s{2,}/g, " "));
  }, [projectId, query]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set
  useEffect(() => { void load(); }, [load]);

  const delta = (k: keyof ReportData["metrics"]) => (data?.prevMetrics ? data.metrics[k] - data.prevMetrics[k] : null);
  const total = useMemo(() => (data?.pipeline ?? []).reduce((s, p) => s + p.count, 0), [data]);

  function applyCustom() {
    if (!from || !to) { setError("Pick both dates."); return; }
    if (from >= to) { setError("The start date must come before the end date."); return; }
    setError(null); setCustom({ start: from, end: to });
  }
  async function post(payload: Record<string, unknown>, label: string) {
    setBusy(label); setError(null); setNotice(null);
    const r = await fetch(`/api/admin/ir/projects/${projectId}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body(), ...payload }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setError(j.error ?? "Couldn't complete that."); return null; }
    return j;
  }
  async function draft() { const j = await post({ action: "draft" }, "draft"); if (j) { setSummary({ ...EMPTY, ...j.summary }); setSummarySource(j.source); setNotice(j.source === "ai" ? "Draft written from this period's activity and notes. Edit, then approve." : "AI isn't configured on this environment — a template draft was built from the figures. Edit, then approve."); } }
  async function save(approve: boolean) {
    if (approve && (!summary.bottom.trim() || !summary.lead.trim())) { setError("The bottom line and lead paragraph are required before approval."); return; }
    const j = await post({ action: "save", summary, approve }, approve ? "approve" : "save");
    if (j) { setNotice(approve ? "Executive summary approved and the figures frozen for this period." : "Draft saved."); await load(); }
  }
  async function send() {
    if (!data?.saved?.approved_at) { setError("Approve the executive summary before sending."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sendTo)) { setError("Enter the founder's email address before sending."); return; }
    const j = await post({ action: "send", to: sendTo, subject, message, attachPdf: attach }, "send");
    if (j) { setNotice(`Sent to ${sendTo}.`); await load(); }
  }

  if (error && !data) return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>;
  if (!data) return <p className="text-[13px] text-slate-400">Loading…</p>;
  const pdfHref = data.saved?.approved_at ? `/api/admin/ir/projects/${projectId}/report/pdf?report=${data.saved.id}` : `/api/admin/ir/projects/${projectId}/report/pdf?${query()}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[12px] text-slate-500"><Link href="/admin/ir/projects" className="hover:text-indigo-700">Projects</Link><span>/</span><Link href={`/admin/ir/projects/${projectId}`} className="hover:text-indigo-700">{data.project.title}</Link><span>/</span><span className="text-slate-800">Founder report</span></div>
          <h2 className="text-[20px] font-semibold text-slate-900">Investor outreach summary</h2>
          <p className="text-[12.5px] text-slate-500">{data.project.title} · Project {data.project.termLabel} · {data.project.monthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Report view"><button type="button" className={seg(view === "live")} onClick={() => setView("live")}>Interactive</button><button type="button" className={seg(view === "doc")} onClick={() => setView("doc")}>Send format</button></div>
          <a href={pdfHref} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50">{data.saved?.approved_at ? "Download PDF" : "Download draft PDF"}</a>
        </div>
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
            <label>From <input type="date" value={from} min={data.project.start_date} max={data.project.end_date} onChange={(e) => setFrom(e.target.value)} className={`ml-1 ${inp}`} /></label>
            <label>To <input type="date" value={to} min={data.project.start_date} max={data.project.end_date} onChange={(e) => setTo(e.target.value)} className={`ml-1 ${inp}`} /></label>
            <button type="button" onClick={applyCustom} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50">Apply</button>
          </div>
        )}
        <label className="ml-auto flex items-center gap-2 text-[12.5px] text-slate-700"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Compare with previous period</label>
      </div>
      {error ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800">{notice}</div> : null}
      <p className="text-[12.5px] text-slate-500">Showing <strong className="font-semibold text-slate-900">{data.period.label}</strong>{data.saved?.approved_at ? <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">Approved{data.saved.sent_at ? ` · sent ${new Date(data.saved.sent_at).toLocaleDateString()}` : ""}</span> : data.saved ? <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">Draft saved</span> : null}</p>

      {view === "live" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {METRICS.map(([k, label]) => { const d = delta(k); return (
              <div key={k} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                <p className="text-[26px] font-semibold text-slate-900">{data.metrics[k]}</p>
                <p className={`text-[12px] ${d == null ? "text-slate-400" : d > 0 ? "text-emerald-700" : d < 0 ? "text-rose-600" : "text-slate-500"}`}>{!compare ? "" : data.period.kind === "custom" ? "No previous period for a custom range" : d == null ? "No previous period in the term" : d > 0 ? `Up ${d} vs ${data.previous?.label.split(" · ")[0].toLowerCase()}` : d < 0 ? `Down ${-d} vs ${data.previous?.label.split(" · ")[0].toLowerCase()}` : "No change"}</p>
              </div>
            ); })}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="mb-1 text-[15px] font-semibold text-slate-900">Summary</h3><p className="text-[14px] leading-relaxed text-slate-800">{data.summary}</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="mb-2 text-[15px] font-semibold text-slate-900">Communications log</h3>
                <CommsTable rows={data.comms} />
                <h3 className="mb-2 mt-5 text-[15px] font-semibold text-slate-900">Notes from your IR team</h3>
                {data.notes.length === 0 ? <p className="text-[12.5px] text-slate-400">No founder-visible notes in this period. Mark a note founder-visible on a Share Project record to include it.</p> : <ul className="flex flex-col gap-2 text-[13px]">{data.notes.map((n, i) => <li key={i} className="flex gap-3"><span className="w-14 shrink-0 text-slate-500">{n.date}</span><span className="text-slate-800">{n.body}</span></li>)}</ul>}
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-baseline justify-between"><h3 className="text-[15px] font-semibold text-slate-900">Pipeline at period end</h3><span className="text-[12px] text-slate-500">{data.asOf}</span></div>
                <ul className="flex flex-col gap-1.5 text-[12.5px]">{data.pipeline.map((p) => <li key={p.stage} className="grid grid-cols-[130px_1fr_32px] items-center gap-2"><span className="text-slate-700">{p.label}</span><span className="h-2 rounded bg-slate-100"><span className="block h-2 rounded" style={{ width: `${total ? (p.count / total) * 100 : 0}%`, background: p.stage === "committed" ? "#1E8A57" : p.stage === "passed" ? "#9AA6BA" : "#1A6CE4" }} /></span><span className="text-right font-medium text-slate-900">{p.count}</span></li>)}</ul>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="mb-1 text-[15px] font-semibold text-slate-900">Upcoming meetings</h3>
                {data.upcoming.length === 0 ? <p className="text-[12.5px] text-slate-400">None booked.</p> : <ul className="text-[12.5px]">{data.upcoming.map((u, i) => <li key={i} className="flex justify-between py-1"><span className="text-slate-800">{u.firm}</span><span className="text-slate-500">{u.when}</span></li>)}</ul>}
                <p className="mt-3 text-[11.5px] text-slate-400">Investor names and contact details are never included. Firms appear once a meeting is booked.</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[440px_1fr]">
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between"><h3 className="text-[15px] font-semibold text-slate-900">Executive summary</h3><span className="text-[11px] text-slate-500">{summarySource === "saved" ? "Saved text" : summarySource === "ai" ? "AI draft — not yet approved" : summarySource === "template" ? "Template draft" : "Not drafted yet"}</span></div>
              <p className="mb-3 text-[12px] text-slate-500">The AI drafts from this period&rsquo;s activities and notes. Nothing is sent until a staff member edits and approves. Approval freezes the figures for this period.</p>
              <button type="button" disabled={busy !== null} onClick={draft} className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[12.5px] font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-60">{busy === "draft" ? "Drafting…" : summary.bottom ? "Redraft with AI" : "Draft with AI"}</button>
              <Field label="Bottom line" value={summary.bottom} onChange={(v) => setSummary({ ...summary, bottom: v })} rows={2} />
              <Field label="Lead paragraph" value={summary.lead} onChange={(v) => setSummary({ ...summary, lead: v })} rows={4} />
              <ListField label="Period highlights" items={summary.highlights} onChange={(v) => setSummary({ ...summary, highlights: v })} />
              <ListField label="What investors are asking" items={summary.themes} onChange={(v) => setSummary({ ...summary, themes: v })} />
              <ListField label="Watch items" items={summary.watch} onChange={(v) => setSummary({ ...summary, watch: v })} />
              <ListField label={`Asks of ${data.project.title}`} items={summary.asks} onChange={(v) => setSummary({ ...summary, asks: v })} />
              <div className="mt-3 flex items-center gap-2">
                <button type="button" disabled={busy !== null} onClick={() => save(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50 disabled:opacity-60">{busy === "save" ? "Saving…" : "Save draft"}</button>
                <button type="button" disabled={busy !== null} onClick={() => save(true)} className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy === "approve" ? "Approving…" : data.saved?.approved_at ? "Re-approve" : "Approve"}</button>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-[15px] font-semibold text-slate-900">Send to founder</h3>
              <div className="grid gap-2 text-[12.5px]">
                <label className="grid grid-cols-[80px_1fr] items-center gap-2 text-slate-600">To <input value={sendTo} onChange={(e) => setSendTo(e.target.value)} placeholder={data.founder.email ? "" : "No founder email on file — enter one"} className={inp} /></label>
                <label className="grid grid-cols-[80px_1fr] items-center gap-2 text-slate-600">Subject <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inp} /></label>
                <label className="grid grid-cols-[80px_1fr] items-start gap-2 text-slate-600">Message <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className={inp} /></label>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <label className="flex items-center gap-2 text-[12.5px] text-slate-700"><input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} /> Attach as PDF</label>
                <button type="button" disabled={busy !== null || !data.saved?.approved_at} title={data.saved?.approved_at ? "" : "Approve the executive summary first"} onClick={send} className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy === "send" ? "Sending…" : "Send report"}</button>
              </div>
              {!data.saved?.approved_at ? <p className="mt-2 text-[11.5px] text-amber-700">Sending unlocks once the executive summary is approved.</p> : null}
            </div>
          </div>
          <Document d={data} ex={summary} preparedBy={data.project.owner_name ?? meName} />
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, rows }: { label: string; value: string; onChange: (v: string) => void; rows: number }) {
  return <label className="mb-2 block text-[12px] text-slate-600">{label}<textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={`mt-1 w-full ${inp}`} /></label>;
}
function ListField({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  return <label className="mb-2 block text-[12px] text-slate-600">{label} <span className="text-slate-400">(one per line)</span><textarea value={items.join("\n")} onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))} rows={Math.max(2, items.length + 1)} className={`mt-1 w-full ${inp}`} /></label>;
}
function CommsTable({ rows, compact }: { rows: ReportData["comms"]; compact?: boolean }) {
  return (
    <table className={`w-full ${compact ? "text-[11px]" : "text-[12.5px]"}`}>
      <thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1 pr-2 font-medium">Date</th><th className="py-1 pr-2 font-medium">Channel</th><th className="py-1 pr-2 font-medium">Firm</th><th className="py-1 pr-2 font-medium">What happened</th><th className="py-1 font-medium">Next step</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.map((c, i) => <tr key={i}><td className="py-1.5 pr-2 text-slate-600">{c.date}</td><td className="py-1.5 pr-2 text-slate-800">{c.channel}</td><td className="py-1.5 pr-2 text-slate-800">{c.firm}</td><td className="py-1.5 pr-2 text-slate-700">{c.what}</td><td className="py-1.5 text-slate-500">{c.next}</td></tr>)}
        {rows.length === 0 ? <tr><td colSpan={5} className="py-3 text-slate-400">No investor contact logged in this period.</td></tr> : null}</tbody>
    </table>
  );
}

/** Letter-sized preview of the send-format document (the PDF mirrors it). Inline SVG charts. */
function Document({ d, ex, preparedBy }: { d: ReportData; ex: ExecSummary; preparedBy: string }) {
  const total = d.pipeline.reduce((s, p) => s + p.count, 0);
  const cmp = Boolean(d.prevMetrics);
  return (
    <div className="mx-auto w-full max-w-[760px] rounded-xl border border-slate-200 bg-white p-10 shadow-sm">
      <div className="flex items-start justify-between border-b-2 border-[#0A1A40] pb-3">
        <div><p className="text-[16px] font-bold text-[#0A1A40]">iCFO Capital Global, Inc.</p><p className="text-[11px] text-slate-500">Investor Relations · La Jolla, California</p></div>
        <div className="text-right"><p className="text-[13px] font-semibold text-[#0A1A40]">Investor Outreach Report</p><p className="text-[11px] text-slate-500">Prepared {d.preparedOn}</p></div>
      </div>
      <dl className="mt-4 grid grid-cols-[130px_1fr] gap-x-3 gap-y-1 text-[12px]">
        <dt className="text-slate-500">Prepared for</dt><dd className="text-slate-900">{d.founder.name}, {d.project.title}</dd>
        <dt className="text-slate-500">Reporting period</dt><dd className="text-slate-900">{d.period.label}</dd>
        <dt className="text-slate-500">Project term</dt><dd className="text-slate-900">{d.project.termLabel} · {d.project.monthLabel}</dd>
        <dt className="text-slate-500">Prepared by</dt><dd className="text-slate-900">{preparedBy}, Investor Relations</dd>
      </dl>
      <H2>Executive summary</H2>
      <div className="border-l-4 border-[#1A6CE4] bg-slate-50 px-3 py-2 text-[12.5px] text-slate-900"><strong className="font-semibold">Bottom line.</strong> {ex.bottom || <span className="text-slate-400">Draft or write the bottom line.</span>}</div>
      <p className="mt-2 text-[12px] leading-relaxed text-slate-800">{ex.lead || <span className="text-slate-400">Lead paragraph.</span>}</p>
      <H3>Period highlights</H3><UL items={ex.highlights} />
      <H3>What investors are asking</H3><UL items={ex.themes} />
      <H3>Watch items</H3><UL items={ex.watch} />
      <H3>Asks of {d.project.title}</H3><UL items={ex.asks} />
      <H2>Outreach and meetings by {d.trend.kind}</H2>
      <Bars t={d.trend} />
      <p className="mt-1 text-[10.5px] text-slate-500">Introductions go out in batches; meetings tend to follow one to three periods later, which is why the two bars rarely peak together.</p>
      <H2>Pipeline funnel</H2>
      <Funnel items={d.pipeline} />
      <H2>Activity this period</H2>
      <table className="w-full text-[11.5px]"><thead><tr className="bg-slate-50 text-left text-[10.5px] text-slate-500"><th className="px-2 py-1 font-medium">Measure</th><th className="px-2 py-1 text-right font-medium">This period</th><th className="px-2 py-1 text-right font-medium">{cmp ? "Previous" : ""}</th><th className="px-2 py-1 text-right font-medium">{cmp ? "Change" : ""}</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{METRICS.map(([k, label]) => { const dv = cmp ? d.metrics[k] - d.prevMetrics![k] : 0; return <tr key={k}><td className="px-2 py-1">{label}</td><td className="px-2 py-1 text-right">{d.metrics[k]}</td><td className="px-2 py-1 text-right">{cmp ? d.prevMetrics![k] : ""}</td><td className="px-2 py-1 text-right">{cmp ? (dv > 0 ? `+${dv}` : dv) : ""}</td></tr>; })}</tbody></table>
      <H2>Investor pipeline at period end</H2>
      <table className="w-full text-[11.5px]"><thead><tr className="bg-slate-50 text-left text-[10.5px] text-slate-500"><th className="px-2 py-1 font-medium">Stage</th><th className="px-2 py-1 text-right font-medium">Investors</th><th className="px-2 py-1 text-right font-medium">Share of {total}</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{d.pipeline.map((p) => <tr key={p.stage}><td className="px-2 py-1">{p.label}</td><td className="px-2 py-1 text-right">{p.count}</td><td className="px-2 py-1 text-right">{total ? `${Math.round((p.count / total) * 100)}%` : "—"}</td></tr>)}<tr><td className="px-2 py-1 font-semibold">Total matched</td><td className="px-2 py-1 text-right font-semibold">{total}</td><td /></tr></tbody></table>
      <H2>Communications log</H2>
      <p className="mb-1 text-[11px] text-slate-500">Every investor contact made on your behalf in this period, with the outcome and the next step. Firms are named once a meeting is booked.</p>
      <CommsTable rows={d.comms} compact />
      <H2>Notes from your IR team</H2>
      {d.notes.length === 0 ? <p className="text-[12px] text-slate-400">No notes for this period.</p> : d.notes.map((n, i) => <p key={i} className="mb-1 text-[12px] text-slate-800"><strong className="font-semibold">{n.date}.</strong> {n.body}</p>)}
      <H2>Upcoming meetings</H2>
      {d.upcoming.length === 0 ? <p className="text-[12px] text-slate-400">None booked.</p> : <table className="w-full text-[11.5px]"><thead><tr className="bg-slate-50 text-left text-[10.5px] text-slate-500"><th className="px-2 py-1 font-medium">Firm</th><th className="px-2 py-1 font-medium">When</th></tr></thead><tbody className="divide-y divide-slate-100">{d.upcoming.map((u, i) => <tr key={i}><td className="px-2 py-1">{u.firm}</td><td className="px-2 py-1">{u.when}</td></tr>)}</tbody></table>}
      <H2>Next period</H2>
      <p className="text-[12px] leading-relaxed text-slate-800">Your team continues outreach against the matched list, with follow ups scheduled for investors who have met with you and data room access for those in diligence. Ask your iCFO contact before approaching any investor directly, so outreach is not duplicated.</p>
      <div className="mt-8 flex items-end justify-between border-t border-slate-200 pt-3"><div><p className="text-[12px] font-semibold text-slate-900">{preparedBy}</p><p className="text-[11px] text-slate-500">Investor Relations, iCFO Capital Global, Inc.</p></div></div>
      <p className="mt-4 text-[10px] leading-relaxed text-slate-500">Confidential. Prepared for {d.founder.name} and {d.project.title} only. Investor names and contact details are held by iCFO Capital Global, Inc. and are not included in this report. Firms are named once a meeting is booked. Figures cover the reporting period stated above and are drawn from the iCapOS Investor Relations Hub. This report is not an offer to sell securities.</p>
    </div>
  );
}

const H2 = ({ children }: { children: React.ReactNode }) => <h4 className="mb-2 mt-6 border-b border-slate-200 pb-1 text-[13px] font-semibold text-[#0A1A40]">{children}</h4>;
const H3 = ({ children }: { children: React.ReactNode }) => <h5 className="mb-1 mt-3 text-[12px] font-semibold text-slate-900">{children}</h5>;
const UL = ({ items }: { items: string[] }) => items.length ? <ul className="list-disc pl-5 text-[12px] leading-relaxed text-slate-800">{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="text-[12px] text-slate-400">None this period.</p>;

function Bars({ t }: { t: ReportData["trend"] }) {
  const w = 680, h = 190, l = 30, b = 28, top = 16, n = Math.max(1, t.labels.length), max = Math.max(1, ...t.intros, ...t.held);
  const plotW = w - l - 8, plotH = h - b - top, gw = plotW / n, bw = Math.min(18, gw / 3);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Introductions sent and meetings held by period">
      {[0, 0.5, 1].map((f) => { const y = top + plotH - f * plotH; return <g key={f}><line x1={l} y1={y} x2={w} y2={y} stroke="#E2E7F0" /><text x={0} y={y + 4} fontSize={10} fill="#5B6B86">{Math.round(f * max)}</text></g>; })}
      {t.labels.map((lab, i) => { const x = l + i * gw + gw / 2, ha = (t.intros[i] / max) * plotH, hb = (t.held[i] / max) * plotH; return <g key={lab + i}><rect x={x - bw - 2} y={top + plotH - ha} width={bw} height={ha} rx={2} fill="#1A6CE4" /><rect x={x + 2} y={top + plotH - hb} width={bw} height={hb} rx={2} fill="#0A1A40" /><text x={x} y={h - 10} textAnchor="middle" fontSize={10} fill="#5B6B86">{lab}</text></g>; })}
      <rect x={w - 250} y={0} width={9} height={9} rx={2} fill="#1A6CE4" /><text x={w - 236} y={9} fontSize={10} fill="#44516A">Introductions sent</text>
      <rect x={w - 130} y={0} width={9} height={9} rx={2} fill="#0A1A40" /><text x={w - 116} y={9} fontSize={10} fill="#44516A">Meetings held</text>
    </svg>
  );
}
function Funnel({ items }: { items: ReportData["pipeline"] }) {
  const w = 680, rowH = 24, labelW = 132, valW = 50, barW = w - labelW - valW, max = Math.max(1, ...items.map((i) => i.count));
  return (
    <svg viewBox={`0 0 ${w} ${items.length * rowH + 6}`} className="w-full" role="img" aria-label="Investor pipeline by stage">
      {items.map((it, i) => { const y = i * rowH + 3, bw = Math.max(2, Math.round((it.count / max) * barW)); return <g key={it.stage}><text x={0} y={y + 12} fontSize={11} fill="#44516A">{it.label}</text><rect x={labelW} y={y + 3} width={barW} height={12} rx={3} fill="#EEF1F6" /><rect x={labelW} y={y + 3} width={bw} height={12} rx={3} fill={it.stage === "committed" ? "#1E8A57" : it.stage === "passed" ? "#9AA6BA" : "#1A6CE4"} /><text x={labelW + barW + 10} y={y + 13} fontSize={11} fontWeight={600} fill="#0A1A40">{it.count}</text></g>; })}
    </svg>
  );
}
