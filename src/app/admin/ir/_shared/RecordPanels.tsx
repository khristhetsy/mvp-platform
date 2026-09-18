"use client";

/**
 * Panels shared by the Share Project record and the Task form (mockup tabs):
 *   BlockersPanel   — "Blocked by" list with presets, clear / remove, "Add blocker"
 *   EntrepreneurTab — the founder company snapshot (Company, Founder, Membership type,
 *                     Member portal plan, Raise, Stage, Industry)
 *   MessageComposer — "Send message" to followers (owner + assignee), kept on the record
 */
import { useState } from "react";
import Link from "next/link";
import type { EntrepreneurProfile } from "@/lib/ir/db";
import { BLOCKER_PRESETS, type IrBlocker } from "@/lib/ir/types";

const inp = "rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] focus:border-indigo-400 focus:outline-none";

export function BlockersPanel({ blockers, dealTitle, onChange, busy }: { blockers: IrBlocker[]; dealTitle: string; onChange: (next: IrBlocker[]) => Promise<void>; busy: boolean }) {
  const [pick, setPick] = useState<string>(BLOCKER_PRESETS[0]);
  const [custom, setCustom] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const open = blockers.filter((b) => !b.cleared_at);
  async function add() {
    const label = (pick === "__custom" ? custom : pick).trim();
    if (!label) { setErr("Name the blocker."); return; }
    if (blockers.some((b) => !b.cleared_at && b.label.toLowerCase() === label.toLowerCase())) { setErr("That blocker is already on the record."); return; }
    setErr(null); setCustom("");
    await onChange([...blockers, { label, cleared_at: null }]);
  }
  return (
    <div>
      <table className="w-full text-[12.5px]">
        <thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1 font-medium">Blocked by</th><th className="py-1 font-medium">Deal</th><th className="py-1 font-medium">Status</th><th className="py-1"></th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {blockers.map((b, i) => <tr key={i} className={b.cleared_at ? "text-slate-400" : ""}>
            <td className="py-1.5 pr-2">{b.cleared_at ? <s>{b.label}</s> : b.label}</td>
            <td className="py-1.5 pr-2">{dealTitle}</td>
            <td className="py-1.5 pr-2">{b.cleared_at ? `Cleared ${new Date(b.cleared_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">Blocking</span>}</td>
            <td className="py-1.5 text-right">
              {!b.cleared_at ? <button type="button" disabled={busy} onClick={() => onChange(blockers.map((x, k) => (k === i ? { ...x, cleared_at: new Date().toISOString() } : x)))} className="mr-2 text-[12px] text-emerald-700 hover:underline">Clear</button> : null}
              <button type="button" disabled={busy} onClick={() => onChange(blockers.filter((_, k) => k !== i))} className="text-[12px] text-slate-400 hover:text-rose-600">Remove</button>
            </td>
          </tr>)}
          {blockers.length === 0 ? <tr><td colSpan={4} className="py-3 text-slate-400">Nothing is blocking this record.</td></tr> : null}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={pick} onChange={(e) => setPick(e.target.value)} className={inp}>{BLOCKER_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}<option value="__custom">Other…</option></select>
        {pick === "__custom" ? <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="What is blocking this?" className={`w-64 ${inp}`} /> : null}
        <button type="button" disabled={busy} onClick={add} className="rounded-md border border-slate-200 px-2.5 py-1 text-[12px] text-slate-700 hover:bg-slate-50 disabled:opacity-60">Add blocker</button>
        {err ? <span className="text-[12px] text-rose-600">{err}</span> : null}
        {open.length ? <span className="ml-auto text-[11.5px] text-amber-800">{open.length} open blocker{open.length === 1 ? "" : "s"}</span> : null}
      </div>
    </div>
  );
}

export function EntrepreneurTab({ e }: { e: EntrepreneurProfile | null }) {
  if (!e) return <p className="text-[12.5px] text-slate-400">No founder company linked to this project.</p>;
  return (
    <div className="grid gap-x-8 gap-y-0 text-[12.5px] sm:grid-cols-2">
      <Row label="Company" value={e.company} /><Row label="Founder" value={e.founder} />
      <Row label="Membership type" value={e.membershipType} /><Row label="Member portal plan" value={e.portalPlan} />
      <Row label="Raise" value={e.raise} /><Row label="Stage" value={e.stage} />
      <Row label="Industry" value={e.industry} />
      <div className="sm:col-span-2 mt-1 flex gap-4">
        {e.companyId ? <Link href={`/admin/companies/${e.companyId}`} className="text-indigo-700 hover:underline">Open company →</Link> : null}
        {e.founderContactId ? <Link href={`/admin/sales/contacts/${e.founderContactId}`} className="text-indigo-700 hover:underline">Founder in Sales Hub →</Link> : null}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return <div className="flex gap-3 py-1"><span className="w-36 shrink-0 text-slate-500">{label}</span><span className={`min-w-0 flex-1 ${value ? "text-slate-800" : "text-slate-400"}`}>{value ?? "—"}</span></div>;
}

export function MessageComposer({ endpoint, onSent }: { endpoint: string; onSent: () => Promise<void> }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  async function send() {
    if (!body.trim()) { setErr("Write the message."); return; }
    setBusy(true); setErr(null); setOk(null);
    const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "message", body: body.trim() }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? "Couldn't send."); return; }
    setBody(""); setOk(j.notified ? `Sent — ${j.notified} follower${j.notified === 1 ? "" : "s"} notified.` : "Sent and kept on the record.");
    await onSent();
  }
  return (
    <div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Message to followers — the project owner and the assignee get a notification; the message stays on this record." className={`w-full ${inp}`} />
      <div className="mt-2 flex items-center gap-3">
        {err ? <span className="text-[12px] text-rose-600">{err}</span> : null}{ok ? <span className="text-[12px] text-emerald-700">{ok}</span> : null}
        <button type="button" disabled={busy} onClick={send} className="ml-auto rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? "Sending…" : "Send"}</button>
      </div>
    </div>
  );
}
