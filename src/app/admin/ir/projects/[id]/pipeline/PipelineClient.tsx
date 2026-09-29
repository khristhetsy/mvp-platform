"use client";

/**
 * Pipeline — kanban across the 8 stages (Passed folded), milestone strip on top, filters
 * by assignee / late tasks. Cards: investor, firm, next meeting, up to two open to-dos
 * with checkboxes, assignee, open count. Drag between columns writes a stage change
 * (the DB trigger records the event). "Add matches" confirms investors onto the project.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { HScrollBoard } from "@/components/admin/HScrollBoard";
import { formatRange } from "@/lib/ir/milestones";
import { IR_STAGES, IR_STAGE_LABEL, type IrActivity, type IrMatch, type IrMilestone, type IrProject, type IrStage } from "@/lib/ir/types";

type Payload = { project: IrProject; milestones: IrMilestone[]; matches: IrMatch[]; tasks: Array<{ id: string; title: string }>; openActivities: IrActivity[]; staff: Array<{ id: string; name: string }>; stageEvents: Array<{ match_id: string; to_stage: IrStage; changed_at: string }> };

const STAGE_ACCENT: Record<IrStage, string> = { matched: "#94A3B8", intro_sent: "#60A5FA", contacted: "#3B82F6", meeting_scheduled: "#8B5CF6", meeting_held: "#6366F1", follow_up: "#F59E0B", committed: "#16A34A", passed: "#CBD5E1" };
const fmtDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
const initials = (n: string | null | undefined) => (n ?? "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export function PipelineClient({ projectId, meId, openAdd }: { projectId: string; meId: string; openAdd: boolean }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assignee, setAssignee] = useState<string>("");
  const [lateOnly, setLateOnly] = useState(false);
  const [showPassed, setShowPassed] = useState(false);
  const [view, setView] = useState<"board" | "list" | "timeline">("board");
  const [adding, setAdding] = useState(openAdd);
  const [dragging, setDragging] = useState<IrMatch | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/ir/projects/${projectId}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? "Couldn't load the project."); return; }
    setData(j); setError(null);
  }, [projectId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set
  useEffect(() => { void load(); }, [load]);

  const [now] = useState(() => Date.now());
  const openByMatch = useMemo(() => {
    const m = new Map<string, IrActivity[]>();
    for (const a of data?.openActivities ?? []) if (a.match_id) m.set(a.match_id, [...(m.get(a.match_id) ?? []), a]);
    for (const list of m.values()) list.sort((a, b) => (a.due_at ?? "9").localeCompare(b.due_at ?? "9"));
    return m;
  }, [data]);
  const isLate = (a: IrActivity) => Boolean(a.due_at && new Date(a.due_at).getTime() < now);
  const lateTotal = useMemo(() => (data?.openActivities ?? []).filter(isLate).length, [data, now]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => (data?.matches ?? []).filter((m) => {
    if (assignee && m.assignee_id !== assignee) return false;
    if (lateOnly && !(openByMatch.get(m.id) ?? []).some(isLate)) return false;
    return true;
  }), [data, assignee, lateOnly, openByMatch]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = new Date().toISOString().slice(0, 10);
  const months = (data?.milestones ?? []).filter((m) => m.kind === "month");
  const weeks = (data?.milestones ?? []).filter((m) => m.kind === "week");
  const curMonth = months.find((m) => m.starts_on <= today && today < m.ends_on) ?? null;
  const curWeek = weeks.find((m) => m.starts_on <= today && today < m.ends_on) ?? null;

  async function setStage(matchId: string, stage: IrStage) {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/ir/matches/${matchId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); setError(j.error ?? "Couldn't move the record."); }
      await load();
    } finally { setBusy(false); }
  }
  async function complete(activity: IrActivity) {
    await fetch(`/api/admin/ir/activities/${activity.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: true }) });
    await load();
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  function onDragStart(e: DragStartEvent) { setDragging((data?.matches ?? []).find((m) => m.id === e.active.id) ?? null); }
  function onDragEnd(e: DragEndEvent) {
    const m = dragging; setDragging(null);
    const to = e.over?.id as IrStage | undefined;
    if (m && to && IR_STAGES.includes(to) && to !== m.stage) void setStage(m.id, to);
  }

  if (error && !data) return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>;
  if (!data) return <p className="text-[13px] text-slate-400">Loading…</p>;
  const p = data.project;
  const columns = showPassed ? IR_STAGES : IR_STAGES.filter((s) => s !== "passed");
  const passedCount = visible.filter((m) => m.stage === "passed").length;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
        <Link href="/admin/ir/projects" className="hover:text-indigo-700">Projects</Link><span>/</span><Link href={`/admin/ir/projects/${projectId}`} className="hover:text-indigo-700">{p.title}</Link><span>/</span><span className="text-slate-800">Pipeline</span>
        <span className="ml-auto flex gap-1">
          <span className="mr-1 flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="View">{(["board", "list", "timeline"] as const).map((v) => <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className={`rounded-md px-2.5 py-0.5 text-[12px] font-medium ${view === v ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"}`}>{v === "board" ? "Board" : v === "list" ? "List" : "Timeline"}</button>)}</span>
          <Link href={`/admin/ir/projects/${projectId}/tasks`} className="rounded-md border border-slate-200 px-2.5 py-1 text-[12px] text-slate-700 hover:bg-slate-50">Tasks</Link>
          <Link href={`/admin/ir/projects/${projectId}/report`} className="rounded-md border border-slate-200 px-2.5 py-1 text-[12px] text-slate-700 hover:bg-slate-50">Founder report</Link>
          <button type="button" onClick={() => setAdding(true)} className="rounded-md bg-indigo-600 px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-indigo-700">Add matches</button>
        </span>
      </div>
      <h2 className="text-[22px] font-semibold text-slate-900">{p.title}</h2>
      <p className="text-[12.5px] text-slate-500">{p.founder_name ? `${p.founder_name} · ` : ""}Owner {p.owner_name ?? "—"} · {formatRange(p.start_date, p.end_date)} · {data.matches.length} matches{lateTotal ? <> · <span className="text-rose-600">{lateTotal} late tasks</span></> : null}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-[12px] text-slate-600">Assignee
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="ml-1 rounded-md border border-slate-200 px-2 py-1 text-[12px]"><option value="">Everyone</option>{data.staff.map((s) => <option key={s.id} value={s.id}>{s.id === meId ? "Me" : s.name}</option>)}</select>
        </label>
        <label className="inline-flex items-center gap-1.5 text-[12px] text-slate-600"><input type="checkbox" checked={lateOnly} onChange={(e) => setLateOnly(e.target.checked)} /> Late tasks only</label>
        <label className="inline-flex items-center gap-1.5 text-[12px] text-slate-600"><input type="checkbox" checked={showPassed} onChange={(e) => setShowPassed(e.target.checked)} /> Show passed ({passedCount})</label>
        {error ? <span className="text-[12px] text-rose-600">{error}</span> : null}
      </div>

      {/* Milestone strip */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {months.map((m) => {
          const done = m.ends_on <= today, active = curMonth?.id === m.id;
          return <span key={m.id} title={formatRange(m.starts_on, m.ends_on)} className={`rounded-full px-2.5 py-0.5 text-[11px] ${active ? "bg-indigo-600 font-semibold text-white" : done ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            {m.label}{done && !active ? " done" : ""}{active && curWeek ? ` · ${curWeek.label} of ${weeks.length}` : ""}
          </span>;
        })}
      </div>

      {view === "list" ? <ListView rows={visible.filter((m) => showPassed || m.stage !== "passed")} open={openByMatch} isLate={isLate} /> : null}
      {view === "timeline" ? <TimelineView rows={visible.filter((m) => showPassed || m.stage !== "passed")} weeks={weeks} events={data.stageEvents ?? []} /> : null}
      <div className={`mt-4 ${view === "board" ? "" : "hidden"}`}>
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <HScrollBoard>
            {columns.map((stage) => {
              const cards = visible.filter((m) => m.stage === stage);
              return <Column key={stage} stage={stage} count={cards.length}>
                {cards.map((m) => <Card key={m.id} match={m} open={openByMatch.get(m.id) ?? []} isLate={isLate} onComplete={complete} busy={busy} />)}
              </Column>;
            })}
          </HScrollBoard>
          <DragOverlay>{dragging ? <div className="w-[256px] rounded-lg border border-indigo-300 bg-white p-2.5 shadow-lg"><p className="text-[13px] font-medium text-slate-900">{dragging.investor_name ?? "Investor"}</p><p className="text-[11.5px] text-slate-500">{dragging.investor_firm ?? ""}</p></div> : null}</DragOverlay>
        </DndContext>
      </div>

      {adding ? <AddMatches projectId={projectId} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); void load(); }} /> : null}
    </div>
  );
}

function Column({ stage, count, children }: { stage: IrStage; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div ref={setNodeRef} style={{ flex: "0 0 272px", minWidth: 272 }} className={`rounded-xl border bg-slate-50 p-2 ${isOver ? "border-indigo-400 bg-indigo-50/40" : "border-slate-200"}`}>
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-[12.5px] font-semibold text-slate-800">{IR_STAGE_LABEL[stage]}</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200">{count}</span>
      </div>
      <div className="mb-2 h-[3px] rounded" style={{ background: STAGE_ACCENT[stage] }} />
      <div className="flex min-h-[60px] flex-col gap-2">{children}</div>
    </div>
  );
}

function Card({ match: m, open, isLate, onComplete, busy }: { match: IrMatch; open: IrActivity[]; isLate: (a: IrActivity) => boolean; onComplete: (a: IrActivity) => void; busy: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: m.id });
  const meeting = open.find((a) => a.type === "meeting");
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={`rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm ${isDragging ? "opacity-40" : ""}`}>
      <div className="flex items-start gap-1.5">
        <Link href={`/admin/ir/matches/${m.id}`} className="min-w-0 flex-1" onPointerDown={(e) => e.stopPropagation()}>
          <p className="truncate text-[13px] font-medium text-slate-900 hover:text-indigo-700">{m.investor_name ?? "Investor"}</p>
          <p className="truncate text-[11.5px] text-slate-500">{m.investor_firm ?? "—"}</p>
        </Link>
        {m.starred ? <i className="ti ti-star-filled text-amber-500" aria-hidden="true" /> : null}
        {m.fit_tier ? <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${m.fit_tier === "high" ? "bg-emerald-50 text-emerald-700" : m.fit_tier === "medium" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{m.fit_tier}</span> : null}
      </div>
      {meeting ? <p className="mt-1 text-[11px] text-violet-700"><i className="ti ti-calendar-event" aria-hidden="true" /> {meeting.subject}{meeting.due_at ? ` · ${fmtDay(meeting.due_at)}` : ""}</p> : null}
      {open.slice(0, 2).map((a) => (
        <label key={a.id} className={`mt-1 flex items-start gap-1.5 text-[11.5px] ${isLate(a) ? "text-rose-700" : "text-slate-700"}`} onPointerDown={(e) => e.stopPropagation()}>
          <input type="checkbox" disabled={busy} onChange={() => onComplete(a)} className="mt-0.5" />
          <span className="min-w-0 flex-1 truncate">{a.subject}</span>
          {a.due_at ? <span className="shrink-0 text-[10.5px]">{fmtDay(a.due_at)}</span> : null}
        </label>
      ))}
      <div className="mt-2 flex items-center justify-between text-[10.5px] text-slate-500">
        <span>{open.length ? `${open.length} open` : "no open tasks"}</span>
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[9px] font-semibold text-slate-700" title={m.assignee_name ?? ""}>{initials(m.assignee_name)}</span>
      </div>
    </div>
  );
}

function AddMatches({ projectId, onClose, onAdded }: { projectId: string; onClose: () => void; onAdded: () => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Array<{ id: string; name: string | null; firm: string | null; dataSource: string | null; alsoOn: string[]; onThisProject: boolean }>>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears results when the query is too short
    if (q.trim().length < 2) { setRows([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/admin/ir/investors?q=${encodeURIComponent(q.trim())}&project=${projectId}`).then((r) => r.json()).then((j) => setRows(j.investors ?? [])).catch(() => {});
    }, 250);
    // (setRows above runs after the fetch resolves, never synchronously in the effect)
    return () => clearTimeout(t);
  }, [q, projectId]);
  async function confirm() {
    if (!picked.size) { setErr("Select at least one investor."); return; }
    setBusy(true); setErr(null);
    const r = await fetch("/api/admin/ir/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, investorContactIds: [...picked] }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? "Couldn't add the investors."); return; }
    onAdded();
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-2 flex items-center"><p className="text-[15px] font-semibold text-slate-900">Add matches</p><button type="button" aria-label="Close" onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600"><i className="ti ti-x" aria-hidden="true" /></button></div>
        <p className="mb-3 text-[12px] text-slate-500">Search investor contacts in Sales Hub. Each confirmed investor lands in Matched with a &ldquo;Send intro email&rdquo; to-do due in 7 days. The engine-ranked matching queue arrives with the weekly Task screen.</p>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Investor name or firm…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-indigo-400 focus:outline-none" />
        <div className="mt-2 max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
          {rows.length === 0 ? <p className="p-3 text-[12px] text-slate-400">{q.trim().length < 2 ? "Type at least two characters." : "No investors match."}</p> : rows.map((r) => (
            <label key={r.id} className={`flex items-start gap-2 px-3 py-2 text-[12.5px] ${r.onThisProject ? "opacity-50" : "cursor-pointer hover:bg-slate-50"}`}>
              <input type="checkbox" disabled={r.onThisProject} checked={picked.has(r.id)} onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="font-medium text-slate-900">{r.name ?? "—"}</span> <span className="text-slate-500">{r.firm ?? ""}</span>
                <span className="block text-[11px] text-slate-400">
                  {r.dataSource === "verified" ? "Verified" : r.dataSource === "self_reported" ? "Self-reported" : "Unverified"}
                  {r.onThisProject ? " · already on this project" : r.alsoOn.length ? ` · also matched: ${r.alsoOn.join(", ")}` : ""}
                </span>
              </span>
            </label>
          ))}
        </div>
        {err ? <p className="mt-2 text-[12px] text-rose-600">{err}</p> : null}
        <div className="mt-3 flex items-center justify-end gap-2">
          <span className="mr-auto text-[12px] text-slate-500">{picked.size} selected</span>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] text-slate-600">Cancel</button>
          <button type="button" disabled={busy || !picked.size} onClick={confirm} className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-60">{busy ? "Adding…" : "Confirm matches"}</button>
        </div>
      </div>
    </div>
  );
}

const STAGE_DOT: Record<IrStage, string> = { matched: "#94A3B8", intro_sent: "#60A5FA", contacted: "#3B82F6", meeting_scheduled: "#F59E0B", meeting_held: "#D97706", follow_up: "#8B5CF6", committed: "#16A34A", passed: "#CBD5E1" };
const fmtShort = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");

/** List view: one row per investor record, next open to-do, stage, assignee. */
function ListView({ rows, open, isLate }: { rows: IrMatch[]; open: Map<string, IrActivity[]>; isLate: (a: IrActivity) => boolean }) {
  const sorted = [...rows].sort((a, b) => IR_STAGES.indexOf(a.stage) - IR_STAGES.indexOf(b.stage) || (a.investor_name ?? "").localeCompare(b.investor_name ?? ""));
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-[12.5px]">
        <thead><tr className="bg-slate-50 text-left text-[11px] text-slate-500"><th className="px-3 py-2 font-medium">Investor</th><th className="py-2 pr-2 font-medium">Firm</th><th className="py-2 pr-2 font-medium">Stage</th><th className="py-2 pr-2 font-medium">Assignee</th><th className="py-2 pr-2 font-medium">Next activity</th><th className="py-2 pr-2 font-medium">Fit</th><th className="py-2 pr-3 font-medium">Since</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((m) => { const nx = (open.get(m.id) ?? [])[0]; return <tr key={m.id} className="hover:bg-slate-50">
            <td className="px-3 py-2"><Link href={`/admin/ir/matches/${m.id}`} className="font-medium text-slate-900 hover:text-indigo-700">{m.starred ? <i className="ti ti-star-filled mr-1 text-amber-500" aria-hidden="true" /> : null}{m.investor_name ?? "—"}</Link></td>
            <td className="py-2 pr-2 text-slate-700">{m.investor_firm ?? "—"}</td>
            <td className="py-2 pr-2"><span className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: `${STAGE_DOT[m.stage]}22`, color: "#0F1B33" }}>{IR_STAGE_LABEL[m.stage]}</span></td>
            <td className="py-2 pr-2 text-slate-700">{m.assignee_name ?? "—"}</td>
            <td className="py-2 pr-2 text-slate-700">{nx ? <span className={isLate(nx) ? "text-rose-600" : ""}>{nx.subject}{nx.due_at ? ` · ${fmtShort(nx.due_at)}` : ""}</span> : <span className="text-slate-400">—</span>}</td>
            <td className="py-2 pr-2 text-slate-600">{m.fit_tier ?? "—"}</td>
            <td className="py-2 pr-3 text-slate-500">{fmtShort(m.stage_changed_at)}</td>
          </tr>; })}
          {sorted.length === 0 ? <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">No investors match these filters.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

/** Timeline view: one row per investor, a cell per project week, a dot on each week the stage changed (colored by the stage reached). */
function TimelineView({ rows, weeks, events }: { rows: IrMatch[]; weeks: IrMilestone[]; events: Array<{ match_id: string; to_stage: IrStage; changed_at: string }> }) {
  const sorted = [...rows].sort((a, b) => IR_STAGES.indexOf(a.stage) - IR_STAGES.indexOf(b.stage) || (a.investor_name ?? "").localeCompare(b.investor_name ?? ""));
  const byMatch = new Map<string, Array<{ to_stage: IrStage; changed_at: string }>>();
  for (const e of events) byMatch.set(e.match_id, [...(byMatch.get(e.match_id) ?? []), e]);
  const today = new Date().toISOString().slice(0, 10);
  const weekOf = (ts: string) => weeks.find((w) => ts.slice(0, 10) >= w.starts_on && ts.slice(0, 10) < w.ends_on)?.id ?? null;
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-[11.5px]">
        <thead><tr className="bg-slate-50 text-[10.5px] text-slate-500"><th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-medium">Investor</th>{weeks.map((w) => <th key={w.id} className={`px-1 py-2 text-center font-medium ${w.starts_on <= today && today < w.ends_on ? "text-indigo-700" : ""}`} title={formatRange(w.starts_on, w.ends_on)}>{w.label.replace("Week ", "W")}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((m) => { const evs = byMatch.get(m.id) ?? []; return <tr key={m.id}>
            <td className="sticky left-0 z-10 bg-white px-3 py-1.5"><Link href={`/admin/ir/matches/${m.id}`} className="font-medium text-slate-900 hover:text-indigo-700">{m.investor_name ?? "—"}</Link><span className="block text-[10.5px] text-slate-500">{IR_STAGE_LABEL[m.stage]}</span></td>
            {weeks.map((w) => { const here = evs.filter((e) => weekOf(e.changed_at) === w.id); const last = here[here.length - 1]; const future = w.starts_on > today; return <td key={w.id} className={`px-1 py-1.5 text-center ${future ? "bg-slate-50/60" : ""}`} title={here.map((e) => `${IR_STAGE_LABEL[e.to_stage]} · ${fmtShort(e.changed_at)}`).join(", ")}>{last ? <span className="inline-block h-3 w-3 rounded-full" style={{ background: STAGE_DOT[last.to_stage] }} /> : <span className="inline-block h-px w-3 bg-slate-200" />}</td>; })}
          </tr>; })}
          {sorted.length === 0 ? <tr><td colSpan={weeks.length + 1} className="px-3 py-6 text-center text-slate-400">No investors match these filters.</td></tr> : null}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-3 border-t border-slate-100 px-3 py-2 text-[10.5px] text-slate-500">{IR_STAGES.map((s) => <span key={s} className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: STAGE_DOT[s] }} />{IR_STAGE_LABEL[s]}</span>)}</div>
    </div>
  );
}
