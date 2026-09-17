"use client";

/**
 * Task — weekly kanban: four week columns for the selected month, a month picker, progress
 * bar + count per column. Cards are the weekly batch (title, investor chips, count, created
 * date, star, assignee, status dot). Search filters and highlights chips. "+" per column
 * and New create an empty week task.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatRange } from "@/lib/ir/milestones";
import { HScrollBoard } from "@/components/admin/HScrollBoard";
import type { IrMatch, IrMilestone, IrProject, IrTask } from "@/lib/ir/types";

type Payload = { project: IrProject; milestones: IrMilestone[]; matches: IrMatch[]; tasks: IrTask[]; staff: Array<{ id: string; name: string }> };
const STATUS_DOT: Record<string, string> = { new: "#94A3B8", in_progress: "#F59E0B", done: "#16A34A" };
const initials = (n: string | null | undefined) => (n ?? "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function TasksClient({ projectId, meId, initialMonth }: { projectId: string; meId: string; initialMonth: string | null }) {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [monthId, setMonthId] = useState<string | null>(initialMonth);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/ir/projects/${projectId}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? "Couldn't load the project."); return; }
    setData(j); setError(null);
  }, [projectId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set
  useEffect(() => { void load(); }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const months = useMemo(() => (data?.milestones ?? []).filter((m) => m.kind === "month"), [data]);
  const weeks = useMemo(() => (data?.milestones ?? []).filter((m) => m.kind === "week"), [data]);
  const currentMonth = months.find((m) => m.starts_on <= today && today < m.ends_on) ?? months[months.length - 1] ?? null;
  const month = months.find((m) => m.id === monthId) ?? currentMonth;
  const monthWeeks = weeks.filter((w) => w.parent_id === month?.id);
  const matchesByTask = useMemo(() => {
    const m = new Map<string, IrMatch[]>();
    for (const x of data?.matches ?? []) if (x.task_id) m.set(x.task_id, [...(m.get(x.task_id) ?? []), x]);
    return m;
  }, [data]);
  const needle = q.trim().toLowerCase();
  const hit = (m: IrMatch) => needle !== "" && [m.investor_name, m.investor_firm].some((s) => (s ?? "").toLowerCase().includes(needle));

  async function newTask(milestoneId: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/ir/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, milestoneId, assigneeId: meId }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error ?? "Couldn't create the task."); return; }
      router.push(`/admin/ir/projects/${projectId}/tasks/${j.id}`);
    } finally { setBusy(false); }
  }
  async function star(t: IrTask) {
    await fetch(`/api/admin/ir/tasks/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ starred: !t.starred }) });
    void load();
  }

  if (error && !data) return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>;
  if (!data) return <p className="text-[13px] text-slate-400">Loading…</p>;
  const p = data.project;
  const currentWeek = weeks.find((w) => w.starts_on <= today && today < w.ends_on) ?? null;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
        <Link href="/admin/ir/projects" className="hover:text-indigo-700">Projects</Link><span>/</span>
        <Link href={`/admin/ir/projects/${projectId}`} className="hover:text-indigo-700">{p.title}</Link><span>/</span><span className="text-slate-800">Tasks</span>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || !currentWeek} onClick={() => currentWeek && newTask(currentWeek.id)} className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">New</button>
        <h2 className="text-[18px] font-semibold text-slate-900">{p.title} · Tasks</h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search investors…" className="ml-2 w-56 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] focus:border-indigo-400 focus:outline-none" />
        <label className="ml-auto text-[12px] text-slate-600">Month
          <select value={month?.id ?? ""} onChange={(e) => setMonthId(e.target.value)} className="ml-1 rounded-md border border-slate-200 px-2 py-1 text-[12px]">
            {months.map((m) => <option key={m.id} value={m.id}>{m.label} · {formatRange(m.starts_on, m.ends_on)}</option>)}
          </select>
        </label>
        {error ? <span className="text-[12px] text-rose-600">{error}</span> : null}
      </div>

      <HScrollBoard>
        {monthWeeks.map((w) => {
          const tasks = data.tasks.filter((t) => t.milestone_id === w.id);
          const done = tasks.filter((t) => t.status === "done").length;
          const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
          const isNow = currentWeek?.id === w.id;
          return (
            <div key={w.id} style={{ flex: "0 0 300px", minWidth: 300 }} className={`rounded-xl border bg-slate-50 p-2 ${isNow ? "border-indigo-300" : "border-slate-200"}`}>
              <div className="mb-1 flex items-center justify-between px-1">
                <span className="text-[12.5px] font-semibold text-slate-800">{w.label}{isNow ? " · now" : ""}</span>
                <span className="flex items-center gap-1">
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200">{tasks.length}</span>
                  <button type="button" disabled={busy} onClick={() => newTask(w.id)} aria-label={`New task in ${w.label}`} className="rounded px-1 text-slate-500 hover:bg-white hover:text-indigo-700"><i className="ti ti-plus" aria-hidden="true" /></button>
                </span>
              </div>
              <p className="px-1 text-[10.5px] text-slate-500">{formatRange(w.starts_on, w.ends_on)}</p>
              <div className="mx-1 my-1.5 h-1 rounded bg-slate-200"><div className="h-1 rounded bg-emerald-500" style={{ width: `${pct}%` }} /></div>
              <div className="flex min-h-[60px] flex-col gap-2">
                {tasks.map((t) => {
                  const ms = matchesByTask.get(t.id) ?? [];
                  const anyHit = ms.some(hit);
                  if (needle && !anyHit && !t.title.toLowerCase().includes(needle)) return null;
                  return (
                    <div key={t.id} className={`rounded-lg border bg-white p-2.5 shadow-sm ${anyHit ? "border-indigo-300" : "border-slate-200"}`}>
                      <div className="flex items-start gap-1.5">
                        <button type="button" onClick={() => star(t)} aria-label="Star" className={`mt-0.5 ${t.starred ? "text-amber-500" : "text-slate-300 hover:text-amber-400"}`}><i className={`ti ${t.starred ? "ti-star-filled" : "ti-star"}`} aria-hidden="true" /></button>
                        <Link href={`/admin/ir/projects/${projectId}/tasks/${t.id}`} className="min-w-0 flex-1 text-[13px] font-medium text-slate-900 hover:text-indigo-700">{t.title}</Link>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {ms.slice(0, 8).map((m) => <span key={m.id} className={`rounded px-1.5 py-0.5 text-[10.5px] ${hit(m) ? "bg-amber-100 text-amber-900" : "bg-blue-50 text-blue-800"}`}>{m.investor_name ?? m.investor_firm ?? "Investor"}</span>)}
                        {ms.length > 8 ? <span className="text-[10.5px] text-slate-400">+{ms.length - 8}</span> : null}
                        {ms.length === 0 ? <span className="text-[10.5px] text-slate-400">no investors yet</span> : null}
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[10.5px] text-slate-500">
                        <span><i className="ti ti-users" aria-hidden="true" /> {ms.length}</span>
                        <span><i className="ti ti-clock" aria-hidden="true" /> {fmtDay(t.created_at)}</span>
                        <span className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[9px] font-semibold text-slate-700" title={t.assignee_name ?? ""}>{initials(t.assignee_name)}</span>
                        <span className="h-2 w-2 rounded-full" style={{ background: STATUS_DOT[t.status] }} title={t.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </HScrollBoard>
    </div>
  );
}
