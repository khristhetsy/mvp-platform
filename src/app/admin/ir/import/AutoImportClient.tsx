"use client";

/** Odoo import with nothing to choose: the company list, one Import button per row, and the result. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AutoCompany, AutoResult } from "@/lib/ir/odoo-auto";
import type { ResyncResult } from "@/lib/ir/odoo-resync";

export function AutoImportClient() {
  const [companies, setCompanies] = useState<AutoCompany[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<AutoResult | null>(null);
  const [history, setHistory] = useState<(ResyncResult & { company: string }) | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/ir/import/auto");
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? "Couldn't read from Odoo."); return; }
    setConfigured(j.configured); setCompanies(j.companies ?? []);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set
  useEffect(() => { void load(); }, [load]);

  async function run(key: string, createMissing = false) {
    setBusy(key); setError(null);
    const r = await fetch("/api/admin/ir/import/auto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, createMissing }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setError(j.error ?? "Import failed."); return; }
    setResult({ ...j, key } as AutoResult & { key: string });
    await load();
  }

  /** Activity history: preview first (reads Odoo, writes nothing), then apply. */
  async function recover(c: AutoCompany, apply = false) {
    if (!c.projectId) return;
    setBusy(`h:${c.key}`); setError(null); if (!apply) setHistory(null);
    const r = apply
      ? await fetch("/api/admin/ir/import/resync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: c.projectId }) })
      : await fetch(`/api/admin/ir/import/resync?project=${c.projectId}`);
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setError(j.error ?? "Couldn't read the history from Odoo."); return; }
    setHistory({ ...(j as ResyncResult), company: c.name });
  }

  if (error && !companies) return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>;
  if (!companies) return <p className="text-[13px] text-slate-400">Reading from Odoo…</p>;
  if (!configured) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-[13px] text-amber-900"><p className="font-semibold">Odoo isn&rsquo;t connected on this environment.</p><p className="mt-1">Set <code>ODOO_URL</code>, <code>ODOO_DB</code>, <code>ODOO_USERNAME</code> and <code>ODOO_API_KEY</code> on the deployment and reopen this page.</p></div>;

  const resultKey = (result as (AutoResult & { key?: string }) | null)?.key;
  return (
    <div className="flex flex-col gap-4">
      {error ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div> : null}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-[13px]">
          <thead><tr className="bg-slate-50 text-left text-[11px] text-slate-500"><th className="px-4 py-2 font-medium">Company</th><th className="py-2 pr-3 font-medium">Months</th><th className="py-2 pr-3 font-medium">Tasks</th><th className="py-2 pr-3 font-medium">Agent</th><th className="py-2 pr-3 font-medium">Status</th><th className="py-2 pr-4"></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {companies.map((c) => (
              <tr key={c.key}>
                <td className="px-4 py-2.5 font-medium text-slate-900">{c.name}</td>
                <td className="py-2.5 pr-3 text-slate-600">{c.months}</td>
                <td className="py-2.5 pr-3 text-slate-600">{c.tasks}</td>
                <td className="py-2.5 pr-3 text-slate-600">{c.agent ?? "—"}</td>
                <td className="py-2.5 pr-3">{c.projectId ? <Link href={`/admin/ir/projects/${c.projectId}`} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 hover:underline">Imported · open</Link> : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">Not imported</span>}</td>
                <td className="py-2.5 pr-4 text-right">{c.projectId ? <button type="button" disabled={busy !== null} onClick={() => recover(c)} className="mr-2 rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50 disabled:opacity-60">{busy === `h:${c.key}` ? "Reading…" : "Recover history"}</button> : null}<button type="button" disabled={busy !== null} onClick={() => run(c.key)} className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy === c.key ? "Importing…" : c.projectId ? "Import again" : "Import"}</button></td>
              </tr>
            ))}
            {companies.length === 0 ? <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No projects in Odoo.</td></tr> : null}
          </tbody>
        </table>
      </div>

      {history ? (() => {
        const h = history; const c = companies.find((x) => x.projectId === h.projectId);
        const parts = ([["call", "calls"], ["voicemail", "voicemails"], ["email", "emails"], ["meeting", "meetings"], ["term_sheet", "term sheets"], ["document", "documents"]] as const).filter(([k]) => h.toAdd[k] > 0).map(([k, l]) => `${h.toAdd[k]} ${l}`);
        return (
          <div className="rounded-xl border border-indigo-200 bg-white p-5 text-[13px] text-slate-700">
            <h3 className="text-[15px] font-semibold text-slate-900">{h.company}: activity history in Odoo</h3>
            <p className="mt-1">{h.odooTasks} Odoo task{h.odooTasks === 1 ? "" : "s"}, {h.tasksWithNotes} with Agent Field notes, {h.entries} note entr{h.entries === 1 ? "y" : "ies"}.</p>
            {h.toAdd.total ? (
              <p className="mt-1">{h.dryRun ? "Can add" : "Added"} <strong>{h.toAdd.total}</strong> dated activit{h.toAdd.total === 1 ? "y" : "ies"}: {parts.join(", ")}. {h.toAdd.onInvestor} on a named investor, {h.toAdd.onTask} on the task (no investor named){h.stagesAdvanced ? `, ${h.stagesAdvanced} investor stage${h.stagesAdvanced === 1 ? "" : "s"} moved forward` : ""}.</p>
            ) : <p className="mt-1">Nothing new to add.</p>}
            <p className="mt-1 text-[12px] text-slate-500">{h.alreadyPresent} already in iCapOS · {h.skippedUndated} without a date · {h.skippedNotes} general notes · {h.tasksNotImported} task{h.tasksNotImported === 1 ? "" : "s"} not imported yet. Undated entries and notes are left out rather than guessed.</p>
            {h.dryRun && h.sample.length ? <ul className="mt-2 list-disc pl-5 text-[12px] text-slate-600">{h.sample.map((s, i) => <li key={i}>{s.date} · {s.type.replace("_", " ")} · {s.outcome}{s.investor ? ` (${s.investor})` : ""}</li>)}</ul> : null}
            {h.dryRun && h.toAdd.total && c ? <button type="button" disabled={busy !== null} onClick={() => recover(c, true)} className="mt-3 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? "Adding…" : `Add ${h.toAdd.total} activities`}</button> : null}
          </div>
        );
      })() : null}

      {result ? (
        <div className="rounded-xl border border-emerald-200 bg-white p-5">
          <h3 className="text-[15px] font-semibold text-emerald-800">{result.company} imported</h3>
          <p className="mt-1 text-[13px] text-slate-700">{result.tasksCreated} task{result.tasksCreated === 1 ? "" : "s"}{result.tasksSkipped ? ` (${result.tasksSkipped} already there)` : ""} · {result.matchesCreated} investor{result.matchesCreated === 1 ? "" : "s"}{result.matchesReused ? ` (${result.matchesReused} already there)` : ""} · {result.activitiesCreated} activit{result.activitiesCreated === 1 ? "y" : "ies"}{result.founderCreated ? " · founder contact created in Sales" : ""}</p>
          {result.missing.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
              <span>{result.missing.length} investor{result.missing.length === 1 ? " is" : "s are"} not in Sales yet, so {result.missing.length === 1 ? "it was" : "they were"} left out.</span>
              <button type="button" disabled={busy !== null || !resultKey} onClick={() => resultKey && run(resultKey, true)} className="rounded-lg bg-amber-600 px-3 py-1 text-[12px] font-semibold text-white hover:bg-amber-700 disabled:opacity-60">{busy ? "Working…" : `Create ${result.missing.length === 1 ? "it" : "them"} and finish`}</button>
            </div>
          ) : null}
          {result.warnings.length ? <ul className="mt-2 list-disc pl-5 text-[12px] text-amber-800">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul> : null}
          <div className="mt-3 flex gap-2"><Link href={`/admin/ir/projects/${result.projectId}`} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700">Open the project</Link><Link href={`/admin/ir/projects/${result.projectId}/tasks`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50">Tasks</Link></div>
        </div>
      ) : null}
    </div>
  );
}
