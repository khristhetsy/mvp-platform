"use client";

/**
 * Edit task — opened from the pencil on a Tasks board card. Changes the task's name, stage,
 * due date, assignee, investors and notes in one place, then saves. Stage lists the stages
 * added on this board (+ Stage); a task sitting in an Odoo stage shows it read-only.
 * Removing an investor takes it off this task only (it stays on the project); adding one
 * creates the match on this task. Card clicks still open the full task page.
 */
import { useEffect, useState } from "react";
import type { IrMatch, IrTask } from "@/lib/ir/types";

type Staff = { id: string; name: string };
type LocalStage = { id: string; name: string };
type Found = { id: string; name: string | null; firm: string | null; onThisProject?: boolean };
const chipLabel = (m: { investor_firm?: string | null; investor_name?: string | null; firm?: string | null; name?: string | null }) =>
  [...new Set([m.investor_firm ?? m.firm, m.investor_name ?? m.name].filter(Boolean))].join(", ") || "Investor";
const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-indigo-400 focus:outline-none";

export function EditTaskDialog({ projectId, task, matches, staff, localStages, odooStageName, onClose, onSaved }: {
  projectId: string; task: IrTask; matches: IrMatch[]; staff: Staff[]; localStages: LocalStage[]; odooStageName: string | null;
  onClose: () => void; onSaved: (message: string | null) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [stageId, setStageId] = useState<string>(task.stage_id ?? "");
  const [deadline, setDeadline] = useState(task.deadline ?? "");
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? "");
  const [notes, setNotes] = useState(task.notes ?? "");
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Found[]>([]);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) return;
    let off = false;
    const t = setTimeout(() => {
      fetch(`/api/admin/ir/investors?q=${encodeURIComponent(needle)}&project=${projectId}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
        .then((j: { investors?: Found[] } | null) => { if (!off) setFound(j?.investors ?? []); });
    }, 250);
    return () => { off = true; clearTimeout(t); };
  }, [q, projectId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onTask = new Set(matches.map((m) => m.investor_contact_id));
  function pick(f: Found) {
    if (!onTask.has(f.id) && !added.some((a) => a.id === f.id)) setAdded((cur) => [...cur, f]);
    setQ(""); setFound([]);
  }

  async function save() {
    if (!title.trim()) { setError("Name the task."); return; }
    setSaving(true); setError(null);
    try {
      const body: Record<string, unknown> = { title: title.trim(), deadline: deadline || null, assigneeId: assigneeId || null, notes: notes.trim() ? notes : null };
      if (!odooStageName && stageId !== (task.stage_id ?? "")) body.stageId = stageId || null;
      const r = await fetch(`/api/admin/ir/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); setError(j.error ?? "Couldn't save the task."); return; }
      for (const mid of removed) {
        const rr = await fetch(`/api/admin/ir/matches/${mid}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: null }) });
        if (!rr.ok) { setError("Saved, but an investor couldn't be removed. Try again."); return; }
      }
      let skipped = 0;
      if (added.length) {
        const ar = await fetch("/api/admin/ir/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, taskId: task.id, investorContactIds: added.map((a) => a.id), assigneeId: assigneeId || null }) });
        const aj = await ar.json().catch(() => ({}));
        if (!ar.ok) { setError(aj.error ?? "Saved, but the investors couldn't be added."); return; }
        skipped = Number(aj.skipped ?? 0);
      }
      onSaved(skipped ? `${skipped} investor${skipped === 1 ? " is" : "s are"} already on this project, so ${skipped === 1 ? "it wasn't" : "they weren't"} added again.` : null);
    } finally { setSaving(false); }
  }

  const results = q.trim().length >= 2 ? found : [];
  const kept = matches.filter((m) => !removed.has(m.id));
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/30 p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="edit-task-title" onSubmit={(e) => { e.preventDefault(); void save(); }} className="mt-10 w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center">
          <h2 id="edit-task-title" className="text-[17px] font-semibold text-slate-900">Edit task</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto rounded-md px-2 py-0.5 text-[18px] text-slate-500 hover:bg-slate-100">×</button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <label className="flex flex-col gap-1"><span className="font-medium text-slate-700">Task name</span><input autoComplete="off" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} className={inp} /></label>
          <label className="flex flex-col gap-1"><span className="font-medium text-slate-700">Stage</span>
            {odooStageName ? (
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600" title="This task's stage comes from Odoo">{odooStageName} <span className="text-[11.5px] text-slate-400">(Odoo)</span></span>
            ) : (
              <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={`${inp} bg-white`}>
                <option value="">No stage (week column)</option>
                {localStages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </label>
          <label className="flex flex-col gap-1"><span className="font-medium text-slate-700">Due date</span><input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inp} /></label>
          <label className="flex flex-col gap-1"><span className="font-medium text-slate-700">Assigned to</span>
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={`${inp} bg-white`}>
              <option value="">Unassigned</option>
              {assigneeId && !staff.some((s) => s.id === assigneeId) ? <option value={assigneeId}>{task.assignee_name ?? "Current assignee"}</option> : null}
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <div className="col-span-2 flex flex-col gap-1">
            <span className="font-medium text-slate-700">Investors</span>
            <div className="relative rounded-lg border border-slate-200 px-2 py-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {kept.map((m) => (
                  <span key={m.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11.5px] text-slate-700">
                    <span className="truncate">{chipLabel(m)}</span>
                    <button type="button" onClick={() => setRemoved((s) => new Set(s).add(m.id))} aria-label={`Remove ${chipLabel(m)}`} className="text-slate-400 hover:text-rose-600"><i className="ti ti-x" aria-hidden="true" /></button>
                  </span>
                ))}
                {added.map((a) => (
                  <span key={a.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11.5px] text-indigo-800">
                    <span className="truncate">{chipLabel(a)}</span>
                    <button type="button" onClick={() => setAdded((cur) => cur.filter((x) => x.id !== a.id))} aria-label={`Remove ${chipLabel(a)}`} className="text-indigo-400 hover:text-rose-600"><i className="ti ti-x" aria-hidden="true" /></button>
                  </span>
                ))}
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add investor…" aria-label="Add investor" className="min-w-[140px] flex-1 px-1 py-0.5 text-[12.5px] focus:outline-none" />
              </div>
              {results.length ? (
                <div role="listbox" className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  {results.map((f) => {
                    const here = onTask.has(f.id) || added.some((a) => a.id === f.id);
                    return (
                      <button key={f.id} type="button" role="option" aria-selected={false} disabled={here} onClick={() => pick(f)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] hover:bg-indigo-50 disabled:opacity-50">
                        <span className="truncate">{chipLabel(f)}</span>
                        {here ? <span className="ml-auto text-[11px] text-slate-400">on this task</span> : f.onThisProject ? <span className="ml-auto text-[11px] text-slate-400">on this project</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            {removed.size ? <span className="text-[11.5px] text-slate-500">Removed investors stay on the project; they come off this task only.</span> : null}
          </div>
          <label className="col-span-2 flex flex-col gap-1"><span className="font-medium text-slate-700">Notes</span><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} className={`${inp} resize-y`} /></label>
        </div>
        {error ? <p role="alert" className="mt-3 text-[12.5px] text-rose-700">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </div>
  );
}
