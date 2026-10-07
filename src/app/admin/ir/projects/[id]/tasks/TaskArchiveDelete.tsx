"use client";

/**
 * Archive / Delete for Investor Relations weekly tasks, shared by the task list (Actions
 * menu) and the task form (gear menu). Delete opens a confirmation that counts what goes
 * with the task and offers Archive instead.
 */
import { useEffect, useState } from "react";

export type TaskAction = "archive" | "unarchive" | "delete";
type Impact = { tasks: number; investors: number; activities: number; odooLinked: number };

export async function runTaskAction(ids: string[], action: TaskAction): Promise<{ ok: boolean; message: string | null }> {
  const r = await fetch("/api/admin/ir/tasks/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, action }) }).catch(() => null);
  const j = r ? await r.json().catch(() => ({})) : {};
  if (!r || !r.ok) return { ok: false, message: j.error ?? "Couldn't update the tasks." };
  const odoo = j.odooFailed ? ` Odoo couldn't be reached for ${j.odooFailed} linked task${j.odooFailed === 1 ? "" : "s"}; archive ${j.odooFailed === 1 ? "it" : "them"} in Odoo too.` : "";
  return { ok: true, message: odoo || null };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function TaskDeleteDialog({ ids, label, onClose, onDone }: { ids: string[]; label: string; onClose: () => void; onDone: (action: TaskAction, message: string | null) => void }) {
  const [impact, setImpact] = useState<Impact | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = ids.join(",");
  useEffect(() => {
    let off = false;
    fetch("/api/admin/ir/tasks/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: key.split(","), action: "preview" }) })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((j: Impact | null) => { if (!off) { if (j) setImpact(j); else setError("Couldn't count what this removes."); } });
    return () => { off = true; };
  }, [key]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [busy, onClose]);

  async function go(action: TaskAction) {
    setBusy(true); setError(null);
    const r = await runTaskAction(ids, action);
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    onDone(action, r.message);
  }

  const many = ids.length > 1;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => { if (!busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="task-delete-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <h3 id="task-delete-title" className="text-[15px] font-semibold text-slate-900">{many ? `Delete ${ids.length} tasks?` : `Delete "${label}"?`}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
          {impact
            ? <>This removes {many ? "the tasks" : "the task"} and {plural(impact.investors, "investor")}, {plural(impact.activities, "activity", "activities")}, and messages on {many ? "them" : "it"}. It can&apos;t be undone. Archive instead if you may need {many ? "them" : "it"} later.</>
            : error ? null : "Counting what this removes…"}
        </p>
        {impact && impact.odooLinked > 0 ? <p className="mt-2 text-[12px] text-amber-700">{impact.odooLinked === 1 && !many ? "This task is" : `${plural(impact.odooLinked, "task")} ${impact.odooLinked === 1 ? "is" : "are"}`} linked to Odoo. It&apos;s archived in Odoo too, so the next sync doesn&apos;t bring it back.</p> : null}
        {error ? <p role="alert" className="mt-2 text-[12px] text-rose-600">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50 disabled:opacity-60">Cancel</button>
          <button type="button" disabled={busy} onClick={() => go("archive")} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50 disabled:opacity-60">Archive instead</button>
          <button type="button" disabled={busy || !impact} onClick={() => go("delete")} className="rounded-lg bg-rose-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60">{busy ? "Working…" : "Delete"}</button>
        </div>
      </div>
    </div>
  );
}
