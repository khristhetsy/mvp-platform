"use client";

/** Hub-level Founder report landing: one row per active founder with the latest report's status; click through to the report. */
import { useEffect, useState } from "react";
import Link from "next/link";

type Row = { id: string; title: string; founder_name: string | null; owner_name: string | null; milestone: string; status: "not_started" | "draft" | "approved" | "sent"; period: string | null; at: string | null; weekly: boolean; monthly: boolean; hasEmail: boolean };
const STATUS: Record<Row["status"], { label: string; cls: string }> = { not_started: { label: "Not started", cls: "bg-slate-100 text-slate-600" }, draft: { label: "Draft", cls: "bg-amber-50 text-amber-800" }, approved: { label: "Approved", cls: "bg-blue-50 text-blue-800" }, sent: { label: "Sent", cls: "bg-emerald-50 text-emerald-800" } };

export function ReportsLandingClient() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/admin/ir/reports").then((r) => r.json()).then((j) => { if (!live) return; if (j.error) { setError(j.error); return; } setRows(j.rows ?? []); });
    return () => { live = false; };
  }, []);
  if (error) return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>;
  if (!rows) return <p className="text-[13px] text-slate-400">Loading…</p>;
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between"><span className="text-[15px] font-semibold text-slate-900">Founder report</span><span className="text-[12px] text-slate-500">One report per founder per period · AI drafts, staff approve, then send</span></div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-[12.5px]">
          <thead><tr className="bg-slate-50 text-left text-[11px] text-slate-500"><th className="px-3 py-2 font-medium">Founder</th><th className="py-2 pr-2 font-medium">Owner</th><th className="py-2 pr-2 font-medium">Milestone</th><th className="py-2 pr-2 font-medium">Latest report</th><th className="py-2 pr-2 font-medium">Scheduled</th><th className="py-2 pr-3"></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-3 py-2"><Link href={`/admin/ir/projects/${r.id}/report`} className="font-medium text-slate-900 hover:text-indigo-700">{r.title}</Link>{r.founder_name ? <span className="block text-[11px] text-slate-500">{r.founder_name}{r.hasEmail ? "" : " · no founder email on file"}</span> : null}</td>
              <td className="py-2 pr-2 text-slate-700">{r.owner_name ?? "—"}</td>
              <td className="py-2 pr-2 text-slate-700">{r.milestone}</td>
              <td className="py-2 pr-2"><span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>{r.period ? <span className="ml-2 text-slate-600">{r.period}</span> : null}{r.at ? <span className="ml-2 text-slate-400">{new Date(r.at).toLocaleDateString()}</span> : null}</td>
              <td className="py-2 pr-2 text-slate-600">{[r.weekly ? "Weekly" : null, r.monthly ? "Monthly" : null].filter(Boolean).join(" + ") || <span className="text-slate-400">Off</span>}</td>
              <td className="py-2 pr-3 text-right"><Link href={`/admin/ir/projects/${r.id}/report`} className="text-indigo-700 hover:underline">Open</Link></td>
            </tr>)}
            {rows.length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No active projects yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
