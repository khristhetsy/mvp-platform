"use client";

/**
 * Share Project — one investor on one project, Odoo form layout: stage status bar, star,
 * name, fields (firm, project, milestone, assignee, deadline, data source, also matched,
 * founder visibility), tabs (Tasks, Meetings, Investor profile, History), and a chatter
 * (log note / schedule activity / planned activities / dated log). Phone and email never
 * appear here — the investor profile links to the Sales Hub contact instead.
 *
 * "Send email" / "Send one-pager" open a composer that sends with iCapOS or the sender's
 * Gmail (the address is resolved on the server) and logs a done Email activity.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { OdooStageBar } from "@/components/ui/OdooStageBar";
import Link from "next/link";
import { formatRange } from "@/lib/ir/milestones";
import { MeetingPanel } from "./MeetingPanel";
import { SequencePanel } from "./SequencePanel";
import { BlockersPanel, EntrepreneurTab, MessageComposer } from "../../_shared/RecordPanels";
import type { EntrepreneurProfile } from "@/lib/ir/db";
import { IR_ACTIVITY_ICON, IR_ACTIVITY_LABEL, IR_ACTIVITY_TYPES, IR_STAGES, IR_STAGE_LABEL, type IrActivity, type IrActivityType, type IrBlocker, type IrMatch, type IrNote, type IrProject, type IrStage } from "@/lib/ir/types";
import { useRouter } from "next/navigation";

type Payload = {
  match: IrMatch; project: IrProject; activities: IrActivity[]; notes: IrNote[];
  stageEvents: Array<{ from_stage: IrStage | null; to_stage: IrStage; changed_by: string | null; changed_at: string }>;
  alsoMatched: Array<{ match_id: string; project_id: string; project_title: string; stage: IrStage }>;
  staff: Array<{ id: string; name: string }>;
  entrepreneur: EntrepreneurProfile | null;
  siblings: Array<{ id: string; name: string }>;
  investor: { id: string; name: string | null; firm: string | null; country: string | null; dataSource: string | null; verifiedAt: string | null; investorTypes: string[]; industries: string[] } | null;
  send: { hasEmail: boolean; onePagerUrl: string | null };
};
type Tab = "tasks" | "meetings" | "blocked" | "investor" | "founder" | "history";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const fmtDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-indigo-400 focus:outline-none";

export function MatchClient({ matchId, meId }: { matchId: string; meId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("tasks");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [introOpen, setIntroOpen] = useState(false);
  const [introNote, setIntroNote] = useState("");
  const [compose, setCompose] = useState<null | { onePager: boolean }>(null);
  const [seqOpen, setSeqOpen] = useState(false);
  const router = useRouter();

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

  async function termSheetSent() {
    setBusy(true); setError(null);
    const r = await fetch(`/api/admin/ir/matches/${matchId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "term_sheet_sent" }) });
    setBusy(false);
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error ?? "Couldn't log the term sheet."); return; }
    setNotice("Term sheet logged as sent.");
    await load();
  }

  async function introSent() {
    setBusy(true); setError(null);
    const r = await fetch(`/api/admin/ir/matches/${matchId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "intro_sent", note: introNote.trim() || null }) });
    setBusy(false);
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error ?? "Couldn't log the intro email."); return; }
    setIntroOpen(false); setIntroNote(""); setNotice("Intro email logged as sent — stage is Intro sent.");
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
        {error ? <span className="text-rose-600">{error}</span> : null}{notice ? <span className="text-emerald-700">{notice}</span> : null}
        <span className="ml-auto flex items-center gap-1.5">
          <button type="button" disabled={busy} onClick={() => setTab("meetings")} className="rounded-md bg-indigo-600 px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">Book meeting</button>
          <button type="button" disabled={busy} onClick={() => { setIntroOpen(false); setCompose(compose && !compose.onePager ? null : { onePager: false }); }} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[12px] text-slate-700 hover:bg-slate-50 disabled:opacity-60">{m.stage === "matched" ? "Send intro email" : "Send email"}</button>
          <button type="button" disabled={busy} onClick={() => { setCompose(null); setIntroOpen(false); setSeqOpen((v) => !v); }} className="rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-[12px] text-indigo-800 hover:bg-indigo-50 disabled:opacity-60"><i className="ti ti-bolt" aria-hidden="true" /> Auto sequence</button>
          {data.send.onePagerUrl ? <button type="button" disabled={busy} onClick={() => { setIntroOpen(false); setCompose(compose?.onePager ? null : { onePager: true }); }} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[12px] text-slate-700 hover:bg-slate-50 disabled:opacity-60"><i className="ti ti-file-text" aria-hidden="true" /> Send one-pager</button> : null}
          {(() => { const i = data.siblings.findIndex((x) => x.id === matchId); const prev = i > 0 ? data.siblings[i - 1] : null; const next = i >= 0 && i < data.siblings.length - 1 ? data.siblings[i + 1] : null; return <>
            <span className="ml-2 text-slate-500">{i >= 0 ? i + 1 : "–"} / {data.siblings.length}</span>
            <button type="button" disabled={!prev} onClick={() => prev && router.push(`/admin/ir/matches/${prev.id}`)} aria-label="Previous record" title={prev?.name} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-700 hover:bg-slate-50 disabled:opacity-40">‹</button>
            <button type="button" disabled={!next} onClick={() => next && router.push(`/admin/ir/matches/${next.id}`)} aria-label="Next record" title={next?.name} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-700 hover:bg-slate-50 disabled:opacity-40">›</button>
          </>; })()}
        </span>
      </div>
      <SequencePanel matchId={matchId} stage={m.stage} staff={data.staff} meId={meId} defaultManager={m.assignee_id ?? p.owner_id} onePagerUrl={data.send.onePagerUrl} open={seqOpen} onClose={() => setSeqOpen(false)} onChange={load} />
      {compose ? <EmailComposer key={compose.onePager ? "op" : "mail"} matchId={matchId} investorName={m.investor_name ?? m.investor_firm ?? "the investor"} founder={p.founder_name ?? p.title} stage={m.stage}
        hasEmail={data.send.hasEmail} onePagerUrl={data.send.onePagerUrl} onePager={compose.onePager} investorContactId={m.investor_contact_id}
        onLogInstead={() => { setCompose(null); setIntroOpen(true); }} onClose={() => setCompose(null)} onSent={async (msg) => { setCompose(null); setNotice(msg); await load(); }} /> : null}
      {introOpen ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[12.5px]">
          <span className="text-indigo-900">Mark the intro email as sent from your mailbox — the &ldquo;Send intro email&rdquo; to-do is completed and the stage moves to Intro sent.</span>
          <input value={introNote} onChange={(e) => setIntroNote(e.target.value)} placeholder="Note (optional) — e.g. Sent deck v3" className="min-w-[220px] flex-1 rounded-md border border-indigo-200 bg-white px-2 py-1 text-[12px]" />
          <button type="button" disabled={busy} onClick={introSent} className="rounded-md bg-indigo-600 px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">Confirm</button>
          <button type="button" onClick={() => setIntroOpen(false)} className="text-[12px] text-slate-500 hover:text-slate-800">Cancel</button>
        </div>
      ) : null}

      {/* Status bar */}
      <OdooStageBar className="mb-3" steps={IR_STAGES.map((s) => ({ key: s, label: IR_STAGE_LABEL[s] }))} current={m.stage} onSelect={(s) => void patch({ stage: s as typeof m.stage })} disabled={busy} />

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-start gap-3 border-b border-slate-100 p-4">
          <button type="button" onClick={() => patch({ starred: !m.starred })} aria-label="Star" className={`mt-1 text-[18px] ${m.starred ? "text-amber-500" : "text-slate-300 hover:text-amber-400"}`}><i className={`ti ${m.starred ? "ti-star-filled" : "ti-star"}`} aria-hidden="true" /></button>
          <div className="min-w-0 flex-1">
            <h2 className="text-[22px] font-semibold text-slate-900">{m.investor_name ?? "Investor"}</h2>
            <p className="text-[12.5px] text-slate-500">{m.investor_firm ?? "—"} · <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">{IR_STAGE_LABEL[m.stage]}</span>{m.term_sheet_received_at ? <span className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Term sheet {fmtDay(m.term_sheet_received_at)}</span> : null}</p>
          </div>
          <div className="flex gap-1">
            <button type="button" disabled={busy} onClick={termSheetSent} className="rounded-md border border-slate-200 px-2.5 py-1 text-[12px] text-slate-700 hover:bg-slate-50 disabled:opacity-60"><i className="ti ti-file-certificate" aria-hidden="true" /> Term sheet sent</button>
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
          {([["tasks", `Tasks · ${open.length}`], ["meetings", `Meetings · ${meetings.length}`], ["blocked", `Blocked by${m.blockers.filter((b) => !b.cleared_at).length ? ` · ${m.blockers.filter((b) => !b.cleared_at).length}` : ""}`], ["investor", "Investor profile"], ["founder", "Entrepreneur profile"], ["history", "History"]] as const).map(([k, l]) => (
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
          {tab === "blocked" ? <BlockersPanel blockers={m.blockers ?? []} dealTitle={p.title} busy={busy} onChange={(next: IrBlocker[]) => patch({ blockers: next })} /> : null}
          {tab === "founder" ? <EntrepreneurTab e={data.entrepreneur} onSaved={load} /> : null}
          {tab === "investor" ? (
            <div className="grid gap-x-8 gap-y-1 text-[12.5px] sm:grid-cols-2">
              <Field label="Name" value={investor?.name ?? "—"} /><Field label="Firm" value={investor?.firm ?? "—"} />
              <Field label="Country" value={investor?.country ?? "—"} /><Field label="Data source" value={investor?.dataSource === "verified" ? `Verified ${fmtDay(investor.verifiedAt)}` : investor?.dataSource === "self_reported" ? "Self-reported" : "Unverified"} />
              <Field label="Investor profile" value={investor?.investorTypes.join(", ") || "—"} /><Field label="Industry" value={investor?.industries.join(", ") || "—"} />
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
  const [mode, setMode] = useState<"message" | "log" | "schedule" | "note">("log");
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
        {([["message", "Send message"], ["log", "Log activity"], ["schedule", "Schedule activity"], ["note", "Log note"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setMode(k)} className={`-mb-px border-b-2 px-3 py-2 text-[12.5px] font-medium ${mode === k ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{l}</button>
        ))}
      </div>
      <div className="p-4">
        {mode === "message" ? <MessageComposer endpoint={`/api/admin/ir/matches/${matchId}`} onSent={onChange} /> : null}
        {mode !== "note" && mode !== "message" ? (
          <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
            <select value={type} onChange={(e) => setType(e.target.value as IrActivityType)} className={inp}>{IR_ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{IR_ACTIVITY_LABEL[t]}</option>)}</select>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={mode === "log" ? "What happened — e.g. Second call attempt" : "What to do — e.g. Send deck before meeting"} className={inp} />
            <div className="sm:col-span-2"><textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Details (founder-readable when visible)" className={inp} /></div>
            {mode === "log" ? <><input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Outcome — e.g. No answer, voicemail left" className={inp} /><input value={next} onChange={(e) => setNext(e.target.value)} placeholder="Next step" className={inp} /></> : null}
            <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={inp} title={mode === "log" ? "When it happened (optional)" : "Due"} />
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inp}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.id === meId ? `${s.name} (me)` : s.name}</option>)}</select>
          </div>
        ) : mode === "note" ? (
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Internal note. Tick the box to show it on the founder report." className={inp} />
        ) : null}
        {mode !== "message" ? <div className="mt-2 flex items-center gap-3">
          {mode === "note"
            ? <label className="text-[12px] text-slate-600"><input type="checkbox" checked={noteVisible} onChange={(e) => setNoteVisible(e.target.checked)} /> Show on founder report</label>
            : <label className="text-[12px] text-slate-600"><input type="checkbox" checked={founderVisible} onChange={(e) => setFounderVisible(e.target.checked)} /> Founder-visible</label>}
          {err ? <span className="text-[12px] text-rose-600">{err}</span> : null}
          <button type="button" disabled={busy} onClick={submit} className="ml-auto rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? "Saving…" : mode === "log" ? "Log" : mode === "schedule" ? "Schedule" : "Save note"}</button>
        </div> : null}
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
                <i className={`ti ${t.n.body.startsWith("Message · ") ? "ti-message-circle text-indigo-500" : "ti-note text-amber-500"} mt-0.5`} aria-hidden="true" />
                <span className="min-w-0 flex-1 whitespace-pre-wrap text-slate-700">{t.n.body.startsWith("Message · ") ? t.n.body.slice(10) : t.n.body}</span>
                <span className="shrink-0 text-[11px] text-slate-500">{fmt(t.at)} · {t.n.created_by_name ?? "staff"}{t.n.founder_visible ? " · on report" : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const VIA_KEY = "ir.send.via";

/** Composer for emailing the investor. Sends with iCapOS or the sender's Gmail; the choice is remembered in this browser. */
function EmailComposer({ matchId, investorName, founder, stage, hasEmail, onePagerUrl, onePager, investorContactId, onLogInstead, onClose, onSent }: {
  matchId: string; investorName: string; founder: string; stage: IrStage; hasEmail: boolean; onePagerUrl: string | null; onePager: boolean; investorContactId: string;
  onLogInstead: () => void; onClose: () => void; onSent: (msg: string) => Promise<void>;
}) {
  const first = investorName.split(/\s+/)[0];
  const [subject, setSubject] = useState(onePager ? `${founder}: one-pager` : stage === "matched" ? `Introduction: ${founder}` : `Following up: ${founder}`);
  const [body, setBody] = useState(onePager
    ? `Hi ${first},\n\nHere is the one-pager for ${founder}. Happy to set up a call if it fits your thesis.\n\nBest,`
    : stage === "matched" ? `Hi ${first},\n\nI'd like to introduce you to ${founder}. Would you be open to a 20 minute call next week?\n\nBest,` : `Hi ${first},\n\nFollowing up on ${founder}. Happy to share more or set up a call.\n\nBest,`);
  const [withOnePager, setWithOnePager] = useState(onePager && !!onePagerUrl);
  const [via, setVia] = useState<"icapos" | "gmail">(() => { try { return window.localStorage.getItem(VIA_KEY) === "gmail" ? "gmail" : "icapos"; } catch { return "icapos"; } });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  function pickVia(v: "icapos" | "gmail") { setVia(v); try { window.localStorage.setItem(VIA_KEY, v); } catch { /* ignore */ } }

  async function send() {
    setBusy(true); setErr(null);
    const r = await fetch(`/api/admin/ir/matches/${matchId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send_email", subject, body, via, includeOnePager: withOnePager }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? "Couldn't send the email."); return; }
    await onSent(`Email sent to ${investorName} with ${via === "gmail" ? "Gmail" : "iCapOS"}${j.onePager ? ", one-pager linked" : ""}. Logged in the chatter.`);
  }

  return (
    <div className="mb-3 rounded-xl border border-indigo-200 bg-white p-4 text-[12.5px] shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-[14px] font-semibold text-slate-900">{onePager ? "Send one-pager" : "Email"} to {investorName}</p>
        <button type="button" onClick={onClose} aria-label="Close" className="ml-auto text-slate-400 hover:text-slate-700"><i className="ti ti-x" aria-hidden="true" /></button>
      </div>
      {!hasEmail ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">This investor has no email on file. <Link href={`/admin/sales/contacts/${investorContactId}`} className="font-medium underline">Add one on their Sales Hub contact</Link>, then send from here.</p>
      ) : (
        <>
          <label className="mb-1 block text-[11.5px] text-slate-500" htmlFor="ir-mail-subject">Subject</label>
          <input id="ir-mail-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={inp} />
          <label className="mb-1 mt-2 block text-[11.5px] text-slate-500" htmlFor="ir-mail-body">Message</label>
          <textarea id="ir-mail-body" value={body} onChange={(e) => setBody(e.target.value)} rows={7} className={inp} />
          {onePagerUrl ? (
            <label className="mt-2 flex items-center gap-2 text-slate-700"><input type="checkbox" checked={withOnePager} onChange={(e) => setWithOnePager(e.target.checked)} /> Include the founder&rsquo;s one-pager link <a href={onePagerUrl} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">preview</a></label>
          ) : <p className="mt-2 text-slate-500">The founder&rsquo;s one-pager isn&rsquo;t published, so it can&rsquo;t be linked yet.</p>}
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">Send with</p>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Send with">
              {([["icapos", "iCapOS", "From the verified iCapOS address; replies come to you"], ["gmail", "Gmail", "From your own connected Gmail"]] as const).map(([k, l, d]) => (
                <button key={k} type="button" role="radio" aria-checked={via === k} onClick={() => pickVia(k)} className={`rounded-lg border px-3 py-2 text-left ${via === k ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                  <span className="block text-[12.5px] font-semibold text-slate-900">{l}</span><span className="block text-[11px] text-slate-500">{d}</span>
                </button>
              ))}
            </div>
          </div>
          {err ? <p className="mt-2 text-rose-600">{err}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy || !subject.trim() || !body.trim()} onClick={() => void send()} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? "Sending…" : `Send with ${via === "gmail" ? "Gmail" : "iCapOS"}`}</button>
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50">Discard</button>
            {stage === "matched" ? <button type="button" onClick={onLogInstead} className="ml-auto text-[12px] text-slate-500 hover:text-indigo-700 hover:underline">Already sent it from your mailbox? Log it instead</button> : null}
          </div>
        </>
      )}
    </div>
  );
}
