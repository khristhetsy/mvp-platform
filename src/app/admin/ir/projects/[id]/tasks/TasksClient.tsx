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
  const [view, setView] = useState<"kanban" | "list">("kanban");

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
        <span className="ml-auto flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="View"><button type="button" onClick={() => setView("kanban")} aria-pressed={view === "kanban"} className={`rounded-md px-2.5 py-0.5 text-[12px] font-medium ${view === "kanban" ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"}`}>Kanban</button><button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} className={`rounded-md px-2.5 py-0.5 text-[12px] font-medium ${view === "list" ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"}`}>List</button></span>
        <label className="text-[12px] text-slate-600">Month
          <select value={month?.id ?? ""} onChange={(e) => setMonthId(e.target.value)} className="ml-1 rounded-md border border-slate-200 px-2 py-1 text-[12px]">
            {months.map((m) => <option key={m.id} value={m.id}>{m.label} · {formatRange(m.starts_on, m.ends_on)}</option>)}
          </select>
        </label>
        {error ? <span className="text-[12px] text-rose-600">{error}</span> : null}
      </div>

      {view === "list" ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-[12.5px]">
            <thead><tr className="bg-slate-50 text-left text-[11px] text-slate-500"><th className="px-3 py-2 font-medium">Task</th><th className="py-2 pr-2 font-medium">Week</th><th className="py-2 pr-2 font-medium">Investors</th><th className="py-2 pr-2 font-medium">Assignee</th><th className="py-2 pr-2 font-medium">Status</th><th className="py-2 pr-3 font-medium">Created</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {monthWeeks.flatMap((w) => data.tasks.filter((t) => t.milestone_id === w.id).map((t) => ({ t, w }))).filter(({ t }) => { const ms = matchesByTask.get(t.id) ?? []; return !needle || ms.some(hit) || t.title.toLowerCase().includes(needle); }).map(({ t, w }) => { const ms = matchesByTask.get(t.id) ?? []; return <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-3 py-2"><Link href={`/admin/ir/projects/${projectId}/tasks/${t.id}`} className="font-medium text-slate-900 hover:text-indigo-700">{t.starred ? <i className="ti ti-star-filled mr-1 text-amber-500" aria-hidden="true" /> : null}{t.title}</Link></td>
                <td className="py-2 pr-2 text-slate-700">{w.label} <span className="text-slate-400">{formatRange(w.starts_on, w.ends_on)}</span></td>
                <td className="py-2 pr-2 text-slate-700">{ms.length}{ms.length ? <span className="ml-1 text-slate-400">{ms.slice(0, 3).map((m) => m.investor_name ?? m.investor_firm ?? "Investor").join(", ")}{ms.length > 3 ? ` +${ms.length - 3}` : ""}</span> : null}</td>
                <td className="py-2 pr-2 text-slate-700">{t.assignee_name ?? "—"}</td>
                <td className="py-2 pr-2"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_DOT[t.status] }} />{t.status === "in_progress" ? "In progress" : t.status === "done" ? "Done" : "New"}</span></td>
                <td className="py-2 pr-3 text-slate-500">{fmtDay(t.created_at)}</td>
              </tr>; })}
              {monthWeeks.every((w) => data.tasks.filter((t) => t.milestone_id === w.id).length === 0) ? <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No tasks in this month yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : (
      <HScrollBoard>
        {monthWeeks.map((w) => {
          const tasks = data.tasks.filter((t) => t.milestone_id === w.id);
          const done = tasks.filter((t) => t.status === "done").length;
          const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
          const isNow = currentWeek?.id === w.id;
          return (
            <div key={w.id} style={{ flex: "0 0 270px", minWidth: 270 }} className="px-1">
              <div className="mb-1 flex items-center justify-between">
                <span className={`text-[14px] font-semibold ${isNow ? "text-indigo-800" : "text-slate-900"}`}>{w.label}</span>
                <span className="flex items-center gap-2 text-[12px] text-slate-500">
                  <span>{formatRange(w.starts_on, w.ends_on)}</span>
                  <span className="font-medium text-slate-700">{tasks.length}</span>
                  <button type="button" disabled={busy} onClick={() => newTask(w.id)} aria-label={`New task in ${w.label}`} className="rounded px-1 text-slate-500 hover:bg-slate-100 hover:text-indigo-700"><i className="ti ti-plus" aria-hidden="true" /></button>
                </span>
              </div>
              <div className="mb-2.5 h-1.5 rounded bg-slate-200"><div className="h-1.5 rounded bg-emerald-500" style={{ width: `${pct}%` }} /></div>
              <div className="flex min-h-[60px] flex-col gap-2">
                {tasks.map((t) => {
                  const ms = matchesByTask.get(t.id) ?? [];
                  const anyHit = ms.some(hit);
                  if (needle && !anyHit && !t.title.toLowerCase().includes(needle)) return null;
                  const label = (m: IrMatch) => [m.investor_firm, m.investor_name].filter(Boolean).join(", ") || "Investor";
                  return (
                    <div key={t.id} className={`rounded-lg border bg-white p-2.5 shadow-sm hover:shadow ${anyHit ? "border-indigo-300" : "border-slate-200"}`}>
                      <Link href={`/admin/ir/projects/${projectId}/tasks/${t.id}`} className="block text-[13px] font-semibold text-slate-900 hover:text-indigo-700">{t.title}</Link>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {ms.map((m) => <span key={m.id} className={`rounded px-1.5 py-0.5 text-[10.5px] ${hit(m) ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{label(m)}</span>)}
                        {ms.length === 0 ? <span className="text-[10.5px] text-slate-400">no investors yet</span> : null}
                      </div>
                      <p className="mt-2 text-[11.5px] text-slate-600">{t.deadline ? new Date(`${t.deadline}T12:00:00Z`).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }) : fmtDay(t.created_at)}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-[12px] text-slate-400">
                        <button type="button" onClick={() => star(t)} aria-label="Star" className={t.starred ? "text-amber-500" : "hover:text-amber-400"}><i className={`ti ${t.starred ? "ti-star-filled" : "ti-star"}`} aria-hidden="true" /></button>
                        <Link href={`/admin/ir/projects/${projectId}/tasks/${t.id}?tab=meetings`} aria-label="Activities" className="hover:text-indigo-700"><i className="ti ti-clock" aria-hidden="true" /></Link>
                        <span className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[9px] font-semibold text-white" title={t.assignee_name ?? ""}>{initials(t.assignee_name)}</span>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_DOT[t.status] }} title={t.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </HScrollBoard>
      )}
    </div>
  );
}
