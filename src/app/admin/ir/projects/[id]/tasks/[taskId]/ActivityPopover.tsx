"use client";

/**
 * Odoo-style activity popover for one investor on the task Matching tab: the planned
 * (open) activities with mark done · edit · cancel, and "Schedule an activity" at the
 * foot. Open Odoo activities on the investor (read live, marked "Odoo") sit beside them,
 * split into Overdue and Planned like Odoo; done · edit · cancel on those write back to Odoo.
 * The investor's completed activities show under "show history". Anchored to the clicked cell with fixed positioning so the table's horizontal
 * scroll container doesn't clip it. Uses the existing /api/admin/ir/activities routes.
 */
import { useEffect, useRef, useState } from "react";
import type { OdooOpenActivity } from "@/lib/ir/odoo-open-activities";
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

export function ActivityPopover({ anchor, activities, projectId, taskId, matchId, staff, meId, now, onChange, onClose, odoo = [], history = [], onOdooChange }: {
  anchor: HTMLElement; activities: IrActivity[]; projectId: string; taskId: string; matchId: string; staff: Staff; meId: string; now: number;
  onChange: () => Promise<void>; onClose: () => void;
  odoo?: OdooOpenActivity[]; history?: IrActivity[]; onOdooChange?: () => Promise<void>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(activities.length || odoo.length ? null : "new");
  const [odooEdit, setOdooEdit] = useState<{ id: number; summary: string; due: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
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
  }, [anchor, onClose, editing, activities.length, odoo.length, showHistory, odooEdit]);

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
  async function odooRun(p: Promise<Response>, fallback: string) {
    setBusy(true); setErr(null);
    try {
      const r = await p;
      if (!r.ok) { setErr((await r.json().catch(() => ({}))).error ?? fallback); return false; }
      await onOdooChange?.(); return true;
    } finally { setBusy(false); }
  }
  const odooDone = (o: OdooOpenActivity) => odooRun(fetch(`/api/admin/ir/odoo-activities/${o.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: true }) }), "Couldn't mark it done in Odoo.");
  async function odooCancel(o: OdooOpenActivity) {
    if (!window.confirm(`Cancel "${o.summary}" in Odoo? It's removed there too.`)) return;
    await odooRun(fetch(`/api/admin/ir/odoo-activities/${o.id}`, { method: "DELETE" }), "Couldn't cancel it in Odoo.");
  }
  async function odooSave() {
    if (!odooEdit) return;
    if (!odooEdit.summary.trim()) { setErr("Enter a summary first."); return; }
    const ok = await odooRun(fetch(`/api/admin/ir/odoo-activities/${odooEdit.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ summary: odooEdit.summary.trim(), due: odooEdit.due || null }) }), "Couldn't save it in Odoo.");
    if (ok) setOdooEdit(null);
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
      {(() => {
        // One list, split like Odoo: Overdue then Planned; iCapOS and Odoo activities side by side.
        type Item = { key: string; due: string | null; a?: IrActivity; o?: OdooOpenActivity };
        const items: Item[] = [
          ...activities.map((a) => ({ key: a.id, due: a.due_at, a })),
          ...odoo.map((o) => ({ key: `odoo:${o.id}`, due: o.due ? new Date(`${o.due}T17:00:00`).toISOString() : null, o })),
        ].sort((x, y) => (x.due ?? "9").localeCompare(y.due ?? "9"));
        const late = items.filter((i) => dueLabel(i.due, now).late), planned = items.filter((i) => !dueLabel(i.due, now).late);
        const row = (i: Item) => {
          if (i.a) {
            const a = i.a;
            if (editing === a.id) return <li key={i.key}>{form}</li>;
            const d = dueLabel(a.due_at, now);
            return (
              <li key={i.key} className="px-3 py-2">
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
          }
          const o = i.o!;
          if (odooEdit?.id === o.id) return (
            <li key={i.key} className="grid gap-1.5 p-3">
              <input autoFocus value={odooEdit.summary} onChange={(e) => { setOdooEdit({ ...odooEdit, summary: e.target.value }); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") void odooSave(); }} className={inp} aria-label="Summary" />
              <input type="date" value={odooEdit.due} onChange={(e) => setOdooEdit({ ...odooEdit, due: e.target.value })} className={inp} aria-label="Due date" />
              <div className="flex items-center gap-2 pt-0.5">
                <button type="button" disabled={busy} onClick={() => void odooSave()} className="rounded-md bg-indigo-600 px-3 py-1 text-[12px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">Save in Odoo</button>
                <button type="button" onClick={() => { setOdooEdit(null); setErr(null); }} className="rounded-md border border-slate-200 px-3 py-1 text-[12px] text-slate-600 hover:bg-slate-50">Discard</button>
              </div>
            </li>
          );
          const d = dueLabel(i.due, now);
          return (
            <li key={i.key} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <i className="ti ti-calendar-event text-slate-400" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-semibold text-slate-900" title={`${o.type}: ${o.summary}`}>{o.summary}</span>
                <button type="button" disabled={busy} onClick={() => void odooDone(o)} aria-label="Mark done in Odoo" title="Mark done in Odoo" className="rounded px-1 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"><i className="ti ti-check" aria-hidden="true" /></button>
                <button type="button" disabled={busy} onClick={() => { setErr(null); setOdooEdit({ id: o.id, summary: o.summary, due: o.due ?? "" }); }} aria-label="Edit in Odoo" title="Edit" className="rounded px-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><i className="ti ti-pencil" aria-hidden="true" /></button>
                <button type="button" disabled={busy} onClick={() => void odooCancel(o)} aria-label="Cancel in Odoo" title="Cancel" className="rounded px-1 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><i className="ti ti-x" aria-hidden="true" /></button>
              </div>
              <p className="mt-0.5 flex items-center gap-1 pl-6 text-[11.5px] text-slate-500">
                <span className="rounded bg-violet-50 px-1.5 text-[10.5px] font-medium text-violet-700">Odoo</span>
                <span className="truncate">{o.type} · {o.user ?? "Unassigned"} · </span><span className={d.late ? "text-rose-600" : ""}>{d.text}</span>
                {o.url ? <a href={o.url} target="_blank" rel="noreferrer" title="Open in Odoo" className="ml-auto text-slate-400 hover:text-indigo-700"><i className="ti ti-external-link" aria-hidden="true" /></a> : null}
              </p>
            </li>
          );
        };
        const head = (label: string, n: number, cls: string, pill: string) => <div className={`flex items-center justify-between px-3 py-2 font-semibold ${cls}`}><span>{label}</span><span className={`rounded-full px-2 text-[11px] text-white ${pill}`}>{n}</span></div>;
        return (
          <div className="max-h-80 overflow-y-auto">
            {!items.length ? <div className="bg-slate-50 px-3 py-2 text-slate-500">No planned activities</div> : null}
            {late.length ? <>{head("Overdue", late.length, "bg-rose-50 text-rose-800", "bg-rose-600")}<ul className="divide-y divide-slate-100">{late.map(row)}</ul></> : null}
            {planned.length ? <>{head("Planned", planned.length, "bg-emerald-50 text-emerald-800", "bg-emerald-600")}<ul className="divide-y divide-slate-100">{planned.map(row)}</ul></> : null}
            {history.length ? (
              <div className="border-t border-slate-100">
                <button type="button" onClick={() => setShowHistory((v) => !v)} className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[11.5px] text-slate-500 hover:bg-slate-50"><i className="ti ti-history" aria-hidden="true" />{history.length} done · {showHistory ? "hide" : "show"} history</button>
                {showHistory ? <ul className="divide-y divide-slate-50 pb-1">{history.map((h) => (
                  <li key={h.id} className="flex items-center gap-2 px-3 py-1 text-[11.5px] text-slate-600"><i className="ti ti-check text-emerald-600" aria-hidden="true" /><span className="min-w-0 flex-1 truncate" title={h.outcome ?? h.subject}>{h.subject}</span><span className="shrink-0 text-slate-400">{h.done_at ? new Date(h.done_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : ""}</span></li>
                ))}</ul> : null}
              </div>
            ) : null}
          </div>
        );
      })()}
      {err ? <p className="px-3 pt-2 text-[12px] text-rose-600">{err}</p> : null}
      {editing === "new" ? <div className="border-t border-slate-100">{form}</div>
        : <button type="button" onClick={startNew} className="block w-full border-t border-slate-100 bg-slate-50 px-3 py-2 text-center font-semibold text-slate-700 hover:bg-slate-100"><i className="ti ti-plus" aria-hidden="true" /> Schedule an activity</button>}
    </div>
  );
}
