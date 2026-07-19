"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ASSUMPTION_DEFS } from "@/lib/business-plan/assumptions";
import { computeProjections } from "@/lib/business-plan/projections";
import { computeMonthlyModel } from "@/lib/financial-model/monthly";
import { resolveAssumptions } from "@/lib/financial-model/resolve";
import type { ProjectionAssumptions } from "@/lib/business-plan/projections";
import { FounderModulePreview, PreviewButton } from "./FounderModulePreview";

type Source = "business-plan" | "fresh";

function money(n: number): string {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(1)}M` : abs >= 1_000 ? `$${Math.round(abs / 1_000)}k` : `$${Math.round(abs)}`;
  return n < 0 ? `−${s}` : s;
}

export function FinancialModelClient() {
  const t = useTranslations("founderCmp");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<Source>("fresh");
  const [hasBusinessPlan, setHasBusinessPlan] = useState(false);
  const [assumptions, setAssumptions] = useState<ProjectionAssumptions | null>(null);
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState<{ url: string | null; fileName: string } | null>(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    let on = true;
    fetch("/api/founder/financial-model")
      .then((r) => r.json())
      .then((j) => {
        if (!on) return;
        if (j.error) { setError(typeof j.error === "string" ? j.error : "Could not load."); return; }
        setSource(j.source === "business-plan" ? "business-plan" : "fresh");
        setHasBusinessPlan(Boolean(j.hasBusinessPlan));
        setAssumptions(j.assumptions as ProjectionAssumptions);
      })
      .catch(() => on && setError("Could not load your financial model."))
      .finally(() => on && setLoading(false));
    return () => { on = false; };
  }, []);

  const projections = useMemo(() => (assumptions ? computeProjections(assumptions) : null), [assumptions]);
  const monthly = useMemo(() => (assumptions ? computeMonthlyModel(assumptions) : []), [assumptions]);
  const yearEndCash = useMemo(() => [11, 23, 35].map((m) => monthly[m]?.cashBalance ?? null), [monthly]);

  function setA(key: keyof ProjectionAssumptions, raw: number) {
    setAssumptions((prev) => (prev ? { ...prev, [key]: raw } : prev));
    setDone(null);
  }
  function reset() {
    setAssumptions((prev) => resolveAssumptions(prev, null, prev?.raiseAmount ?? null));
  }

  async function generate() {
    if (!assumptions) return;
    setGenerating(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/founder/financial-model/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assumptions, source }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not generate.");
      setDone({ url: (j.url as string | null) ?? null, fileName: (j.fileName as string) ?? "Financial model.xlsx" });
      if (j.url) window.open(j.url as string, "_blank", "noopener");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate.");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <p className="mt-6 text-sm text-[var(--text-muted)]">{t("loading_your_model")}</p>;
  if (!assumptions) return <p className="mt-6 text-sm text-rose-700">{error ?? "Could not load your model."}</p>;

  return (
    <div className="mt-4 space-y-4">
      {/* Source banner */}
      {source === "business-plan" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-800">{t("imported_from_your_ai_business_plan")}</p>
          <p className="mt-0.5 text-sm text-emerald-700">
            We pulled the drivers you set in your business plan. Tweak anything below, then generate the Excel model.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <p className="text-sm font-semibold text-indigo-800">{t("build_your_model_below_or_start_from_your_bu")}</p>
          <p className="mt-0.5 text-sm text-indigo-700">
            {hasBusinessPlan
              ? "Your business plan doesn’t have projection drivers yet."
              : "Don’t have projections yet? "}
            Set the drivers in the{" "}
            <Link href="/founder/business-plan" className="font-medium underline">AI Business Plan</Link>{" "}
            and they’ll carry over here automatically — or just fill them in below.
          </p>
        </div>
      )}

      {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-[300px_1fr]">
        {/* Drivers */}
        <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--navy)]">{t("your_drivers")}</h2>
            <button onClick={reset} className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)]">{t("reset")}</button>
          </div>
          <div className="mt-3 space-y-3">
            {ASSUMPTION_DEFS.map((d) => (
              <label key={d.key} className="block">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  {d.label}
                  {d.unit === "percent" ? " (%)" : d.unit === "currency_month" ? " ($/mo)" : d.unit === "currency" ? " ($)" : ""}
                </span>
                <input
                  type="number"
                  value={assumptions[d.key]}
                  min={0}
                  onChange={(e) => setA(d.key, Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-sm"
                />
                <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">{d.help}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Output */}
        <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
          <h2 className="text-sm font-semibold text-[var(--navy)]">3-year projection</h2>
          {projections && (
            <div className="mt-3 overflow-hidden rounded-lg border border-[var(--border-subtle)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-left text-xs text-[var(--text-muted)]">
                    <th className="px-3 py-2"></th><th className="px-3 py-2 text-right">Yr 1</th><th className="px-3 py-2 text-right">Yr 2</th><th className="px-3 py-2 text-right">Yr 3</th>
                  </tr>
                </thead>
                <tbody>
                  {([["Revenue", "revenue"], ["Gross profit", "grossProfit"], ["Operating expense", "operatingExpense"], ["Net cash flow", "netCashFlow"]] as const).map(([label, key]) => (
                    <tr key={key} className="border-b border-[var(--border-subtle)] last:border-0">
                      <td className="px-3 py-2 text-[var(--text-secondary)]">{label}</td>
                      {projections.years.map((y) => (
                        <td key={y.year} className="px-3 py-2 text-right tabular-nums">{money(y[key])}</td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t border-[var(--border-subtle)] bg-[var(--surface-sunken)]">
                    <td className="px-3 py-2 text-[var(--text-secondary)]">Year-end cash</td>
                    {yearEndCash.map((c, i) => (
                      <td key={i} className={`px-3 py-2 text-right tabular-nums ${c !== null && c < 0 ? "text-rose-600 font-medium" : ""}`}>
                        {c === null ? "—" : money(c)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
              <div className="border-t border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-muted)]">
                {projections.runwayMonths ? `Runway ≈ ${projections.runwayMonths} months` : "Cash-flow positive within 3 years"} · ending cash {money(projections.endingCash)}
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            The downloadable Excel file includes the full 36-month month-by-month model, an assumptions sheet, and the annual summary.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <PreviewButton onClick={() => setPreview(true)} />
            <button onClick={generate} disabled={generating} className="cap-btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
              {generating ? "Generating…" : "Generate Excel model"}
            </button>
            {done?.url && (
              <a href={done.url} target="_blank" rel="noopener noreferrer" className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)]">
                Download again
              </a>
            )}
          </div>

          {done && (
            <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Saved <span className="font-medium">{done.fileName}</span> to your Documents — it counts toward your readiness score and the Qualify stage.
            </div>
          )}

          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Illustrative projections based on your assumptions. Not a forecast, guarantee, or investment advice.
          </p>
        </section>
      </div>

      {preview && projections && (
        <FounderModulePreview
          title="Financial model"
          subtitle="3-year projection · read-only"
          onClose={() => setPreview(false)}
          footer="Illustrative projections based on your drivers. The Excel export includes the full 36-month model. Not a forecast, guarantee, or investment advice."
        >
          <div className="grid grid-cols-3 gap-2">
            {([["Runway", projections.runwayMonths ? `≈ ${projections.runwayMonths} mo` : "3 yr+"], ["Ending cash", money(projections.endingCash)], ["Yr 3 revenue", money(projections.years[2]?.revenue ?? 0)]] as const).map(([l, v]) => (
              <div key={l} className="rounded-md border border-[var(--border-subtle)] p-2.5">
                <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{l}</div>
                <div className="text-base font-semibold text-[var(--navy)] tabular-nums">{v}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-[var(--border-subtle)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left text-xs text-[var(--text-muted)]">
                  <th className="px-3 py-2"></th><th className="px-3 py-2 text-right">Yr 1</th><th className="px-3 py-2 text-right">Yr 2</th><th className="px-3 py-2 text-right">Yr 3</th>
                </tr>
              </thead>
              <tbody>
                {([["Revenue", "revenue"], ["Gross profit", "grossProfit"], ["Operating expense", "operatingExpense"], ["Net cash flow", "netCashFlow"]] as const).map(([label, key]) => (
                  <tr key={key} className="border-b border-[var(--border-subtle)] last:border-0">
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{label}</td>
                    {projections.years.map((y) => (
                      <td key={y.year} className="px-3 py-2 text-right tabular-nums">{money(y[key])}</td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-[var(--border-subtle)] bg-[var(--surface-sunken)]">
                  <td className="px-3 py-2 text-[var(--text-secondary)]">Year-end cash</td>
                  {yearEndCash.map((c, i) => (
                    <td key={i} className={`px-3 py-2 text-right tabular-nums ${c !== null && c < 0 ? "font-medium text-rose-600" : ""}`}>
                      {c === null ? "—" : money(c)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Your drivers</h4>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
            {ASSUMPTION_DEFS.map((d) => (
              <div key={d.key} className="flex justify-between border-b border-slate-100 py-1 text-sm">
                <span className="text-[var(--text-secondary)]">{d.label}</span>
                <span className="font-medium tabular-nums text-[var(--navy)]">{assumptions[d.key]}</span>
              </div>
            ))}
          </div>
        </FounderModulePreview>
      )}
    </div>
  );
}
