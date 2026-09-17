"use client";

/**
 * Task form — Odoo layout for one weekly batch: week status bar (click to move), single
 * column of fields, tabs (Agent field · Sub-tasks · Matching · Meetings), chatter below,
 * previous / next week pager. The Agent field composer picks an investor and writes a
 * dated activity — this replaces the free-text Agent Field from Odoo.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatRange } from "@/lib/ir/milestones";
import { IR_ACTIVITY_ICON, IR_ACTIVITY_LABEL, IR_ACTIVITY_TYPES, IR_STAGE_LABEL, type IrActivity, type IrActivityType, type IrMatch, type IrMilestone, type IrNote, type IrProject, type IrTask } from "@/lib/ir/types";

type Payload = { task: IrTask; project: IrProject; weeks: IrMilestone[]; months: IrMilestone[]; matches: IrMatch[]; activities: IrActivity[]; notes: IrNote[]; staff: Array<{ id: string; name: string }>; siblings: Array<{ id: string; title: string; milestone_id: string }> };
type Tab = "agent" | "subtasks" | "matching" | "meetings";
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-indigo-400 focus:outline-none";

export function TaskFormClient({ taskId, meId, initialTab, added }: { taskId: string; meId: string; initialTab: string | null; added: number }) {
  const [now] = useState(() => Date.now());
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>((["agent", "subtasks", "matching", "meetings"].includes(initialTab ?? "") ? initialTab : "agent") as Tab);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(added ? `${added} investor${added === 1 ? "" : "s"} added to this week.` : null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/ir/tasks/${taskId}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? "Couldn't load the task."); return; }
    setData(j); setError(null);
  }, [taskId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set
  useEffect(() => { void load(); }, [load]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/ir/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); setError(j.error ?? "Couldn't update."); }
      await load();
    } finally { setBusy(false); }
  }
  async function patchActivity(id: string, body: Record<string, unknown>) {
    await fetch(`/api/admin/ir/activities/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await load();
  }

  const open = useMemo(() => (data?.activities ?? []).filter((a) => !a.done_at).sort((a, b) => (a.due_at ?? "9").localeCompare(b.due_at ?? "9")), [data]);
  const done = useMemo(() => (data?.activities ?? []).filter((a) => a.done_at).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? "")), [data]);
  const matchName = (id: string | null) => data?.matches.find((m) => m.id === id)?.investor_name ?? (id ? "Investor" : "Week");

  if (error && !data) return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>;
  if (!data) return <p className="text-[13px] text-slate-400">Loading…</p>;
  const { task: t, project: p } = data;
  const week = data.weeks.find((w) => w.id === t.milestone_id) ?? null;
  const month = data.months.find((m) => m.id === week?.parent_id) ?? null;
  const ordered = [...data.siblings].sort((a, b) => (data.weeks.find((w) => w.id === a.milestone_id)?.sort_order ?? 0) - (data.weeks.find((w) => w.id === b.milestone_id)?.sort_order ?? 0));
  const idx = ordered.findIndex((s) => s.id === t.id);
  const prev = idx > 0 ? ordered[idx - 1] : null, next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;
  const base = `/admin/ir/projects/${p.id}/tasks`;
  const monthWeeks = data.weeks.filter((w) => w.parent_id === week?.parent_id);

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
        <Link href="/admin/ir/projects" className="hover:text-indigo-700">Projects</Link><span>/</span>
        <Link href={`/admin/ir/projects/${p.id}`} className="hover:text-indigo-700">{p.title}</Link><span>/</span>
        <Link href={base} className="hover:text-indigo-700">Tasks</Link><span>/</span><span className="text-slate-800">{t.title}</span>
        <span className="ml-auto flex items-center gap-1">
          {prev ? <Link href={`${base}/${prev.id}`} className="rounded border border-slate-200 px-2 py-0.5 hover:bg-slate-50" title={prev.title}>‹ Prev</Link> : <span className="rounded border border-slate-100 px-2 py-0.5 text-slate-300">‹ Prev</span>}
          <span>{idx + 1} / {ordered.length}</span>
          {next ? <Link href={`${base}/${next.id}`} className="rounded border border-slate-200 px-2 py-0.5 hover:bg-slate-50" title={next.title}>Next ›</Link> : <span className="rounded border border-slate-100 px-2 py-0.5 text-slate-300">Next ›</span>}
        </span>
      </div>
      {notice ? <div className="mb-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800"><i className="ti ti-circle-check" aria-hidden="true" /><span className="flex-1">{notice}</span><button type="button" onClick={() => setNotice(null)} className="text-emerald-800"><i className="ti ti-x" aria-hidden="true" /></button></div> : null}
      {error ? <p className="mb-2 text-[12px] text-rose-600">{error}</p> : null}

      {/* Week status bar */}
      <div className="mb-3 flex flex-wrap gap-0.5">
        {monthWeeks.map((w, i) => {
          const active = w.id === t.milestone_id;
          return <button key={w.id} type="button" disabled={busy || active} onClick={() => patch({ milestoneId: w.id, deadline: w.ends_on })} title={formatRange(w.starts_on, w.ends_on)}
            className={`px-3 py-1.5 text-[11.5px] font-medium ${active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"} ${i === 0 ? "rounded-l-lg" : ""} ${i === monthWeeks.length - 1 ? "rounded-r-lg" : ""}`}>{w.label}</button>;
        })}
        <select value={t.status} disabled={busy} onChange={(e) => patch({ status: e.target.value })} className="ml-2 rounded-md border border-slate-200 px-2 py-1 text-[12px]"><option value="new">New</option><option value="in_progress">In progress</option><option value="done">Done</option></select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-start gap-2 border-b border-slate-100 p-4">
          <button type="button" onClick={() => patch({ starred: !t.starred })} aria-label="Star" className={`mt-1 text-[18px] ${t.starred ? "text-amber-500" : "text-slate-300 hover:text-amber-400"}`}><i className={`ti ${t.starred ? "ti-star-filled" : "ti-star"}`} aria-hidden="true" /></button>
          <input value={title ?? t.title} onChange={(e) => setTitle(e.target.value)} onBlur={() => { if (title != null && title.trim() && title !== t.title) void patch({ title: title.trim() }); setTitle(null); }}
            className="flex-1 rounded-md border border-transparent px-2 py-1 text-[22px] font-semibold text-slate-900 hover:border-slate-200 focus:border-indigo-400 focus:outline-none" />
        </div>
        <div className="grid gap-x-8 gap-y-1 p-4 text-[12.5px] sm:grid-cols-2">
          <Field label="Project"><Link href={`/admin/ir/projects/${p.id}`} className="text-indigo-700 hover:underline">{p.title}</Link></Field>
          <Field label="Milestone">{month?.label ?? "—"} · {week?.label ?? "—"}{week ? ` · ${formatRange(week.starts_on, week.ends_on)}` : ""}</Field>
          <Field label="Matching">{data.matches.length} investor{data.matches.length === 1 ? "" : "s"} this week</Field>
          <Field label="Assignee">
            <select value={t.assignee_id ?? ""} disabled={busy} onChange={(e) => patch({ assigneeId: e.target.value || null })} className="rounded-md border border-slate-200 px-2 py-0.5 text-[12px]"><option value="">Unassigned</option>{data.staff.map((s) => <option key={s.id} value={s.id}>{s.id === meId ? `${s.name} (me)` : s.name}</option>)}</select>
          </Field>
          <Field label="Deadline"><input type="date" value={t.deadline ?? ""} disabled={busy} onChange={(e) => patch({ deadline: e.target.value || null })} className="rounded-md border border-slate-200 px-2 py-0.5 text-[12px]" /></Field>
          <Field label="Open activities">{open.length}</Field>
        </div>

        <div className="flex gap-1 border-t border-slate-100 px-4">
          {([["agent", "Agent field"], ["subtasks", `Sub-tasks · ${data.activities.length}`], ["matching", `Matching · ${data.matches.length}`], ["meetings", `Meetings · ${data.activities.filter((a) => a.type === "meeting").length}`]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 py-2 text-[12.5px] font-medium ${tab === k ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{l}</button>
          ))}
        </div>
        <div className="p-4">
          {tab === "agent" ? <AgentField projectId={p.id} taskId={t.id} matches={data.matches} done={done} meId={meId} onChange={load} /> : null}
          {tab === "subtasks" ? (
            data.activities.length === 0 ? <p className="text-[12.5px] text-slate-400">No activities this week yet.</p> : (
              <table className="w-full text-[12.5px]"><thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1 pr-2 font-medium">Investor</th><th className="py-1 pr-2 font-medium">Activity</th><th className="py-1 pr-2 font-medium">When</th><th className="py-1 font-medium"></th></tr></thead>
                <tbody className="divide-y divide-slate-100">{[...open, ...done].map((a) => (
                  <tr key={a.id}><td className="py-1.5 pr-2">{a.match_id ? <Link href={`/admin/ir/matches/${a.match_id}`} className="text-indigo-700 hover:underline">{matchName(a.match_id)}</Link> : <span className="text-slate-500">Week</span>}</td>
                    <td className="py-1.5 pr-2"><i className={`ti ${IR_ACTIVITY_ICON[a.type]} text-slate-400`} aria-hidden="true" /> {a.subject}{a.outcome ? <span className="text-slate-500"> — {a.outcome}</span> : null}</td>
                    <td className="py-1.5 pr-2 text-slate-500">{a.done_at ? `done ${fmt(a.done_at)}` : a.due_at ? `due ${fmt(a.due_at)}` : "open"}</td>
                    <td className="py-1.5 text-right">{!a.done_at ? <button type="button" onClick={() => patchActivity(a.id, { done: true })} className="text-[11.5px] text-emerald-700 hover:underline">Mark done</button> : null}</td></tr>
                ))}</tbody></table>
            )
          ) : null}
          {tab === "matching" ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12px] text-slate-500">Investors matched in this week. The queue opens in this week&rsquo;s context so new matches land here.</p>
                <Link href={`${base}/${t.id}/matching`} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700">Add investors from matching queue</Link>
              </div>
              {data.matches.length === 0 ? <p className="text-[12.5px] text-slate-400">No investors on this week yet.</p> : (
                <table className="w-full text-[12.5px]"><thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1 pr-2 font-medium">Investor</th><th className="py-1 pr-2 font-medium">Firm</th><th className="py-1 pr-2 font-medium">Fit</th><th className="py-1 pr-2 font-medium">Stage</th><th className="py-1 pr-2 font-medium">Next activity</th><th></th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{data.matches.map((m) => { const nx = open.find((a) => a.match_id === m.id); return (
                    <tr key={m.id}><td className="py-1.5 pr-2 font-medium text-slate-900">{m.investor_name ?? "—"}</td><td className="py-1.5 pr-2 text-slate-600">{m.investor_firm ?? "—"}</td>
                      <td className="py-1.5 pr-2">{m.fit_tier ?? "—"}</td><td className="py-1.5 pr-2"><span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">{IR_STAGE_LABEL[m.stage]}</span></td>
                      <td className="py-1.5 pr-2 text-slate-600">{nx ? `${nx.subject}${nx.due_at ? ` · ${fmt(nx.due_at)}` : ""}` : "—"}</td>
                      <td className="py-1.5 text-right"><Link href={`/admin/ir/matches/${m.id}`} className="text-[11.5px] text-indigo-700 hover:underline">Open</Link></td></tr>); })}</tbody></table>
              )}
            </div>
          ) : null}
          {tab === "meetings" ? (
            (() => { const ms = data.activities.filter((a) => a.type === "meeting"); return ms.length === 0 ? <p className="text-[12.5px] text-slate-400">No meetings this week.</p> : (
              <ul className="divide-y divide-slate-100 text-[12.5px]">{ms.map((a) => <li key={a.id} className="flex gap-2 py-1.5"><span className="font-medium text-slate-900">{matchName(a.match_id)}</span><span className="flex-1 text-slate-600">{a.subject}</span><span className="text-slate-500">{a.done_at ? `held ${fmt(a.done_at)}` : `booked ${fmt(a.due_at)}`}</span></li>)}</ul>); })()
          ) : null}
        </div>
      </div>

      {/* Chatter: planned across the week's investors, then the log */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white">
        {open.length ? <div className="border-b border-slate-100 px-4 py-3"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Planned activities</p>
          <ul className="divide-y divide-slate-100 text-[12.5px]">{open.map((a) => <li key={a.id} className="flex items-center gap-2 py-1.5"><input type="checkbox" onChange={() => patchActivity(a.id, { done: true })} aria-label="Mark done" /><span className="font-medium text-slate-900">{matchName(a.match_id)}</span><span className="flex-1 text-slate-700">{a.subject}</span><span className={`text-[11px] ${a.due_at && new Date(a.due_at).getTime() < now ? "text-rose-600" : "text-slate-500"}`}>{a.due_at ? `due ${fmt(a.due_at)}` : ""}</span></li>)}</ul></div> : null}
        <div className="px-4 py-3"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Log</p>
          {done.length === 0 && data.notes.length === 0 ? <p className="text-[12.5px] text-slate-400">Nothing logged yet.</p> : (
            <ul className="divide-y divide-slate-100 text-[12.5px]">
              {[...done.map((a) => ({ at: a.done_at!, node: <><i className={`ti ${IR_ACTIVITY_ICON[a.type]} text-slate-400`} aria-hidden="true" /> <span className="font-medium text-slate-900">{matchName(a.match_id)}</span> · {a.subject}{a.outcome ? <span className="text-slate-500"> — {a.outcome}</span> : null}</>, who: a.created_by_name })),
                ...data.notes.map((n) => ({ at: n.created_at, node: <><i className="ti ti-note text-amber-500" aria-hidden="true" /> {n.body}</>, who: n.created_by_name }))]
                .sort((x, y) => y.at.localeCompare(x.at)).map((row, i) => <li key={i} className="flex gap-2 py-1.5"><span className="min-w-0 flex-1">{row.node}</span><span className="shrink-0 text-[11px] text-slate-500">{fmt(row.at)} · {row.who ?? "staff"}</span></li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex gap-3 py-1"><span className="w-32 shrink-0 text-slate-500">{label}</span><span className="min-w-0 flex-1 text-slate-800">{children}</span></div>;
}

/** Per-investor log entries plus a composer that picks the investor and writes a dated activity. */
function AgentField({ projectId, taskId, matches, done, meId, onChange }: { projectId: string; taskId: string; matches: IrMatch[]; done: IrActivity[]; meId: string; onChange: () => Promise<void> }) {
  const [matchId, setMatchId] = useState(matches[0]?.id ?? "");
  const [type, setType] = useState<IrActivityType>("call");
  const [subject, setSubject] = useState("");
  const [outcome, setOutcome] = useState("");
  const [when, setWhen] = useState(() => new Date().toISOString().slice(0, 16));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (!matchId && matches[0]) setMatchId(matches[0].id); }, [matches, matchId]); // eslint-disable-line react-hooks/set-state-in-effect

  async function log() {
    if (!subject.trim()) { setErr("Say what happened."); return; }
    setBusy(true); setErr(null);
    const r = await fetch("/api/admin/ir/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, taskId, matchId: matchId || null, type, subject: subject.trim(), outcome: outcome.trim() || null, done: true, doneAt: when ? new Date(when).toISOString() : null, assigneeId: meId }) });
    setBusy(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error ?? "Couldn't log."); return; }
    setSubject(""); setOutcome("");
    await onChange();
  }
  const byMatch = new Map<string | null, IrActivity[]>();
  for (const a of done) byMatch.set(a.match_id, [...(byMatch.get(a.match_id) ?? []), a]);

  return (
    <div>
      <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_130px_1fr]">
        <select value={matchId} onChange={(e) => setMatchId(e.target.value)} className={inp}><option value="">Week (no investor)</option>{matches.map((m) => <option key={m.id} value={m.id}>{m.investor_name ?? "Investor"}{m.investor_firm ? ` · ${m.investor_firm}` : ""}</option>)}</select>
        <select value={type} onChange={(e) => setType(e.target.value as IrActivityType)} className={inp}>{IR_ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{IR_ACTIVITY_LABEL[t]}</option>)}</select>
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inp} />
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What happened — e.g. Called, no answer (1st call)" className={`${inp} sm:col-span-2`} onKeyDown={(e) => { if (e.key === "Enter") void log(); }} />
        <input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Outcome (optional)" className={inp} />
        <div className="flex items-center gap-2 sm:col-span-3">{err ? <span className="text-[12px] text-rose-600">{err}</span> : null}<button type="button" disabled={busy} onClick={log} className="ml-auto rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? "Logging…" : "Log entry"}</button></div>
      </div>
      <div className="mt-3 space-y-3">
        {matches.map((m) => {
          const rows = byMatch.get(m.id) ?? [];
          return (
            <div key={m.id}>
              <p className="text-[12.5px] font-medium text-slate-900"><Link href={`/admin/ir/matches/${m.id}`} className="hover:text-indigo-700">{m.investor_name ?? "Investor"}</Link> <span className="text-slate-500">{m.investor_firm ?? ""}</span> <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10.5px] text-indigo-700">{IR_STAGE_LABEL[m.stage]}</span></p>
              {rows.length === 0 ? <p className="text-[11.5px] text-slate-400">No entries yet.</p> : <ul className="mt-0.5 text-[12px] text-slate-700">{rows.map((a) => <li key={a.id}><i className={`ti ${IR_ACTIVITY_ICON[a.type]} text-slate-400`} aria-hidden="true" /> {a.subject}{a.outcome ? ` — ${a.outcome}` : ""} <span className="text-slate-400">{fmt(a.done_at)}</span></li>)}</ul>}
            </div>
          );
        })}
        {byMatch.get(null)?.length ? <div><p className="text-[12.5px] font-medium text-slate-900">Week</p><ul className="text-[12px] text-slate-700">{byMatch.get(null)!.map((a) => <li key={a.id}>{a.subject} <span className="text-slate-400">{fmt(a.done_at)}</span></li>)}</ul></div> : null}
        {matches.length === 0 ? <p className="text-[12.5px] text-slate-400">Add investors from the Matching tab to start logging against them.</p> : null}
      </div>
    </div>
  );
}
