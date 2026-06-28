"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { StateChip } from "./StateChip";
import { ConfidenceMeter } from "./ConfidenceMeter";
import type { Engagement, Stage } from "@/lib/diligence/types";

export function DiligencePipelineClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [round, setRound] = useState("");
  const [sector, setSector] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [companies, setCompanies] = useState<{ id: string; company_name: string; industry: string | null; has_founder: boolean }[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/diligence");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load.");
        if (active) setRows(data.engagements ?? []);
      } catch (err) {
        if (active) toast({ title: "Could not load", description: err instanceof Error ? err.message : "", variant: "error" });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [toast]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/diligence/companies");
        const data = await res.json();
        if (active && res.ok) setCompanies(data.companies ?? []);
      } catch { /* picker just won't populate */ }
    })();
    return () => { active = false; };
  }, []);

  const pickCompany = useCallback((id: string) => {
    setCompanyId(id);
    const c = companies.find((x) => x.id === id);
    if (c) { setName(c.company_name); setSector(c.industry ?? ""); }
  }, [companies]);

  const create = useCallback(async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/diligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: name.trim(), round_label: round.trim() || null, sector: sector.trim() || null, company_id: companyId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed.");
      router.push(`/admin/diligence/${data.engagement.id}`);
    } catch (err) {
      toast({ title: "Could not create", description: err instanceof Error ? err.message : "", variant: "error" });
    } finally {
      setCreating(false);
    }
  }, [name, round, sector, companyId, router, toast]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2f6cb0]">iCFO iCapOS</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-950">
            <ShieldCheck className="h-6 w-6 text-[#2f6cb0]" strokeWidth={1.75} aria-hidden /> Diligence
          </h1>
          <p className="mt-1 text-sm text-slate-600">Run a full diligence engagement: findings, verification, founder loop, consent, release.</p>
        </div>
        <button type="button" onClick={() => setShowForm((s) => !s)} className="inline-flex items-center gap-2 rounded-lg bg-[#2f6cb0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#234f86]">
          <Plus className="h-4 w-4" /> New engagement
        </button>
      </div>

      {showForm ? (
        <div className="space-y-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
          {companies.length ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Select a company (or enter manually below)</span>
              <select value={companyId} onChange={(e) => pickCompany(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">— Enter manually —</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.company_name}{c.has_founder ? "" : " (no founder linked)"}</option>)}
              </select>
            </label>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <input value={name} onChange={(e) => { setName(e.target.value); setCompanyId(""); }} placeholder="Company name *" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={round} onChange={(e) => setRound(e.target.value)} placeholder="Round (e.g. Series A)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Sector" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600">Cancel</button>
            <button type="button" onClick={() => void create()} disabled={creating || !name.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#2f6cb0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No engagements yet. Create one to begin.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5 font-semibold">Company</th>
                <th className="px-4 py-2.5 font-semibold">Stage</th>
                <th className="px-4 py-2.5 font-semibold">Confidence</th>
                <th className="px-4 py-2.5 font-semibold">Report code</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} onClick={() => router.push(`/admin/diligence/${e.id}`)} className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{e.company_name}</p>
                    <p className="text-xs text-slate-500">{[e.round_label, e.sector].filter(Boolean).join(" · ") || "—"}</p>
                  </td>
                  <td className="px-4 py-3"><StateChip variant={e.lifecycle_stage as Stage} /></td>
                  <td className="px-4 py-3"><ConfidenceMeter pct={e.confidence_pct} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.report_code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
