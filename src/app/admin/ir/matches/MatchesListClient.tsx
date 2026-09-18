"use client";

/** Hub-level Share Project list: every investor record across active projects (Odoo list view). Click a row to open the record. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IR_STAGES, IR_STAGE_LABEL, type IrMatch, type IrStage } from "@/lib/ir/types";

type Row = IrMatch & { project_title: string; next: { subject: string; due_at: string | null } | null };
type Payload = { rows: Row[]; total: number; projects: Array<{ id: string; title: string }>; staff: Array<{ id: string; name: string }> };
const inp = "rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] focus:border-indigo-400 focus:outline-none";
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
const STAGE_CLS: Partial<Record<IrStage, string>> = { committed: "bg-emerald-50 text-emerald-800", passed: "bg-slate-100 text-slate-600", meeting_scheduled: "bg-amber-50 text-amber-800", meeting_held: "bg-amber-50 text-amber-800" };

export function MatchesListClient() {
  const [project, setProject] = useState(""); const [stage, setStage] = useState(""); const [assignee, setAssignee] = useState(""); const [q, setQ] = useState("");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    const p = new URLSearchParams(); if (project) p.set("project", project); if (stage) p.set("stage", stage); if (assignee) p.set("assignee", assignee); if (q.trim()) p.set("q", q.trim());
    const r = await fetch(`/api/admin/ir/matches?${p}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? "Couldn't load records."); return; }
    setData(j); setError(null);
  }, [project, stage, assignee, q]);
  useEffect(() => { const h = setTimeout(() => { void load(); }, q ? 250 : 0); return () => clearTimeout(h); }, [load, q]);

  if (error && !data) return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>;
  if (!data) return <p className="text-[13px] text-slate-400">Loading…</p>;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[15px] font-semibold text-slate-900">Share Project</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search investor, firm, founder…" className={`ml-2 w-64 ${inp}`} />
        <select value={project} onChange={(e) => setProject(e.target.value)} className={inp}><option value="">All founders</option>{data.projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
        <select value={stage} onChange={(e) => setStage(e.target.value)} className={inp}><option value="">All stages</option>{IR_STAGES.map((s) => <option key={s} value={s}>{IR_STAGE_LABEL[s]}</option>)}</select>
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inp}><option value="">All assignees</option>{data.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <span className="ml-auto text-[12px] text-slate-500">{data.total ? `1-${Math.min(data.rows.length, data.total)} / ${data.total}` : "0 / 0"}</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-[12.5px]">
          <thead><tr className="bg-slate-50 text-left text-[11px] text-slate-500"><th className="px-3 py-2 font-medium">Investor</th><th className="py-2 pr-2 font-medium">Firm</th><th className="py-2 pr-2 font-medium">Founder</th><th className="py-2 pr-2 font-medium">Stage</th><th className="py-2 pr-2 font-medium">Assignee</th><th className="py-2 pr-2 font-medium">Next activity</th><th className="py-2 pr-3 font-medium">Since</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.map((m) => { const late = m.next?.due_at ? new Date(m.next.due_at).getTime() < now : false; return (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-3 py-2"><Link href={`/admin/ir/matches/${m.id}`} className="font-medium text-slate-900 hover:text-indigo-700">{m.starred ? <i className="ti ti-star-filled mr-1 text-amber-500" aria-hidden="true" /> : null}{m.investor_name ?? "—"}</Link></td>
                <td className="py-2 pr-2 text-slate-700">{m.investor_firm ?? "—"}</td>
                <td className="py-2 pr-2 text-slate-700"><Link href={`/admin/ir/projects/${m.project_id}`} className="hover:text-indigo-700">{m.project_title}</Link></td>
                <td className="py-2 pr-2"><span className={`rounded-full px-2 py-0.5 text-[11px] ${STAGE_CLS[m.stage] ?? "bg-blue-50 text-blue-800"}`}>{IR_STAGE_LABEL[m.stage]}</span></td>
                <td className="py-2 pr-2 text-slate-700">{m.assignee_name ?? "—"}</td>
                <td className="py-2 pr-2 text-slate-700">{m.next ? <span className={late ? "text-rose-600" : ""}>{m.next.subject}{m.next.due_at ? ` · ${fmt(m.next.due_at)}` : ""}</span> : <span className="text-slate-400">—</span>}</td>
                <td className="py-2 pr-3 text-slate-500">{fmt(m.stage_changed_at)}</td>
              </tr>
            ); })}
            {data.rows.length === 0 ? <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">{data.projects.length ? "No records match these filters." : "No active projects yet — create one, then match investors from a task."}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
