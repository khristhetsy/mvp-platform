"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { industryOptionsFor, isCanonicalIndustry } from "@/lib/industries";

const STAGES: { id: string; label: string }[] = [
  { id: "pre_revenue", label: "Pre-revenue" },
  { id: "early_revenue", label: "Early revenue" },
  { id: "growing", label: "Growing" },
  { id: "scaling", label: "Scaling" },
];

type Basics = {
  company_name: string;
  industry: string;
  business_description: string;
  revenue_stage: string | null;
  funding_amount: number | null;
};

const INPUT =
  "mt-1 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const LABEL = "block text-xs font-semibold text-slate-600";

export function CompanyBasicsEditor({ companyId }: Readonly<{ companyId: string }>) {
  const router = useRouter();
  const [b, setB] = useState<Basics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch(`/api/admin/companies/${companyId}/basics`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Could not load company basics."))))
      .then((d: Basics) => {
        if (active) setB({
          company_name: d.company_name ?? "",
          industry: d.industry ?? "",
          business_description: d.business_description ?? "",
          revenue_stage: d.revenue_stage,
          funding_amount: d.funding_amount,
        });
      })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Load failed."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [companyId]);

  function patch(next: Partial<Basics>) {
    setB((prev) => (prev ? { ...prev, ...next } : prev));
    setSaved(false);
  }

  async function save() {
    if (!b) return;
    if (b.company_name.trim().length < 2) { setError("Company name must be at least 2 characters."); return; }
    if (b.industry.trim().length < 2) { setError("Industry must be at least 2 characters."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/basics`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: b.company_name.trim(),
          industry: b.industry.trim(),
          business_description: b.business_description.trim() || null,
          revenue_stage: b.revenue_stage,
          funding_amount: b.funding_amount,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Save failed.");
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!b) return <p className="text-sm text-rose-700">{error ?? "Could not load company basics."}</p>;

  return (
    <div className="grid gap-4">
      <div>
        <label className={LABEL} htmlFor="cb-name">Company name</label>
        <input id="cb-name" value={b.company_name} onChange={(e) => patch({ company_name: e.target.value })} className={INPUT} placeholder="e.g. Doyle Organics, LLC" />
      </div>
      <div>
        <label className={LABEL} htmlFor="cb-industry">Industry</label>
        <select id="cb-industry" value={b.industry} onChange={(e) => patch({ industry: e.target.value })} className={INPUT}>
          {!b.industry ? <option value="">— Select an industry —</option> : null}
          {industryOptionsFor(b.industry).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
              {!isCanonicalIndustry(opt) ? " (current — not in list)" : ""}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-slate-400">
          Shared list — the founder picks from the same options, so matching and the marketplace stay in sync.
        </p>
      </div>
      <div>
        <label className={LABEL} htmlFor="cb-desc">Business description</label>
        <textarea id="cb-desc" rows={3} value={b.business_description} onChange={(e) => patch({ business_description: e.target.value })} className={INPUT} placeholder="One or two sentences about what the company does." />
      </div>
      <div>
        <label className={LABEL} htmlFor="cb-stage">Revenue stage</label>
        <select id="cb-stage" value={b.revenue_stage ?? ""} onChange={(e) => patch({ revenue_stage: e.target.value || null })} className={INPUT}>
          <option value="">— Not set —</option>
          {STAGES.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
        </select>
      </div>
      <div>
        <label className={LABEL} htmlFor="cb-funding">Funding target ($)</label>
        <input
          id="cb-funding"
          inputMode="numeric"
          value={b.funding_amount ?? ""}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9.]/g, "");
            patch({ funding_amount: raw ? Number(raw) : null });
          }}
          className={INPUT}
          placeholder="e.g. 500000"
        />
      </div>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save company basics"}
        </button>
        {saved ? <span className="text-sm font-medium text-emerald-700">Saved ✓</span> : null}
      </div>
      <p className="text-xs text-slate-400">Changes are audited. Industry, stage, and funding target feed the company profile, matching, and readiness.</p>
    </div>
  );
}
