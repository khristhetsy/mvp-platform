"use client";

/**
 * Odoo import page. Import = one button per company (everything is mapped automatically,
 * see lib/ir/odoo-auto.ts). Reconcile and Backup are the cutover tools.
 */
import { useEffect, useState } from "react";
import type { ReconcileResult, ReconcileRow } from "@/lib/ir/odoo-reconcile";
import { AutoImportClient } from "./AutoImportClient";

const inp = "rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] focus:border-indigo-400 focus:outline-none";

export function ImportClient() {
  const [mode, setMode] = useState<"import" | "reconcile" | "backup">("import");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-[20px] font-semibold text-slate-900">Import from Odoo</h2><p className="text-[12.5px] text-slate-500">Pick a company and press Import. Projects, months, weeks, investors and activities are mapped for you.</p></div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Mode">{(["import", "reconcile", "backup"] as const).map((m) => <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-md px-2.5 py-1 text-[12px] font-medium ${mode === m ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"}`}>{m === "import" ? "Import" : m === "reconcile" ? "Reconcile" : "Backup"}</button>)}</div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-[12px] text-amber-800">Odoo is read only until cutover</span>
        </div>
      </div>
      {mode === "import" ? <AutoImportClient /> : null}
      {mode === "reconcile" ? <ReconcilePanel /> : null}
      {mode === "backup" ? <BackupPanel /> : null}
    </div>
  );
}

function ReconcilePanel() {
  const [projects, setProjects] = useState<Array<{ id: string; title: string; founder_name: string | null; status: string }> | null>(null);
  const [pid, setPid] = useState("");
  const [r, setR] = useState<ReconcileResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/admin/ir/import/reconcile").then((x) => x.json()).then((j) => { if (!live) return; if (j.error) { setErr(j.error); return; } setProjects(j.projects ?? []); });
    return () => { live = false; };
  }, []);
  async function run() {
    if (!pid) return;
    setBusy(true); setErr(null); setR(null);
    const x = await fetch(`/api/admin/ir/import/reconcile?project=${pid}`); const j = await x.json().catch(() => ({}));
    setBusy(false);
    if (!x.ok) { setErr(j.error ?? "Couldn't reconcile."); return; }
    setR(j);
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <span className="text-[13px] font-semibold text-slate-900">Reconcile an imported project with Odoo</span>
        <select value={pid} onChange={(e) => setPid(e.target.value)} className={inp}><option value="">Choose a project…</option>{(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.title}{p.founder_name ? ` · ${p.founder_name}` : ""} ({p.status})</option>)}</select>
        <button type="button" disabled={!pid || busy} onClick={run} className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? "Reading Odoo…" : "Compare"}</button>
        {projects && projects.length === 0 ? <span className="text-[12px] text-slate-400">No project has been imported from Odoo yet.</span> : null}
      </div>
      {err ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{err}</div> : null}
      {r ? (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-1 text-[14px] font-semibold text-slate-900">Totals · {r.project.title}</h3>
              <table className="w-full text-[12.5px]"><thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1 font-medium">Item</th><th className="py-1 text-right font-medium">Odoo</th><th className="py-1 text-right font-medium">IR Hub</th><th className="py-1 text-right font-medium">Δ</th></tr></thead><tbody className="divide-y divide-slate-100"><Row row={r.totals.tasks} /><Row row={r.totals.investors} /><Row row={r.totals.activities} /></tbody></table>
              <p className="mt-2 text-[11.5px] text-slate-400">Read {new Date(r.readAt).toLocaleString()}. Activities in the IR Hub include anything logged here since the import, so a positive Δ after cutover is expected; Odoo entries are the parsed Agent Field.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-1 text-[14px] font-semibold text-slate-900">By month</h3>
              <table className="w-full text-[12.5px]"><thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1 font-medium">Odoo project</th><th className="py-1 text-right font-medium">Tasks Odoo</th><th className="py-1 text-right font-medium">IR</th><th className="py-1 text-right font-medium">Entries Odoo</th><th className="py-1 text-right font-medium">IR</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{r.byMonth.map((m, i) => <tr key={i}><td className="py-1.5 pr-2 text-slate-800">{m.odooProject}{m.month ? <span className="text-slate-400"> · Month {m.month}</span> : null}</td><td className="py-1.5 text-right">{m.tasks.odoo}</td><td className={`py-1.5 text-right ${m.tasks.ir === m.tasks.odoo ? "text-emerald-700" : "text-amber-800"}`}>{m.tasks.ir}</td><td className="py-1.5 text-right">{m.entries.odoo}</td><td className={`py-1.5 text-right ${m.entries.ir >= m.entries.odoo ? "text-emerald-700" : "text-amber-800"}`}>{m.entries.ir}</td></tr>)}</tbody></table>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-1 text-[14px] font-semibold text-slate-900">Weekly counts · Odoo vs IR Hub</h3>
            <p className="mb-2 text-[11.5px] text-slate-500">Rollout step 6: compare each week&rsquo;s emails, calls and meetings while both systems run. Dates come from the Agent Field on the Odoo side and from done activities on the IR side.</p>
            {r.byWeek.length === 0 ? <p className="text-[12.5px] text-slate-400">No dated activity on either side yet.</p> : <table className="w-full text-[12.5px]"><thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1 font-medium">Week</th><th className="py-1 text-right font-medium">Emails O / IR</th><th className="py-1 text-right font-medium">Calls O / IR</th><th className="py-1 text-right font-medium">Meetings O / IR</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{r.byWeek.map((w) => { const c = (a: number, b: number) => (a === b ? "text-emerald-700" : "text-amber-800"); return <tr key={w.week}><td className="py-1.5 pr-2 text-slate-800">{w.week} <span className="text-slate-400">{w.range}</span></td><td className={`py-1.5 text-right ${c(w.odoo.emails, w.ir.emails)}`}>{w.odoo.emails} / {w.ir.emails}</td><td className={`py-1.5 text-right ${c(w.odoo.calls, w.ir.calls)}`}>{w.odoo.calls} / {w.ir.calls}</td><td className={`py-1.5 text-right ${c(w.odoo.meetings, w.ir.meetings)}`}>{w.odoo.meetings} / {w.ir.meetings}</td></tr>; })}</tbody></table>}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-1 text-[14px] font-semibold text-slate-900">Odoo tasks not in the IR Hub <span className="font-normal text-slate-500">· {r.drift.tasksNotImported.length}</span></h3>
              {r.drift.tasksNotImported.length === 0 ? <p className="text-[12.5px] text-emerald-700">Every Odoo task is imported.</p> : <><ul className="max-h-48 overflow-auto text-[12.5px] text-slate-700">{r.drift.tasksNotImported.map((t) => <li key={t.id} className="py-0.5">{t.name} <span className="text-slate-400">· {t.project}</span></li>)}</ul><p className="mt-2 text-[11.5px] text-slate-500">Run Import for this founder again — tasks already in the IR Hub are skipped, only these are added.</p></>}
              {r.drift.irTasksNotInOdoo ? <p className="mt-2 text-[11.5px] text-slate-500">{r.drift.irTasksNotInOdoo} IR Hub task{r.drift.irTasksNotInOdoo === 1 ? "" : "s"} created here after import (no Odoo counterpart) — expected once work moves to the IR Hub.</p> : null}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-1 text-[14px] font-semibold text-slate-900">Odoo investor tags with no match <span className="font-normal text-slate-500">· {r.drift.tagsUnmatched.length}</span></h3>
              {r.drift.tagsUnmatched.length === 0 ? <p className="text-[12.5px] text-emerald-700">Every tag resolved to an Investor Contact.</p> : <><ul className="max-h-48 overflow-auto text-[12.5px] text-slate-700">{r.drift.tagsUnmatched.map((t) => <li key={t} className="py-0.5">{t}</li>)}</ul><p className="mt-2 text-[11.5px] text-slate-500">Add the investor in Sales Hub, then re-run Import — the tag resolves and the match is created.</p></>}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Row({ row }: { row: ReconcileRow }) { const d = row.ir - row.odoo; return <tr><td className="py-1.5 pr-3 text-slate-800">{row.label}</td><td className="py-1.5 pr-3 text-right">{row.odoo}</td><td className="py-1.5 pr-3 text-right">{row.ir}</td><td className={`py-1.5 text-right ${d === 0 ? "text-emerald-700" : "text-amber-800"}`}>{d === 0 ? "match" : d > 0 ? `+${d}` : d}</td></tr>; }

function BackupPanel() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-[15px] font-semibold text-slate-900">Full Odoo snapshot</h3>
      <p className="mt-1 text-[12.5px] text-slate-600">Rollout step 8: before Odoo is turned off, download the complete Deals2Match record as JSON — every project, every task with its tags, assignee, dates and Agent Field, all tags, and the task chatter (mail.message). Odoo is only read. Keep the file with the company records; it is the reference if a count is ever questioned after cutover.</p>
      <a href="/api/admin/ir/import/snapshot" className="mt-3 inline-block rounded-lg bg-indigo-600 px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700">Download Odoo snapshot (JSON)</a>
      <p className="mt-3 text-[11.5px] text-slate-400">Reads 18 projects and their tasks live, so it can take a few seconds. After the snapshot and the final import, the <code>odoo_*</code> trace columns can be dropped in a later migration.</p>
    </div>
  );
}

