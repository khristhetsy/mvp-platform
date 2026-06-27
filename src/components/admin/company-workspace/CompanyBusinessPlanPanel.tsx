"use client";

import { useEffect, useState } from "react";
import { BUSINESS_PLAN_SECTIONS } from "@/lib/business-plan/sections";
import { ASSUMPTION_DEFS } from "@/lib/business-plan/assumptions";
import type { BusinessPlan } from "@/lib/business-plan/types";

function money(n: number): string {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(1)}M` : abs >= 1_000 ? `$${Math.round(abs / 1_000)}k` : `$${Math.round(abs)}`;
  return n < 0 ? `−${s}` : s;
}

export function CompanyBusinessPlanPanel({ companyId }: { companyId: string }) {
  const [plan, setPlan] = useState<BusinessPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    fetch(`/api/admin/companies/${companyId}/business-plan`)
      .then((r) => r.json())
      .then((j) => on && setPlan((j.plan as BusinessPlan) ?? null))
      .catch(() => {})
      .finally(() => on && setLoading(false));
    return () => { on = false; };
  }, [companyId]);

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!plan) return <p className="text-sm text-slate-500">No business plan started yet.</p>;

  const filled = BUSINESS_PLAN_SECTIONS.filter((s) => s.id !== "projections" && (plan.sections[s.id]?.content ?? "").trim().length > 0);
  const proj = plan.projections;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${plan.status === "finalized" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
          {plan.status === "finalized" ? "Finalized" : "Draft"}
        </span>
        {plan.aiAssisted && <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">AI-assisted</span>}
        <span className="text-xs text-slate-500">
          {filled.length}/{BUSINESS_PLAN_SECTIONS.length - 1} sections · updated {plan.updatedAt ? new Date(plan.updatedAt).toLocaleDateString() : "—"}
        </span>
      </div>

      {/* Projections + assumptions (full transparency) */}
      {proj && (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Projections &amp; assumptions</p>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400"><th></th><th className="text-right">Yr 1</th><th className="text-right">Yr 2</th><th className="text-right">Yr 3</th></tr>
            </thead>
            <tbody>
              {([["Revenue", "revenue"], ["Net cash flow", "netCashFlow"]] as const).map(([label, key]) => (
                <tr key={key}><td className="py-1 text-slate-600">{label}</td>{proj.years.map((y) => <td key={y.year} className="py-1 text-right">{money(y[key])}</td>)}</tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex flex-wrap gap-2">
            {ASSUMPTION_DEFS.map((d) => {
              const v = plan.assumptions[d.key];
              return <span key={d.key} className="rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-600">{d.label}: {v ?? "—"}</span>;
            })}
          </div>
        </div>
      )}

      {/* Sections (read-only) */}
      <div className="space-y-2">
        {filled.map((s) => (
          <details key={s.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-slate-800">{s.title}</summary>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-600">{plan.sections[s.id]?.content}</p>
          </details>
        ))}
        {filled.length === 0 && <p className="text-sm text-slate-500">No section content yet.</p>}
      </div>

      <p className="text-xs text-slate-400">
        Provenance: {plan.aiAssisted ? "AI-assisted draft" : "founder-written"}, edited by the founder. Projections are illustrative, founder-provided assumptions — not a forecast or guarantee.
      </p>
    </div>
  );
}
