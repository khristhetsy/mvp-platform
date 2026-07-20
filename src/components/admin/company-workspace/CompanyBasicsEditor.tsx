"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STAGES: { id: string; label: string }[] = [
  { id: "pre_revenue", label: "Pre-revenue" },
  { id: "early_revenue", label: "Early revenue" },
  { id: "growing", label: "Growing" },
  { id: "scaling", label: "Scaling" },
];

type Basics = { industry: string; revenue_stage: string | null; funding_amount: number | null };

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
      .then((d: Basics) => { if (active) setB({ industry: d.industry ?? "", revenue_stage: d.revenue_stage, funding_amount: d.funding_amount }); })
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
    if (b.industry.trim().length < 2) { setError("Industry must be at least 2 characters."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/basics`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: b.industry.trim(),
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
        <label className={LABEL} htmlFor="cb-industry">Industry</label>
        <input id="cb-industry" value={b.industry} onChange={(e) => patch({ industry: e.target.value })} className={INPUT} placeholder="e.g. CleanTech" />
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
