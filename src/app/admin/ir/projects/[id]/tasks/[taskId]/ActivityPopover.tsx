"use client";

/**
 * Odoo-style activity popover for one investor on the task Matching tab: the planned
 * (open) activities with mark done · edit · cancel, and "Schedule an activity" at the
 * foot. Anchored to the clicked cell with fixed positioning so the table's horizontal
 * scroll container doesn't clip it. Uses the existing /api/admin/ir/activities routes.
 */
import { useEffect, useRef, useState } from "react";
import { IR_ACTIVITY_ICON, IR_ACTIVITY_LABEL, IR_ACTIVITY_TYPES, type IrActivity, type IrActivityType } from "@/lib/ir/types";

type Staff = Array<{ id: string; name: string }>;
type Draft = { type: IrActivityType; subject: string; due: string; assigneeId: string };

const DAY = 86_400_000;
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** "Due in 14 days", "Today", "Yesterday", "3 days overdue", compared by calendar day. */
export function dueLabel(iso: string | null, now: number): { text: string; late: boolean } {
  if (!iso) return { text: "No due date", late: false };
  const a = new Date(iso), b = new Date(now);
  const diff = Math.round((new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime() - new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()) / DAY);
  if (diff === 0) return { text: "Today", late: false };
  if (diff === 1) return { text: "Tomorrow", late: false };
  if (diff > 1) return { text: `Due in ${diff} days`, late: false };
  if (diff === -1) return { text: "Yesterday", late: true };
  return { text: `${-diff} days overdue`, late: true };
}
/** A picked calendar day becomes 5:00 PM local on that day. */
const dueIso = (day: string) => (day ? new Date(`${day}T17:00:00`).toISOString() : null);

export function ActivityPopover({ anchor, activities, projectId, taskId, matchId, staff, meId, now, onChange, onClose }: {
  anchor: HTMLElement; activities: IrActivity[]; projectId: string; taskId: string; matchId: string; staff: Staff; meId: string; now: number;
  onChange: () => Promise<void>; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(activities.length ? null : "new");
  const [draft, setDraft] = useState<Draft>({ type: "call", subject: "", due: dayKey(new Date(now + 2 * DAY)), assigneeId: meId });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const staffName = (id: string | null) => staff.find((s) => s.id === id)?.name ?? "Unassigned";

  useEffect(() => {
    const place = () => {
      const r = anchor.getBoundingClientRect(), w = 300, h = ref.current?.offsetHeight ?? 260;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
      const below = r.bottom + 4, top = below + h > window.innerHeight - 8 && r.top - h - 4 > 8 ? r.top - h - 4 : below;
      setPos({ top, left });
    };
    const raf = requestAnimationFrame(place);
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { cancelAnimationFrame(raf); document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [anchor, onClose, editing, activities.length]);

  async function run(p: Promise<Response>, fallback: string) {
    setBusy(true); setErr(null);
    try {
      const r = await p;
      if (!r.ok) { setErr((await r.json().catch(() => ({}))).error ?? fallback); return false; }
      await onChange(); return true;
    } finally { setBusy(false); }
  }
  const markDone = (a: IrActivity) => run(fetch(`/api/admin/ir/activities/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: true }) }), "Couldn't mark it done.");
  async function cancel(a: IrActivity) {
    if (!window.confirm(`Cancel "${a.subject}"? It's removed, not logged.`)) return;
    await run(fetch(`/api/admin/ir/activities/${a.id}`, { method: "DELETE" }), "Couldn't cancel it.");
  }
  function startEdit(a: IrActivity) {
    setDraft({ type: a.type, subject: a.subject, due: a.due_at ? dayKey(new Date(a.due_at)) : "", assigneeId: a.assignee_id ?? "" });
    setErr(null); setEditing(a.id);
  }
  function startNew() { setDraft({ type: "call", subject: "", due: dayKey(new Date(now + 2 * DAY)), assigneeId: meId }); setErr(null); setEditing("new"); }
  async function save() {
    if (!draft.subject.trim()) { setErr("Enter a summary first."); return; }
    const body = { type: draft.type, subject: draft.subject.trim(), dueAt: dueIso(draft.due), assigneeId: draft.assigneeId || null };
    const ok = editing === "new"
      ? await run(fetch("/api/admin/ir/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, projectId, taskId, matchId }) }), "Couldn't schedule it.")
      : await run(fetch(`/api/admin/ir/activities/${editing}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), "Couldn't save it.");
    if (ok) setEditing(null);
  }

  const inp = "w-full rounded-md border border-slate-200 px-2 py-1 text-[12.5px] focus:border-indigo-400 focus:outline-none";
  const form = (
    <div className="grid gap-1.5 p-3">
      <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as IrActivityType })} className={inp} aria-label="Activity type">{IR_ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{IR_ACTIVITY_LABEL[t]}</option>)}</select>
      <input autoFocus value={draft.subject} onChange={(e) => { setDraft({ ...draft, subject: e.target.value }); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") void save(); }} placeholder="Summary, e.g. Follow up on the deck" className={inp} aria-label="Summary" />
      <div className="flex gap-1.5">
        <input type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} className={inp} aria-label="Due date" />
        <select value={draft.assigneeId} onChange={(e) => setDraft({ ...draft, assigneeId: e.target.value })} className={inp} aria-label="Assigned to"><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.id === meId ? `${s.name} (me)` : s.name}</option>)}</select>
      </div>
      <div className="flex items-center gap-2 pt-0.5">
        <button type="button" disabled={busy} onClick={save} className="rounded-md bg-indigo-600 px-3 py-1 text-[12px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{editing === "new" ? "Schedule" : "Save"}</button>
        <button type="button" onClick={() => { setEditing(null); setErr(null); }} className="rounded-md border border-slate-200 px-3 py-1 text-[12px] text-slate-600 hover:bg-slate-50">Discard</button>
      </div>
    </div>
  );

  return (
    <div ref={ref} role="dialog" aria-label="Activities" onClick={(e) => e.stopPropagation()} style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: 300 }} className="z-50 overflow-hidden rounded-lg border border-slate-200 bg-white text-[12.5px] shadow-xl">
      {activities.length ? <div className="flex items-center justify-between bg-emerald-50 px-3 py-2 font-semibold text-emerald-800"><span>Planned</span><span className="rounded-full bg-emerald-600 px-2 text-[11px] text-white">{activities.length}</span></div>
        : <div className="bg-slate-50 px-3 py-2 text-slate-500">No planned activities</div>}
      <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
        {activities.map((a) => {
          if (editing === a.id) return <li key={a.id}>{form}</li>;
          const d = dueLabel(a.due_at, now);
          return (
            <li key={a.id} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <i className={`ti ${IR_ACTIVITY_ICON[a.type]} text-slate-400`} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-semibold text-slate-900" title={a.subject}>{a.subject}</span>
                <button type="button" disabled={busy} onClick={() => markDone(a)} aria-label="Mark done" title="Mark done" className="rounded px-1 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"><i className="ti ti-check" aria-hidden="true" /></button>
                <button type="button" disabled={busy} onClick={() => startEdit(a)} aria-label="Edit" title="Edit" className="rounded px-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><i className="ti ti-pencil" aria-hidden="true" /></button>
                <button type="button" disabled={busy} onClick={() => cancel(a)} aria-label="Cancel activity" title="Cancel" className="rounded px-1 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><i className="ti ti-x" aria-hidden="true" /></button>
              </div>
              <p className={`mt-0.5 pl-6 text-[11.5px] ${d.late ? "text-rose-600" : "text-slate-500"}`}>{staffName(a.assignee_id)} · {d.text}</p>
            </li>
          );
        })}
      </ul>
      {err ? <p className="px-3 pt-2 text-[12px] text-rose-600">{err}</p> : null}
      {editing === "new" ? <div className="border-t border-slate-100">{form}</div>
        : <button type="button" onClick={startNew} className="block w-full border-t border-slate-100 bg-slate-50 px-3 py-2 text-center font-semibold text-slate-700 hover:bg-slate-100"><i className="ti ti-plus" aria-hidden="true" /> Schedule an activity</button>}
    </div>
  );
}
