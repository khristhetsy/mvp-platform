"use client";

import { useState } from "react";

type Row = {
  id: string; contact_id: string; company: string | null; proposed_industries: string[]; proposed_type: string | null;
  confidence: number; basis: string | null; rationale: string | null; status: string;
};

const HIGH = 85;

export function EnrichClient({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  async function refresh() {
    const d = await fetch("/api/admin/investors/enrich?status=pending").then((r) => r.json()).catch(() => ({ proposals: [] }));
    setRows(d.proposals ?? []);
  }
  async function runBatch() {
    return fetch("/api/admin/investors/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "run", limit: 40 }) }).then((r) => r.json());
  }
  async function run() {
    setBusy(true); setMsg("Running AI enrichment…");
    try {
      const d = await runBatch();
      setMsg(`Scanned ${d.scanned} missing · proposed ${d.proposed} · skipped ${d.skipped} (no signal). ${d.remaining > 0 ? `${d.remaining} to go — run again or use Run all.` : "All done."}`);
      await refresh();
    } catch { setMsg("Enrichment failed."); } finally { setBusy(false); }
  }
  async function runAll() {
    setBusy(true);
    let totalProposed = 0, totalSkipped = 0, guard = 0;
    try {
      // Auto-continue through 40-at-a-time batches until nothing is left (each batch
      // stays within the serverless time limit). Guard caps runaway loops.
      while (guard++ < 200) {
        const d = await runBatch();
        totalProposed += d.proposed ?? 0; totalSkipped += d.skipped ?? 0;
        setMsg(`Processing… ${d.remaining ?? 0} remaining · ${totalProposed} proposed so far`);
        if (!d || (d.remaining ?? 0) <= 0) break;
      }
      setMsg(`Done — ${totalProposed} proposed, ${totalSkipped} skipped (no signal).`);
      await refresh();
    } catch { setMsg("Enrichment stopped on an error — re-run to continue."); await refresh(); } finally { setBusy(false); }
  }
  async function bulk() {
    setBusy(true);
    try {
      const d = await fetch("/api/admin/investors/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "bulk", minConfidence: HIGH }) }).then((r) => r.json());
      setMsg(`Approved ${d.approved} high-confidence (≥${HIGH}%).`);
      await refresh();
    } finally { setBusy(false); }
  }
  async function decide(id: string, action: "approve" | "reject", industries?: string[], type?: string | null) {
    setBusy(true);
    try {
      await fetch(`/api/admin/investors/enrich/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, industries, type }) });
      setRows((p) => p.filter((r) => r.id !== id)); setEditId(null);
    } finally { setBusy(false); }
  }

  const highCount = rows.filter((r) => r.confidence >= HIGH).length;
  const confColor = (c: number) => (c >= HIGH ? "#3B6D11" : c >= 60 ? "#185FA5" : "#CA8A04");

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void run()} disabled={busy} className="rounded-lg border border-indigo-300 bg-white px-3.5 py-2 text-[13px] font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">▷ Run next 40</button>
        <button type="button" onClick={() => void runAll()} disabled={busy} className="rounded-lg bg-indigo-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50">▷▷ Run all</button>
        {highCount > 0 ? <button type="button" onClick={() => void bulk()} disabled={busy} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-[13px] font-medium text-emerald-700 disabled:opacity-50">✓ Approve all ≥{HIGH}% ({highCount})</button> : null}
        <span className="ml-auto text-[12px] text-slate-500">{rows.length} pending{msg ? ` · ${msg}` : ""}</span>
      </div>

      <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-slate-400">No pending proposals. Click <b>Run enrichment</b> to generate some.</div>
        ) : rows.map((r) => (
          <div key={r.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <a href={`/admin/sales/contacts/${r.contact_id}`} className="text-[13px] font-medium text-slate-800 hover:underline">{r.company ?? "(no company)"}</a>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ color: "#6B3FA0", border: "0.5px solid #C9B8E6" }}>◆ inferred</span>
              <span className="ml-auto flex items-center gap-2 text-[11px]">
                <span className="inline-block h-1.5 w-14 rounded bg-slate-100"><span className="block h-full rounded" style={{ width: `${Math.min(100, r.confidence)}%`, background: confColor(r.confidence) }} /></span>
                <b style={{ color: confColor(r.confidence) }}>{r.confidence}%</b>
                <span className="text-slate-400">{r.basis ?? ""}</span>
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[10.5px] text-slate-400">Proposes:</span>
              {r.proposed_industries.map((s) => <span key={s} className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10.5px] text-emerald-700">{s}</span>)}
              {r.proposed_type ? <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10.5px] text-indigo-700">{r.proposed_type}</span> : null}
              {r.proposed_industries.length === 0 && !r.proposed_type ? <span className="text-[10.5px] text-slate-400">— nothing usable</span> : null}
            </div>
            {r.rationale ? <div className="mt-1 text-[10.5px] text-slate-400">{r.rationale}</div> : null}

            {editId === r.id ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input value={editVal} onChange={(e) => setEditVal(e.target.value)} placeholder="Industries, comma-separated" className="min-w-[220px] flex-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[12px]" />
                <button type="button" disabled={busy} onClick={() => void decide(r.id, "approve", editVal.split(",").map((s) => s.trim()).filter(Boolean), r.proposed_type)} className="rounded-md bg-indigo-600 px-3 py-1.5 text-[11.5px] font-medium text-white">Save &amp; approve</button>
                <button type="button" onClick={() => setEditId(null)} className="text-[11.5px] text-slate-500">Cancel</button>
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={busy} onClick={() => void decide(r.id, "approve")} className="rounded-md bg-emerald-600 px-3 py-1 text-[11.5px] font-medium text-white disabled:opacity-50">Approve</button>
                <button type="button" disabled={busy} onClick={() => { setEditId(r.id); setEditVal(r.proposed_industries.join(", ")); }} className="rounded-md border border-slate-200 px-3 py-1 text-[11.5px] text-slate-600">Edit</button>
                <button type="button" disabled={busy} onClick={() => void decide(r.id, "reject")} className="rounded-md border border-rose-200 px-3 py-1 text-[11.5px] text-rose-600">Reject</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
