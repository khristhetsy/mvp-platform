"use client";

/**
 * Project › Milestones — the month milestones with their weeks. Progress is the share of
 * week tasks marked done; investors counts the matches confirmed on those weeks. A month
 * with no tasks shows as "no tasks yet", not 0%.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatRange } from "@/lib/ir/milestones";
import type { IrMatch, IrMilestone, IrProject, IrTask } from "@/lib/ir/types";

type Payload = { project: IrProject; milestones: IrMilestone[]; tasks: IrTask[]; matches: IrMatch[] };

export function MilestonesClient({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  useEffect(() => {
    let live = true;
    void fetch(`/api/admin/ir/projects/${projectId}`).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!live) return;
      if (!r.ok) setError(j.error ?? "Couldn't load the project."); else setData(j);
    });
    return () => { live = false; };
  }, [projectId]);

  if (error) return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>;
  if (!data) return <p className="text-[13px] text-slate-400">Loading…</p>;
  const months = data.milestones.filter((m) => m.kind === "month").sort((a, b) => a.sort_order - b.sort_order);
  const weeksOf = (id: string) => data.milestones.filter((m) => m.kind === "week" && m.parent_id === id).sort((a, b) => a.sort_order - b.sort_order);
  const tasksOn = (weekIds: string[]) => data.tasks.filter((t) => weekIds.includes(t.milestone_id));
  const matchesOn = (weekIds: string[]) => data.matches.filter((m) => m.milestone_id && weekIds.includes(m.milestone_id)).length;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
        <Link href="/admin/ir/projects" className="hover:text-indigo-700">Projects</Link><span>/</span>
        <Link href={`/admin/ir/projects/${projectId}`} className="hover:text-indigo-700">{data.project.title}</Link><span>/</span><span className="text-slate-800">Milestones</span>
      </div>
      <h2 className="mb-3 text-[18px] font-semibold text-slate-900">{data.project.title} · Milestones</h2>
      <div className="space-y-3">
        {months.map((m) => {
          const weeks = weeksOf(m.id), ids = weeks.map((w) => w.id), tasks = tasksOn(ids), done = tasks.filter((t) => t.status === "done").length;
          const pct = tasks.length ? Math.round((done / tasks.length) * 100) : null;
          const now = m.starts_on <= today && today < m.ends_on;
          return (
            <section key={m.id} className={`rounded-xl border bg-white p-4 ${now ? "border-indigo-300" : "border-slate-200"}`}>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[14px] font-semibold text-slate-900">{m.label}{now ? <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">Current</span> : null}</p>
                <span className="text-[12px] text-slate-500">{formatRange(m.starts_on, m.ends_on)}</span>
                <span className="ml-auto text-[12px] text-slate-600">{tasks.length ? `${done} of ${tasks.length} tasks done` : "No tasks yet"} · {matchesOn(ids)} investors</span>
              </div>
              <div className="mt-2 h-2 rounded bg-slate-100" role="progressbar" aria-valuenow={pct ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={`${m.label} progress`}>
                {pct != null ? <div className="h-2 rounded bg-emerald-500" style={{ width: `${pct}%` }} /> : null}
              </div>
              <ul className="mt-3 divide-y divide-slate-100 text-[12.5px]">
                {weeks.map((w) => {
                  const wt = tasksOn([w.id]);
                  return (
                    <li key={w.id} className="flex flex-wrap items-center gap-2 py-1.5">
                      <span className="w-20 font-medium text-slate-800">{w.label}</span>
                      <span className="w-40 text-slate-500">{formatRange(w.starts_on, w.ends_on)}</span>
                      <span className="min-w-0 flex-1 truncate">{wt.length ? wt.map((t, i) => <span key={t.id}>{i ? ", " : ""}<Link href={`/admin/ir/projects/${projectId}/tasks/${t.id}`} className="text-indigo-700 hover:underline">{t.title}</Link></span>) : <span className="text-slate-400">No task</span>}</span>
                      <span className="text-slate-500">{wt.filter((t) => t.status === "done").length}/{wt.length} done</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
