"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { StateChip } from "./StateChip";
import { ConfidenceMeter } from "./ConfidenceMeter";
import type { Claim, Domain, Engagement, Finding, Severity, Verification } from "@/lib/diligence/types";

type Detail = { engagement: Engagement; domains: Domain[]; findings: Finding[]; claims: Claim[] };

export function DiligenceWorkspaceClient({ engagementId }: { engagementId: string }) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"findings" | "ledger">("findings");

  const reload = useCallback(async () => {
    const res = await fetch(`/api/admin/diligence/${engagementId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to load.");
    setDetail(data);
  }, [engagementId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/diligence/${engagementId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load.");
        if (active) setDetail(data);
      } catch (err) {
        if (active) toast({ title: "Could not load", description: err instanceof Error ? err.message : "", variant: "error" });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [engagementId, toast]);

  const saveFinding = useCallback(async (patch: Partial<Finding>) => {
    const res = await fetch(`/api/admin/diligence/${engagementId}/findings`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast({ title: "Save failed", description: d.error ?? "", variant: "error" }); return; }
    await reload();
  }, [engagementId, reload, toast]);

  const removeFinding = useCallback(async (findingId: string) => {
    const res = await fetch(`/api/admin/diligence/${engagementId}/findings`, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ findingId }),
    });
    if (res.ok) await reload();
  }, [engagementId, reload]);

  const saveClaim = useCallback(async (patch: Partial<Claim>) => {
    const res = await fetch(`/api/admin/diligence/${engagementId}/claims`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast({ title: "Save failed", description: d.error ?? "", variant: "error" }); return; }
    await reload();
  }, [engagementId, reload, toast]);

  const verifyClaimState = useCallback(async (claimId: string, state: Verification) => {
    const res = await fetch(`/api/admin/diligence/${engagementId}/claims`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimId, state }),
    });
    if (res.ok) await reload();
  }, [engagementId, reload]);

  if (loading || !detail) return <p className="text-sm text-slate-500">Loading…</p>;
  const { engagement, domains, findings, claims } = detail;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2f6cb0]">{engagement.report_code}</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-950">
            {engagement.company_name} <StateChip variant={engagement.lifecycle_stage} />
          </h1>
          <p className="mt-1 text-sm text-slate-500">{[engagement.round_label, engagement.sector].filter(Boolean).join(" · ") || "—"}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-slate-500">Confidence</p>
          <ConfidenceMeter pct={engagement.confidence_pct} />
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {(["findings", "ledger"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t ? "border-[#2f6cb0] text-[#2f6cb0]" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {t === "findings" ? "Findings register" : "Verification ledger"}
          </button>
        ))}
      </div>

      {tab === "findings" ? (
        <FindingsRegister findings={findings} domains={domains} onSave={saveFinding} onDelete={removeFinding} />
      ) : (
        <VerificationLedger claims={claims} findings={findings} onSave={saveClaim} onVerify={verifyClaimState} />
      )}
    </div>
  );
}

// ── Findings register ─────────────────────────────────────────────────────────
function FindingsRegister({
  findings, domains, onSave, onDelete,
}: {
  findings: Finding[];
  domains: Domain[];
  onSave: (p: Partial<Finding>) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2.5 font-semibold">Code</th>
            <th className="px-3 py-2.5 font-semibold">Title</th>
            <th className="px-3 py-2.5 font-semibold">Domain</th>
            <th className="px-3 py-2.5 font-semibold">Severity</th>
            <th className="px-3 py-2.5 font-semibold">Status</th>
            <th className="px-3 py-2.5 font-semibold">Verification</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {findings.map((f) => (
            <tr key={f.id} className="border-b border-slate-50 last:border-0 align-top">
              <td className="px-3 py-2 font-mono text-xs text-slate-500">{f.finding_code}</td>
              <td className="px-3 py-2">
                <input defaultValue={f.title} onBlur={(e) => { if (e.target.value !== f.title) onSave({ id: f.id, title: e.target.value }); }}
                  className="w-full rounded border border-transparent px-1 py-0.5 hover:border-slate-200 focus:border-slate-300" />
              </td>
              <td className="px-3 py-2">
                <select value={f.domain_id ?? ""} onChange={(e) => onSave({ id: f.id, domain_id: e.target.value || null })} className="rounded border border-slate-200 px-1.5 py-1 text-xs">
                  <option value="">—</option>
                  {domains.map((d) => <option key={d.id} value={d.id}>{d.code} {d.name}</option>)}
                </select>
              </td>
              <td className="px-3 py-2">
                <select value={f.severity} onChange={(e) => onSave({ id: f.id, severity: e.target.value as Severity })} className="rounded border border-slate-200 px-1.5 py-1 text-xs">
                  <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </select>
              </td>
              <td className="px-3 py-2">
                <select value={f.status} onChange={(e) => onSave({ id: f.id, status: e.target.value as Finding["status"] })} className="rounded border border-slate-200 px-1.5 py-1 text-xs">
                  <option value="open">Open</option><option value="mitigating">Mitigating</option><option value="resolved">Resolved</option>
                </select>
              </td>
              <td className="px-3 py-2"><StateChip variant={f.verification} /></td>
              <td className="px-3 py-2 text-right">
                <button type="button" onClick={() => onDelete(f.id)} aria-label="Delete finding" className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </td>
            </tr>
          ))}
          <tr>
            <td className="px-3 py-2 text-xs text-slate-400">new</td>
            <td className="px-3 py-2"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New finding title…" className="w-full rounded border border-slate-200 px-2 py-1" /></td>
            <td className="px-3 py-2 text-slate-300">—</td>
            <td className="px-3 py-2">
              <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} className="rounded border border-slate-200 px-1.5 py-1 text-xs">
                <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
              </select>
            </td>
            <td colSpan={2} />
            <td className="px-3 py-2 text-right">
              <button type="button" disabled={!title.trim()} onClick={() => { onSave({ title: title.trim(), severity }); setTitle(""); setSeverity("medium"); }}
                className="inline-flex items-center gap-1 rounded-lg bg-[#2f6cb0] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> Add</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Verification ledger ───────────────────────────────────────────────────────
function VerificationLedger({
  claims, findings, onSave, onVerify,
}: {
  claims: Claim[];
  findings: Finding[];
  onSave: (p: Partial<Claim>) => void;
  onVerify: (id: string, state: Verification) => void;
}) {
  const [text, setText] = useState("");
  const codeOf = (fid: string | null) => findings.find((f) => f.id === fid)?.finding_code ?? "—";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2.5 font-semibold">Claim</th>
            <th className="px-3 py-2.5 font-semibold">Claimed value</th>
            <th className="px-3 py-2.5 font-semibold">Linked</th>
            <th className="px-3 py-2.5 font-semibold">Weight</th>
            <th className="px-3 py-2.5 font-semibold">Verification</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((c) => (
            <tr key={c.id} className="border-b border-slate-50 last:border-0">
              <td className="px-3 py-2">{c.claim}</td>
              <td className="px-3 py-2 text-slate-600">{c.claimed_value ?? "—"}</td>
              <td className="px-3 py-2">
                <select value={c.finding_id ?? ""} onChange={(e) => onSave({ id: c.id, finding_id: e.target.value || null })} className="rounded border border-slate-200 px-1.5 py-1 text-xs">
                  <option value="">—</option>
                  {findings.map((f) => <option key={f.id} value={f.id}>{f.finding_code}</option>)}
                </select>
              </td>
              <td className="px-3 py-2 text-slate-600">{codeOf(c.finding_id) !== "—" ? `${c.weight}` : c.weight}</td>
              <td className="px-3 py-2">
                <select value={c.verification} onChange={(e) => onVerify(c.id, e.target.value as Verification)} className="rounded border border-slate-200 px-1.5 py-1 text-xs">
                  <option value="unverified">Unverified</option>
                  <option value="requested">Requested</option>
                  <option value="submitted">Submitted</option>
                  <option value="verified">Verified</option>
                  <option value="discrepancy">Discrepancy</option>
                </select>
              </td>
            </tr>
          ))}
          <tr>
            <td className="px-3 py-2"><input value={text} onChange={(e) => setText(e.target.value)} placeholder="New claim…" className="w-full rounded border border-slate-200 px-2 py-1" /></td>
            <td colSpan={3} />
            <td className="px-3 py-2 text-right">
              <button type="button" disabled={!text.trim()} onClick={() => { onSave({ claim: text.trim() }); setText(""); }}
                className="inline-flex items-center gap-1 rounded-lg bg-[#2f6cb0] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> Add</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
