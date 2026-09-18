"use client";

/**
 * Share Project — one investor on one project, Odoo form layout: stage status bar, star,
 * name, fields (firm, project, milestone, assignee, deadline, data source, also matched,
 * founder visibility), tabs (Tasks, Meetings, Investor profile, History), and a chatter
 * (log note / schedule activity / planned activities / dated log). Phone and email never
 * appear here — the investor profile links to the Sales Hub contact instead.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatRange } from "@/lib/ir/milestones";
import { MeetingPanel } from "./MeetingPanel";
import { IR_ACTIVITY_ICON, IR_ACTIVITY_LABEL, IR_ACTIVITY_TYPES, IR_STAGES, IR_STAGE_LABEL, type IrActivity, type IrActivityType, type IrMatch, type IrNote, type IrProject, type IrStage } from "@/lib/ir/types";

type Payload = {
  match: IrMatch; project: IrProject; activities: IrActivity[]; notes: IrNote[];
  stageEvents: Array<{ from_stage: IrStage | null; to_stage: IrStage; changed_by: string | null; changed_at: string }>;
  alsoMatched: Array<{ match_id: string; project_id: string; project_title: string; stage: IrStage }>;
  staff: Array<{ id: string; name: string }>;
  investor: { id: string; name: string | null; firm: string | null; country: string | null; dataSource: string | null; verifiedAt: string | null; investorTypes: string[]; industries: string[] } | null;
};
type Tab = "tasks" | "meetings" | "investor" | "history";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const fmtDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-indigo-400 focus:outline-none";

export function MatchClient({ matchId, meId }: { matchId: string; meId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("tasks");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/ir/matches/${matchId}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? "Couldn't load the record."); return; }
    setData(j); setError(null);
  }, [matchId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set
  useEffect(() => { void load(); }, [load]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/ir/matches/${matchId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
  const nextDue = open[0]?.due_at ?? null;
  const meetings = useMemo(() => (data?.activities ?? []).filter((a) => a.type === "meeting"), [data]);

  if (error && !data) return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>;
  if (!data) return <p className="text-[13px] text-slate-400">Loading…</p>;
  const { match: m, project: p, investor } = data;
  const staffName = (id: string | null) => data.staff.find((s) => s.id === id)?.name ?? null;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
        <Link href="/admin/ir/projects" className="hover:text-indigo-700">Projects</Link><span>/</span>
        <Link href={`/admin/ir/projects/${p.id}`} className="hover:text-indigo-700">{p.title}</Link><span>/</span><span className="text-slate-800">{m.investor_name ?? "Investor"}</span>
        {error ? <span className="ml-auto text-rose-600">{error}</span> : null}
      </div>

      {/* Status bar */}
      <div className="mb-3 flex flex-wrap gap-0.5 overflow-x-auto">
        {IR_STAGES.map((s, i) => {
          const idx = IR_STAGES.indexOf(m.stage), active = s === m.stage, past = i < idx;
          return <button key={s} type="button" disabled={busy || active} onClick={() => patch({ stage: s })}
            className={`px-3 py-1.5 text-[11.5px] font-medium ${active ? "bg-indigo-600 text-white" : past ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100" : "bg-slate-100 text-slate-500 hover:bg-slate-200"} ${i === 0 ? "rounded-l-lg" : ""} ${i === IR_STAGES.length - 1 ? "rounded-r-lg" : ""}`}>
            {IR_STAGE_LABEL[s]}
          </button>;
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-start gap-3 border-b border-slate-100 p-4">
          <button type="button" onClick={() => patch({ starred: !m.starred })} aria-label="Star" className={`mt-1 text-[18px] ${m.starred ? "text-amber-500" : "text-slate-300 hover:text-amber-400"}`}><i className={`ti ${m.starred ? "ti-star-filled" : "ti-star"}`} aria-hidden="true" /></button>
          <div className="min-w-0 flex-1">
            <h2 className="text-[22px] font-semibold text-slate-900">{m.investor_name ?? "Investor"}</h2>
            <p className="text-[12.5px] text-slate-500">{m.investor_firm ?? "—"} · <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">{IR_STAGE_LABEL[m.stage]}</span>{m.term_sheet_received_at ? <span className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Term sheet {fmtDay(m.term_sheet_received_at)}</span> : null}</p>
          </div>
          <div className="flex gap-1">
            <button type="button" disabled={busy} onClick={() => patch({ termSheetReceivedAt: m.term_sheet_received_at ? null : new Date().toISOString() })} className="rounded-md border border-slate-200 px-2.5 py-1 text-[12px] text-slate-700 hover:bg-slate-50">{m.term_sheet_received_at ? "Clear term sheet" : "Term sheet received"}</button>
          </div>
        </div>

        <div className="grid gap-x-8 gap-y-1 p-4 text-[12.5px] sm:grid-cols-2">
          <Field label="Firm" value={m.investor_firm ?? "—"} />
          <Field label="Project"><Link href={`/admin/ir/projects/${p.id}`} className="text-indigo-700 hover:underline">{p.title}</Link></Field>
          <Field label="Term">{formatRange(p.start_date, p.end_date)}</Field>
          <Field label="Assignee">
            <select value={m.assignee_id ?? ""} disabled={busy} onChange={(e) => patch({ assigneeId: e.target.value || null })} className="rounded-md border border-slate-200 px-2 py-0.5 text-[12px]">
              <option value="">Unassigned</option>{data.staff.map((s) => <option key={s.id} value={s.id}>{s.id === meId ? `${s.name} (me)` : s.name}</option>)}
            </select>
          </Field>
          <Field label="Deadline" value={nextDue ? fmt(nextDue) : "No open activity"} />
          <Field label="Meeting" value={meetings.find((a) => !a.done_at)?.due_at ? fmt(meetings.find((a) => !a.done_at)!.due_at) : meetings.length ? `Last held ${fmtDay(meetings[0].done_at)}` : "None booked"} />
          <Field label="Data source" value={m.data_source === "verified" || investor?.dataSource === "verified" ? "Verified" : investor?.dataSource === "self_reported" ? "Self-reported" : "Unverified"} />
          <Field label="Fit tier" value={m.fit_tier ?? "—"} />
          <Field label="Also matched">{data.alsoMatched.length ? data.alsoMatched.map((a) => <Link key={a.match_id} href={`/admin/ir/matches/${a.match_id}`} className="mr-2 text-indigo-700 hover:underline">{a.project_title} · {IR_STAGE_LABEL[a.stage]}</Link>) : "—"}</Field>
          <Field label="Founder report"><label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={m.founder_visible} disabled={busy} onChange={(e) => patch({ founderVisible: e.target.checked })} /> visible to the founder</label></Field>
        </div>

        <div className="flex gap-1 border-t border-slate-100 px-4">
          {([["tasks", `Tasks · ${open.length}`], ["meetings", `Meetings · ${meetings.length}`], ["investor", "Investor profile"], ["history", "History"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 py-2 text-[12.5px] font-medium ${tab === k ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{l}</button>
          ))}
        </div>
        <div className="p-4">
          {tab === "tasks" ? (
            open.length === 0 ? <p className="text-[12.5px] text-slate-400">No open to-dos. Schedule one in the chatter below.</p> : (
              <ul className="divide-y divide-slate-100">{open.map((a) => <ActivityRow key={a.id} a={a} onDone={() => patchActivity(a.id, { done: true })} onVis={(v) => patchActivity(a.id, { founderVisible: v })} />)}</ul>
            )
          ) : null}
          {tab === "meetings" ? (
            <div>
              <MeetingPanel matchId={matchId} meId={meId} assigneeId={data.match.assignee_id} staff={data.staff} onChanged={load} />
              {meetings.length ? <><p className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Meeting history</p><ul className="divide-y divide-slate-100">{meetings.map((a) => <ActivityRow key={a.id} a={a} onDone={a.done_at || a.calendar_event_id ? undefined : () => patchActivity(a.id, { done: true })} onVis={(v) => patchActivity(a.id, { founderVisible: v })} />)}</ul></> : null}
            </div>
          ) : null}
          {tab === "investor" ? (
            <div className="grid gap-x-8 gap-y-1 text-[12.5px] sm:grid-cols-2">
              <Field label="Name" value={investor?.name ?? "—"} /><Field label="Firm" value={investor?.firm ?? "—"} />
              <Field label="Country" value={investor?.country ?? "—"} /><Field label="Data source" value={investor?.dataSource === "verified" ? `Verified ${fmtDay(investor.verifiedAt)}` : investor?.dataSource === "self_reported" ? "Self-reported" : "Unverified"} />
              <Field label="Investor profile" value={investor?.investorTypes.join(", ") || "—"} /><Field label="Industries" value={investor?.industries.join(", ") || "—"} />
              <div className="sm:col-span-2"><Link href={`/admin/sales/contacts/${m.investor_contact_id}`} className="text-[12.5px] text-indigo-700 hover:underline">Open in Sales Hub (phone / email there, permission-gated) →</Link></div>
            </div>
          ) : null}
          {tab === "history" ? (
            <ul className="text-[12.5px] text-slate-700">{data.stageEvents.map((e, i) => <li key={i} className="py-1">{fmt(e.changed_at)} · {e.from_stage ? `${IR_STAGE_LABEL[e.from_stage]} → ` : ""}{IR_STAGE_LABEL[e.to_stage]}{e.changed_by ? ` · ${staffName(e.changed_by) ?? "staff"}` : ""}</li>)}</ul>
          ) : null}
        </div>
      </div>

      <Chatter projectId={p.id} matchId={m.id} open={open} done={done} notes={data.notes} staff={data.staff} meId={meId} onChange={load} onDone={(a) => patchActivity(a.id, { done: true })} />
    </div>
  );
}

function Field({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return <div className="flex gap-3 py-1"><span className="w-32 shrink-0 text-slate-500">{label}</span><span className="min-w-0 flex-1 text-slate-800">{children ?? value}</span></div>;
}

function ActivityRow({ a, onDone, onVis }: { a: IrActivity; onDone?: () => void; onVis: (v: boolean) => void }) {
  // "Late" is decided against the time the row mounted; a stale minute is fine for a badge.
  const [now] = useState(() => Date.now());
  const late = !a.done_at && a.due_at && new Date(a.due_at).getTime() < now;
  return (
    <li className="flex items-start gap-2 py-2 text-[12.5px]">
      {onDone ? <input type="checkbox" onChange={onDone} className="mt-0.5" aria-label="Mark done" /> : <i className="ti ti-check mt-0.5 text-emerald-600" aria-hidden="true" />}
      <i className={`ti ${IR_ACTIVITY_ICON[a.type]} mt-0.5 text-slate-400`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="font-medium text-slate-900">{a.subject}</span>
        {a.description ? <span className="block text-slate-600">{a.description}</span> : null}
        {a.outcome ? <span className="block text-slate-500">Outcome: {a.outcome}</span> : null}
        {a.next_step ? <span className="block text-slate-500">Next: {a.next_step}</span> : null}
      </span>
      <span className={`shrink-0 text-[11px] ${late ? "text-rose-600" : "text-slate-500"}`}>{a.done_at ? `done ${fmt(a.done_at)}` : a.due_at ? `due ${fmt(a.due_at)}` : ""}</span>
      <label className="shrink-0 text-[10.5px] text-slate-400" title="Shown on the founder report"><input type="checkbox" checked={a.founder_visible} onChange={(e) => onVis(e.target.checked)} /> founder</label>
    </li>
  );
}

function Chatter({ projectId, matchId, open, done, notes, staff, meId, onChange, onDone }: { projectId: string; matchId: string; open: IrActivity[]; done: IrActivity[]; notes: IrNote[]; staff: Array<{ id: string; name: string }>; meId: string; onChange: () => Promise<void>; onDone: (a: IrActivity) => void }) {
  const [mode, setMode] = useState<"log" | "schedule" | "note">("log");
  const [type, setType] = useState<IrActivityType>("call");
  const [subject, setSubject] = useState("");
  const [desc, setDesc] = useState("");
  const [outcome, setOutcome] = useState("");
  const [next, setNext] = useState("");
  const [due, setDue] = useState("");
  const [assignee, setAssignee] = useState(meId);
  const [founderVisible, setFounderVisible] = useState(true);
  const [noteVisible, setNoteVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      if (mode === "note") {
        if (!desc.trim()) { setErr("Write the note."); return; }
        const r = await fetch("/api/admin/ir/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, matchId, body: desc.trim(), founderVisible: noteVisible }) });
        if (!r.ok) { setErr((await r.json().catch(() => ({}))).error ?? "Couldn't save."); return; }
      } else {
        if (!subject.trim()) { setErr("Give it a subject."); return; }
        if (mode === "schedule" && !due) { setErr("Pick a due date."); return; }
        const body = { projectId, matchId, type, subject: subject.trim(), description: desc.trim() || null, outcome: outcome.trim() || null, nextStep: next.trim() || null,
          dueAt: due ? new Date(due).toISOString() : null, done: mode === "log", founderVisible, assigneeId: assignee || null };
        const r = await fetch("/api/admin/ir/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) { setErr((await r.json().catch(() => ({}))).error ?? "Couldn't save."); return; }
      }
      setSubject(""); setDesc(""); setOutcome(""); setNext(""); setDue("");
      await onChange();
    } finally { setBusy(false); }
  }

  const timeline = [
    ...done.map((a) => ({ kind: "activity" as const, at: a.done_at!, a })),
    ...notes.map((n) => ({ kind: "note" as const, at: n.created_at, n })),
  ].sort((x, y) => y.at.localeCompare(x.at));

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white">
      <div className="flex gap-1 border-b border-slate-100 px-4 pt-2">
        {([["log", "Log activity"], ["schedule", "Schedule activity"], ["note", "Log note"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setMode(k)} className={`-mb-px border-b-2 px-3 py-2 text-[12.5px] font-medium ${mode === k ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{l}</button>
        ))}
      </div>
      <div className="p-4">
        {mode !== "note" ? (
          <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
            <select value={type} onChange={(e) => setType(e.target.value as IrActivityType)} className={inp}>{IR_ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{IR_ACTIVITY_LABEL[t]}</option>)}</select>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={mode === "log" ? "What happened — e.g. Second call attempt" : "What to do — e.g. Send deck before meeting"} className={inp} />
            <div className="sm:col-span-2"><textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Details (founder-readable when visible)" className={inp} /></div>
            {mode === "log" ? <><input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Outcome — e.g. No answer, voicemail left" className={inp} /><input value={next} onChange={(e) => setNext(e.target.value)} placeholder="Next step" className={inp} /></> : null}
            <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={inp} title={mode === "log" ? "When it happened (optional)" : "Due"} />
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inp}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.id === meId ? `${s.name} (me)` : s.name}</option>)}</select>
          </div>
        ) : (
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Internal note. Tick the box to show it on the founder report." className={inp} />
        )}
        <div className="mt-2 flex items-center gap-3">
          {mode === "note"
            ? <label className="text-[12px] text-slate-600"><input type="checkbox" checked={noteVisible} onChange={(e) => setNoteVisible(e.target.checked)} /> Show on founder report</label>
            : <label className="text-[12px] text-slate-600"><input type="checkbox" checked={founderVisible} onChange={(e) => setFounderVisible(e.target.checked)} /> Founder-visible</label>}
          {err ? <span className="text-[12px] text-rose-600">{err}</span> : null}
          <button type="button" disabled={busy} onClick={submit} className="ml-auto rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? "Saving…" : mode === "log" ? "Log" : mode === "schedule" ? "Schedule" : "Save note"}</button>
        </div>
      </div>

      {open.length ? (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Planned activities</p>
          <ul className="divide-y divide-slate-100">{open.map((a) => <ActivityRow key={a.id} a={a} onDone={() => onDone(a)} onVis={() => {}} />)}</ul>
        </div>
      ) : null}
      <div className="border-t border-slate-100 px-4 py-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Log</p>
        {timeline.length === 0 ? <p className="text-[12.5px] text-slate-400">Nothing logged yet.</p> : (
          <ul className="divide-y divide-slate-100">
            {timeline.map((t) => t.kind === "activity" ? (
              <li key={`a-${t.a.id}`} className="flex gap-2 py-2 text-[12.5px]">
                <i className={`ti ${IR_ACTIVITY_ICON[t.a.type]} mt-0.5 text-slate-400`} aria-hidden="true" />
                <span className="min-w-0 flex-1"><span className="font-medium text-slate-900">{t.a.subject}</span>{t.a.description ? <span className="block text-slate-600">{t.a.description}</span> : null}{t.a.outcome ? <span className="block text-slate-500">Outcome: {t.a.outcome}</span> : null}{t.a.next_step ? <span className="block text-slate-500">Next: {t.a.next_step}</span> : null}</span>
                <span className="shrink-0 text-[11px] text-slate-500">{fmt(t.at)} · {t.a.created_by_name ?? "staff"}{t.a.founder_visible ? "" : " · internal"}</span>
              </li>
            ) : (
              <li key={`n-${t.n.id}`} className="flex gap-2 py-2 text-[12.5px]">
                <i className="ti ti-note mt-0.5 text-amber-500" aria-hidden="true" />
                <span className="min-w-0 flex-1 whitespace-pre-wrap text-slate-700">{t.n.body}</span>
                <span className="shrink-0 text-[11px] text-slate-500">{fmt(t.at)} · {t.n.created_by_name ?? "staff"}{t.n.founder_visible ? " · on report" : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
