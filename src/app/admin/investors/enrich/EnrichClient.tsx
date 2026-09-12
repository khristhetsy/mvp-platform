"use client";

import { useState } from "react";

type Row = {
  id: string; contact_id: string; company: string | null; proposed_industries: string[]; proposed_type: string | null;
  proposed_stage: string[]; confidence: number; basis: string | null; rationale: string | null; status: string;
};

type JtChange = { contactId: string; name: string | null; oldCompany: string | null; newCompany: string | null; newType: string | null };

const HIGH = 85;
// The closed stage vocabulary the matcher compares against (mirrors STAGE_VOCAB on the
// server). Editing is a toggle rather than free text so a reviewer can't type a value
// that would silently never match.
const STAGES = ["Startup", "Prototype", "Expand Growth", "Small Business", "Midsize Company", "Large Corporation", "Large Company"];

export function EnrichClient({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [editStages, setEditStages] = useState<string[]>([]);
  // Step 1 — deterministic job-title backfill (no AI). Preview before applying.
  const [jt, setJt] = useState<{ changes: JtChange[]; total: number; rowsRead: number; companies: number; types: number } | null>(null);
  const [jtMsg, setJtMsg] = useState<string | null>(null);

  async function jtPreview() {
    setBusy(true); setJtMsg("Scanning job titles…");
    try {
      const res = await fetch("/api/admin/investors/job-title-backfill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "preview" }) });
      if (!res.ok) { setJtMsg("Preview failed."); return; }
      const d = await res.json();
      setJt(d); setJtMsg(d.total === 0 ? `Nothing to backfill — scanned ${d.rowsRead} investor contacts, no job title yielded a change.` : null);
    } finally { setBusy(false); }
  }
  // Step 1b — derive stage from investor type. Deterministic, free, never overwrites a
  // stated stage. Also runs after each contacts sync so new investors stay covered.
  const [dv, setDv] = useState<{ total: number; scanned: number; byRule: Record<string, number>; rules: { id: string; label: string; stages: string[] }[] } | null>(null);
  const [dvMsg, setDvMsg] = useState<string | null>(null);
  async function derive(op: "preview" | "apply") {
    setBusy(true); setDvMsg(op === "preview" ? "Scanning…" : "Filling…");
    try {
      const res = await fetch("/api/admin/investors/derive-stage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op }) });
      if (!res.ok) { setDvMsg(`${op} failed.`); return; }
      const d = await res.json();
      if (op === "preview") { setDv(d); setDvMsg(d.total === 0 ? `Nothing to derive — scanned ${d.scanned}, every investor already has a stage or no usable type.` : null); }
      else { setDvMsg(`Filled ${d.filled} of ${d.scanned} scanned${d.errors ? ` · ${d.errors} failed: ${d.firstError ?? ""}` : ""}${d.reindexed ? ` · ${d.reindexed} reindexed` : ""}.`); setDv(null); }
    } finally { setBusy(false); }
  }
  async function undoRule(ruleId: string) {
    setBusy(true); setDvMsg(`Undoing ${ruleId}…`);
    try {
      const res = await fetch("/api/admin/investors/derive-stage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "undo", ruleId }) });
      const d = await res.json();
      setDvMsg(res.ok ? `Removed ${d.removed} stages written by ${ruleId}.` : "Undo failed.");
    } finally { setBusy(false); }
  }

  // Step 3 — refresh the narrow table /fit matches against. Also runs after each
  // contacts sync; this is the "don't wait four hours" button.
  const [idxMsg, setIdxMsg] = useState<string | null>(null);
  async function rebuildIndex(full = false) {
    setBusy(true); setIdxMsg(full ? "Full rebuild…" : "Rebuilding changed contacts…");
    try {
      const res = await fetch(`/api/admin/investors/match-index${full ? "?full=1" : ""}`, { method: "POST" });
      if (!res.ok) { setIdxMsg("Rebuild failed."); return; }
      const d = await res.json();
      setIdxMsg(`${d.mode === "full" ? "Full" : "Incremental"} — indexed ${d.written} from ${d.scanned} scanned${d.removed ? `, removed ${d.removed} stale` : ""}.`);
    } finally { setBusy(false); }
  }

  async function jtApply() {
    setBusy(true); setJtMsg("Applying…");
    try {
      const res = await fetch("/api/admin/investors/job-title-backfill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "apply" }) });
      if (!res.ok) { setJtMsg("Apply failed."); return; }
      const d = await res.json();
      setJtMsg(d.errors > 0
        ? `Applied ${d.companies} companies, ${d.types} types — but ${d.errors} of ${d.scanned} failed: ${d.firstError ?? "unknown error"}`
        : `Applied — ${d.companies} company names, ${d.types} investor types (from ${d.rowsRead} contacts scanned)${d.reindexed ? `, ${d.reindexed} reindexed for /fit` : ""}.`);
      setJt(null);
    } finally { setBusy(false); }
  }

  async function refresh() {
    const d = await fetch("/api/admin/investors/enrich?status=pending").then((r) => r.json()).catch(() => ({ proposals: [] }));
    setRows(d.proposals ?? []);
  }
  async function runBatch(limit = 40) {
    const res = await fetch("/api/admin/investors/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "run", limit }) });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }
  async function run() {
    setBusy(true); setMsg("Running AI enrichment…");
    try {
      const d = await runBatch();
      if (d.unavailable) { setMsg(`AI unavailable: ${d.unavailable} — nothing was written off.`); return; }
      setMsg(`Scanned ${d.scanned} missing · proposed ${d.proposed} · skipped ${d.skipped} (no signal). ${d.remaining > 0 ? `${d.remaining} to go — run again or use Run all.` : "All done."}`);
      await refresh();
    } catch { setMsg("Enrichment failed."); } finally { setBusy(false); }
  }
  async function runAll() {
    setBusy(true);
    let totalProposed = 0, totalSkipped = 0, guard = 0, fails = 0;
    // Smaller batches (20) so each pass finishes well inside the serverless limit even
    // with website fetches. A stalled batch is retried; work is committed per batch so
    // nothing is lost on a transient error.
    while (guard++ < 400) {
      try {
        const d = await runBatch(20);
        // The AI is unreachable (no credits, rate limit, outage). Stop immediately —
        // continuing would march through every remaining contact recording nothing.
        if (d.unavailable) { setMsg(`Stopped — AI unavailable: ${d.unavailable}. ${totalProposed} proposed before stopping; no contacts were written off.`); break; }
        totalProposed += d.proposed ?? 0; totalSkipped += d.skipped ?? 0; fails = 0;
        setMsg(`Processing… ${d.remaining ?? 0} remaining · ${totalProposed} proposed so far`);
        await refresh();
        if ((d.remaining ?? 0) <= 0) { setMsg(`Done — ${totalProposed} proposed, ${totalSkipped} skipped (no signal).`); break; }
      } catch {
        fails++;
        if (fails >= 3) { setMsg(`Paused after a few errors — ${totalProposed} proposed so far. Click Run all to resume.`); break; }
        await new Promise((r) => setTimeout(r, 1500)); // brief backoff, then retry the next batch
      }
    }
    setBusy(false);
  }
  async function bulk() {
    setBusy(true);
    try {
      const d = await fetch("/api/admin/investors/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "bulk", minConfidence: HIGH }) }).then((r) => r.json());
      setMsg(`Approved ${d.approved} high-confidence (≥${HIGH}%).`);
      await refresh();
    } finally { setBusy(false); }
  }
  async function decide(id: string, action: "approve" | "reject", industries?: string[], type?: string | null, stages?: string[]) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/investors/enrich/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, industries, type, stages }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.ok === false) { setMsg(`Couldn't ${action} — ${d.error ?? "try again"}.`); return; }
      setRows((p) => p.filter((r) => r.id !== id)); setEditId(null);
    } finally { setBusy(false); }
  }

  const highCount = rows.filter((r) => r.confidence >= HIGH).length;
  const confColor = (c: number) => (c >= HIGH ? "#3B6D11" : c >= 60 ? "#185FA5" : "#CA8A04");

  return (
    <div>
      {/* Step 1 — deterministic, free, and it improves the signal Step 2 reads. */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
        <div className="text-[13px] font-semibold text-slate-800">Step 1 · Backfill from job title <span className="font-normal text-slate-500">— free, instant, run this first</span></div>
        <p className="mt-1 text-[11.5px] text-slate-500">Pulls the firm name out of &ldquo;Technology Investor <b>at</b> TA Associates&rdquo; and sets the investor type when the title actually names one. A real company name is never overwritten — only blanks and rows where the company is the contact&rsquo;s own name.</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void jtPreview()} disabled={busy} className="rounded-lg border border-indigo-300 bg-white px-3.5 py-2 text-[13px] font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">⌕ Preview</button>
          {jt && jt.total > 0 ? (
            <button type="button" onClick={() => void jtApply()} disabled={busy} className="rounded-lg bg-slate-800 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-slate-900 disabled:opacity-50">✓ Apply {jt.total}</button>
          ) : null}
          {jt ? <span className="text-[11.5px] text-slate-500">{jt.companies} companies · {jt.types} types · scanned {jt.rowsRead}{jt.total > jt.changes.length ? ` · showing first ${jt.changes.length}` : ""}</span> : null}
          {jtMsg ? <span className="text-[11.5px] text-slate-500">{jtMsg}</span> : null}
        </div>
        {jt && jt.changes.length > 0 ? (
          <div className="mt-2.5 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-[11.5px]">
              <thead className="sticky top-0 bg-slate-50 text-left text-[10.5px] text-slate-500">
                <tr><th className="px-3 py-1.5 font-medium">Contact</th><th className="px-3 py-1.5 font-medium">Company now</th><th className="px-3 py-1.5 font-medium">→ Company</th><th className="px-3 py-1.5 font-medium">→ Type</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jt.changes.map((c) => (
                  <tr key={c.contactId}>
                    <td className="px-3 py-1.5"><a href={`/admin/sales/contacts/${c.contactId}`} className="text-slate-700 hover:underline">{c.name ?? "(no name)"}</a></td>
                    <td className="px-3 py-1.5 text-slate-400">{c.oldCompany || "—"}</td>
                    <td className="px-3 py-1.5">{c.newCompany ? <b className="text-emerald-700">{c.newCompany}</b> : <span className="text-slate-300">unchanged</span>}</td>
                    <td className="px-3 py-1.5">{c.newType ? <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-indigo-700">{c.newType}</span> : <span className="text-slate-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
        <div className="text-[13px] font-semibold text-slate-800">Step 1b · Derive stage from investor type <span className="font-normal text-slate-500">— free, no AI</span></div>
        <p className="mt-1 text-[11.5px] text-slate-500">
          Fills the 25-point operating-stage weight from what the investor <i>is</i>. Only touches contacts with no stage at all — a stated or AI-extracted stage always wins. Each value is tagged with the rule that wrote it, so it&rsquo;s visible on the profile and reversible per rule. Runs automatically after each contacts sync.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void derive("preview")} disabled={busy} className="rounded-lg border border-indigo-300 bg-white px-3.5 py-2 text-[13px] font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">⌕ Preview</button>
          {dv && dv.total > 0 ? <button type="button" onClick={() => void derive("apply")} disabled={busy} className="rounded-lg bg-slate-800 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-slate-900 disabled:opacity-50">✓ Fill {dv.total}</button> : null}
          {dvMsg ? <span className="text-[11.5px] text-slate-500">{dvMsg}</span> : null}
        </div>
        {dv && dv.total > 0 ? (
          <div className="mt-2.5 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-[11.5px]">
              <thead className="bg-slate-50 text-left text-[10.5px] text-slate-500">
                <tr><th className="px-3 py-1.5 font-medium">Rule</th><th className="px-3 py-1.5 font-medium">Stage written</th><th className="px-3 py-1.5 font-medium">Contacts</th><th className="px-3 py-1.5 font-medium">Undo</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dv.rules.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-1.5 font-medium text-slate-700">{r.label}</td>
                    <td className="px-3 py-1.5 text-slate-500">{r.stages.join(" · ")}</td>
                    <td className="px-3 py-1.5"><b>{dv.byRule[r.id] ?? 0}</b></td>
                    <td className="px-3 py-1.5"><button type="button" disabled={busy} onClick={() => void undoRule(r.id)} className="text-[11px] text-rose-600 hover:underline">remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="mb-1.5 text-[13px] font-semibold text-slate-800">Step 2 · AI enrichment <span className="font-normal text-slate-500">— industry, type &amp; thesis stage</span></div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void run()} disabled={busy} className="rounded-lg border border-indigo-300 bg-white px-3.5 py-2 text-[13px] font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">▷ Run next 40</button>
        <button type="button" onClick={() => void runAll()} disabled={busy} className="rounded-lg bg-indigo-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50">▷▷ Run all</button>
        {highCount > 0 ? <button type="button" onClick={() => void bulk()} disabled={busy} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-[13px] font-medium text-emerald-700 disabled:opacity-50">✓ Approve all ≥{HIGH}% ({highCount})</button> : null}
        <span className="ml-auto text-[12px] text-slate-500">{rows.length} pending{msg ? ` · ${msg}` : ""}</span>
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
        <div className="text-[13px] font-semibold text-slate-800">Step 3 · Rebuild match index <span className="font-normal text-slate-500">— publishes approved data to /fit</span></div>
        <p className="mt-1 text-[11.5px] text-slate-500">Approvals and the job-title backfill now reindex their own contacts, so this is mostly a safety net. Incremental picks up contacts re-synced from Odoo since the last run; Full reads every investor — use it for the first build, or if you suspect the index has drifted.</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void rebuildIndex(false)} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">↻ Rebuild changed</button>
          <button type="button" onClick={() => void rebuildIndex(true)} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">↻↻ Full rebuild</button>
          {idxMsg ? <span className="text-[11.5px] text-slate-500">{idxMsg}</span> : null}
        </div>
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
              {/* Thesis stage — only present when the source text stated it. */}
              {r.proposed_stage.length > 0
                ? <span className="rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10.5px] text-violet-700">◑ {r.proposed_stage.join(" · ")}</span>
                : <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[10.5px] text-slate-400">stage — not stated</span>}
              {r.proposed_industries.length === 0 && !r.proposed_type && r.proposed_stage.length === 0 ? <span className="text-[10.5px] text-slate-400">— nothing usable</span> : null}
            </div>
            {r.rationale ? <div className="mt-1 text-[10.5px] text-slate-400">{r.rationale}</div> : null}

            {editId === r.id ? (
              <div className="mt-2 space-y-2">
                <input value={editVal} onChange={(e) => setEditVal(e.target.value)} placeholder="Industries, comma-separated" className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[12px]" />
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10.5px] text-slate-400">Stage:</span>
                  {STAGES.map((s) => {
                    const on = editStages.includes(s);
                    return (
                      <button key={s} type="button"
                        onClick={() => setEditStages((p) => (on ? p.filter((x) => x !== s) : [...p, s]))}
                        className={`rounded-md px-2 py-0.5 text-[10.5px] ${on ? "border border-violet-300 bg-violet-100 text-violet-800" : "border border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                        {s}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" disabled={busy} onClick={() => void decide(r.id, "approve", editVal.split(",").map((s) => s.trim()).filter(Boolean), r.proposed_type, editStages)} className="rounded-md bg-indigo-600 px-3 py-1.5 text-[11.5px] font-medium text-white">Save &amp; approve</button>
                  <button type="button" onClick={() => setEditId(null)} className="text-[11.5px] text-slate-500">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={busy} onClick={() => void decide(r.id, "approve")} className="rounded-md bg-emerald-600 px-3 py-1 text-[11.5px] font-medium text-white disabled:opacity-50">Approve</button>
                <button type="button" disabled={busy} onClick={() => { setEditId(r.id); setEditVal(r.proposed_industries.join(", ")); setEditStages(r.proposed_stage); }} className="rounded-md border border-slate-200 px-3 py-1 text-[11.5px] text-slate-600">Edit</button>
                <button type="button" disabled={busy} onClick={() => void decide(r.id, "reject")} className="rounded-md border border-rose-200 px-3 py-1 text-[11.5px] text-rose-600">Reject</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
