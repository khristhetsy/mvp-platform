"use client";

/**
 * Side panel for a weekly IR task, opened from the Odoo-style Tasks board. Shows the week,
 * status and priority, and the full investor list as a checklist: ticking an investor
 * moves that match from Matched to Contacted (unticking moves it back). Matches already
 * further along the pipeline show their stage and stay ticked; change those on the match.
 */
import { useEffect, useMemo, useState } from "react";
import { OdooStageBar } from "@/components/ui/OdooStageBar";
import Link from "next/link";
import { IR_STAGE_LABEL, type IrStage } from "@/lib/ir/types";

type Match = { id: string; investor_name: string | null; investor_firm: string | null; stage: IrStage };
type Detail = {
  task: { id: string; project_id: string; title: string; status: "new" | "in_progress" | "done"; starred: boolean; deadline: string | null; milestone_id: string; assignee_name?: string | null };
  project: { id: string; title: string; founder_name: string | null } | null;
  weeks: Array<{ id: string; label: string; starts_on: string; ends_on: string }>;
  matches: Match[];
};
type Patch = { status?: Detail["task"]["status"]; starred?: boolean };

const STATUSES: Array<[Detail["task"]["status"], string]> = [["new", "New"], ["in_progress", "In progress"], ["done", "Done"]];
const fmt = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function TaskSidePanel({ taskId, onClose, onChanged }: { taskId: string; onClose: () => void; onChanged: (id: string, patch: Patch) => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<Set<string>>(new Set());

  useEffect(() => {
    let live = true;
    setD(null); setError(null); // eslint-disable-line react-hooks/set-state-in-effect -- reset when a different task opens
    void fetch(`/api/admin/ir/tasks/${taskId}`).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!live) return;
      if (!r.ok) setError(j.error ?? "Couldn't load the task."); else setD(j);
    });
    return () => { live = false; };
  }, [taskId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const matches = useMemo(() => (d?.matches ?? []).slice().sort((a, b) => (a.investor_firm ?? a.investor_name ?? "").localeCompare(b.investor_firm ?? b.investor_name ?? "")), [d]);
  const shown = matches.filter((m) => !q || `${m.investor_name ?? ""} ${m.investor_firm ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const contacted = matches.filter((m) => m.stage !== "matched").length;
  const week = d?.weeks.find((w) => w.id === d.task.milestone_id);

  async function patchTask(patch: Patch) {
    if (!d) return;
    const before = d.task;
    setD({ ...d, task: { ...d.task, ...patch } });
    onChanged(d.task.id, patch);
    const r = await fetch(`/api/admin/ir/tasks/${d.task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? "Couldn't update the task.");
      setD((x) => x && { ...x, task: before });
      onChanged(before.id, { status: before.status, starred: before.starred });
    }
  }
  async function toggle(m: Match) {
    if (m.stage !== "matched" && m.stage !== "contacted") return;
    const stage: IrStage = m.stage === "matched" ? "contacted" : "matched";
    setBusy((b) => new Set(b).add(m.id));
    setD((x) => x && { ...x, matches: x.matches.map((y) => y.id === m.id ? { ...y, stage } : y) });
    const r = await fetch(`/api/admin/ir/matches/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }) });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? "Couldn't update the investor.");
      setD((x) => x && { ...x, matches: x.matches.map((y) => y.id === m.id ? { ...y, stage: m.stage } : y) });
    }
    setBusy((b) => { const x = new Set(b); x.delete(m.id); return x; });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={d?.task.title ?? "Task"}>
      <button type="button" aria-label="Close panel" onClick={onClose} className="absolute inset-0 bg-slate-900/20" />
      <aside className="relative flex h-full w-full max-w-[460px] flex-col border-l border-slate-200 bg-white shadow-xl">
        <header className="flex items-start gap-2 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] text-slate-500">{d?.project?.founder_name ?? d?.project?.title ?? ""}{week ? ` · ${week.label}` : ""}</p>
            <h2 className="truncate text-[16px] font-semibold text-slate-900">{d?.task.title ?? "Loading…"}</h2>
          </div>
          {d ? <button type="button" onClick={() => void patchTask({ starred: !d.task.starred })} aria-pressed={d.task.starred} aria-label={d.task.starred ? "Remove priority" : "Mark as priority"} className="rounded p-1 hover:bg-slate-50">
            <i className={`ti ${d.task.starred ? "ti-star-filled text-amber-500" : "ti-star text-slate-400"} text-[18px]`} aria-hidden="true" />
          </button> : null}
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-50"><i className="ti ti-x text-[18px]" aria-hidden="true" /></button>
        </header>

        {error ? <div role="alert" className="mx-4 mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div> : null}
        {!d ? (error ? null : <p className="px-4 py-6 text-[13px] text-slate-400">Loading…</p>) : (
          <>
            <div className="space-y-3 border-b border-slate-100 px-4 py-3 text-[12.5px]">
              <div className="flex items-center gap-2">
                <span className="w-20 text-slate-500">Status</span>
                <OdooStageBar size="sm" steps={STATUSES.map(([k, label]) => ({ key: k, label }))} current={d.task.status} onSelect={(k) => { if (d.task.status !== k) void patchTask({ status: k as Detail["task"]["status"] }); }} />
              </div>
              <div className="flex items-center gap-2"><span className="w-20 text-slate-500">Deadline</span><span className="text-slate-800">{d.task.deadline ? fmt(d.task.deadline) : "None"}</span></div>
              {week ? <div className="flex items-center gap-2"><span className="w-20 text-slate-500">Week</span><span className="text-slate-800">{week.label} · {fmt(week.starts_on)} to {fmt(week.ends_on)}</span></div> : null}
            </div>

            <div className="flex items-center gap-2 px-4 pb-2 pt-3">
              <h3 className="text-[13px] font-semibold text-slate-900">Investors</h3>
              <span className="text-[12px] text-slate-500">{contacted} of {matches.length} contacted</span>
            </div>
            <div className="px-4 pb-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter investors" aria-label="Filter investors"
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] focus:border-indigo-400 focus:outline-none" />
            </div>
            <ul className="flex-1 overflow-y-auto px-2 pb-3">
              {shown.map((m) => {
                const locked = m.stage !== "matched" && m.stage !== "contacted";
                return (
                  <li key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <input type="checkbox" checked={m.stage !== "matched"} disabled={locked || busy.has(m.id)} onChange={() => void toggle(m)}
                      aria-label={`Contacted ${m.investor_name ?? m.investor_firm ?? "investor"}`} className="h-4 w-4 accent-indigo-600" title={locked ? "Further along the pipeline; change it on the match" : undefined} />
                    <Link href={`/admin/ir/matches/${m.id}`} className="min-w-0 flex-1 truncate text-[12.5px] text-slate-800 hover:text-indigo-700">
                      {m.investor_firm && m.investor_firm !== m.investor_name ? <><span className="font-medium">{m.investor_firm}</span>{m.investor_name ? <span className="text-slate-500">, {m.investor_name}</span> : null}</> : <span className="font-medium">{m.investor_name ?? m.investor_firm ?? "Investor"}</span>}
                    </Link>
                    {m.stage !== "matched" ? <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-600">{IR_STAGE_LABEL[m.stage]}</span> : null}
                  </li>
                );
              })}
              {matches.length === 0 ? <li className="px-2 py-4 text-[12.5px] text-slate-400">No investors on this week yet. Add them from the full task&apos;s Matching tab.</li> : null}
            </ul>
            <footer className="border-t border-slate-100 px-4 py-3">
              <Link href={`/admin/ir/projects/${d.task.project_id}/tasks/${d.task.id}`} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-indigo-700 hover:underline">Open full task <i className="ti ti-arrow-right" aria-hidden="true" /></Link>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
