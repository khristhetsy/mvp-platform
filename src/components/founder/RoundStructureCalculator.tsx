"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  computeRound,
  DEFAULT_INPUTS,
  fmtMoney as fmt,
  fmtMoney2,
  monthsFromNow,
  type RoundInputs,
  type RoundType,
  type SafeType,
} from "@/lib/founder/round-structure/model";
import { OfferingAnalysisReport } from "@/components/founder/OfferingAnalysisReport";

// The math lives in lib/founder/round-structure/model.ts so the AI analysis route
// runs exactly the same numbers. The calculator only collects inputs and shows them.

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700">{label}</label>
        <span className="font-mono text-xs font-bold" style={{ color: "#2E78F5" }}>{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200"
        style={{ accentColor: "#2E78F5" }}
      />
      <div className="mt-0.5 flex justify-between text-[9px] text-slate-400">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

function OwnershipBar({
  shareholders,
}: {
  shareholders: Array<{ id: string; label: string; pct: number }>;
}) {
  const COLORS: Record<string, string> = {
    founder_1: "#2E78F5",
    founder_2: "#7c3aed",
    employees: "#06b6d4",
    option_pool: "#0ea5e9",
    new_investor: "#16a34a",
    safe_investor: "#16a34a",
    note_investor: "#16a34a",
  };
  const fallbackColors = ["#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
  let fallbackIdx = 0;

  return (
    <div>
      {/* Stacked bar */}
      <div className="flex h-5 w-full overflow-hidden rounded-lg">
        {shareholders.filter((s) => s.pct > 0.5).map((s) => (
          <div
            key={s.id}
            style={{
              width: `${s.pct}%`,
              background: COLORS[s.id] ?? fallbackColors[fallbackIdx++ % fallbackColors.length],
            }}
            title={`${s.label}: ${s.pct.toFixed(1)}%`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 space-y-1.5">
        {shareholders.filter((s) => s.pct > 0.1).map((s) => {
          const color = COLORS[s.id] ?? "#94a3b8";
          return (
            <div key={s.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
                <p className="text-[11px] text-slate-600">{s.label}</p>
              </div>
              <p className="font-mono text-[11px] font-semibold text-slate-800">{s.pct.toFixed(1)}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RoundStructureCalculator() {
  const t = useTranslations("founderCmp");
  const [roundType, setRoundType] = useState<RoundType>(DEFAULT_INPUTS.roundType);
  const [safeType, setSafeType] = useState<SafeType>(DEFAULT_INPUTS.safeType);
  const [preMoney, setPreMoney] = useState(DEFAULT_INPUTS.preMoney);
  const [raiseAmount, setRaiseAmount] = useState(DEFAULT_INPUTS.raiseAmount);
  const [optionPoolPct, setOptionPoolPct] = useState(DEFAULT_INPUTS.optionPoolPct);
  // Terms added for SAFE (discount) and Convertible note (interest, maturity, discount, warrants).
  const [discountPct, setDiscountPct] = useState(0);
  const [interestPct, setInterestPct] = useState(DEFAULT_INPUTS.interestPct);
  const [maturityMonths, setMaturityMonths] = useState(DEFAULT_INPUTS.maturityMonths);
  const [warrantPct, setWarrantPct] = useState(0);
  // The inputs the report was run on. Null until the founder taps Run AI analysis.
  const [reportInputs, setReportInputs] = useState<RoundInputs | null>(null);
  // Bumped on every run so the report remounts and shows its loading state again.
  const [runId, setRunId] = useState(0);

  const inputs: RoundInputs = useMemo(
    () => ({ roundType, safeType, preMoney, raiseAmount, optionPoolPct, discountPct, interestPct, maturityMonths, warrantPct }),
    [roundType, safeType, preMoney, raiseAmount, optionPoolPct, discountPct, interestPct, maturityMonths, warrantPct],
  );
  const result = useMemo(() => computeRound(inputs), [inputs]);

  const founderTotalPct = result.founderTotalPct;
  const isSafe = roundType === "safe";
  const isNote = roundType === "note";
  const reportStale = reportInputs !== null && JSON.stringify(reportInputs) !== JSON.stringify(inputs);
  const maturityDate = monthsFromNow(maturityMonths).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const segment = (active: boolean) => ({
    background: active ? "#2E78F5" : "transparent",
    color: active ? "white" : "#64748b",
  });

  return (
    <div className="space-y-6">
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Accent bar */}
      <div style={{ height: 3, background: "linear-gradient(90deg,#2E78F5,#7c3aed,#06b6d4)" }} />

      <div className="p-5">
        {/* Header */}
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "#EEEDFE" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                stroke="#2E78F5" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{t("round_structure_calculator")}</p>
            <p className="text-[11px] text-slate-400">{t("see_how_your_round_affects_founder_ownership")}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Left: inputs */}
          <div className="space-y-5">
            {/* Round type toggle */}
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-700">{t("round_type")}</p>
              <div className="flex rounded-lg border border-slate-200 p-1">
                {([
                  ["safe", "SAFE"],
                  ["note", "Convertible note"],
                  ["priced", "Priced round"],
                ] as Array<[RoundType, string]>).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRoundType(value)}
                    className="flex-1 rounded-md py-1.5 text-xs font-semibold transition"
                    style={segment(roundType === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* SAFE type (only when safe selected) */}
            {isSafe ? (
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-700">{t("safe_type")}</p>
                <div className="flex rounded-lg border border-slate-200 p-1">
                  {(["pre_money", "post_money"] as SafeType[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSafeType(value)}
                      className="flex-1 rounded-md py-1.5 text-[10px] font-semibold transition"
                      style={segment(safeType === value)}
                    >
                      {value === "pre_money" ? "Pre-money cap" : "Post-money cap"}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <SliderInput
              label={isNote ? "Valuation cap" : t("pre_money_valuation")}
              value={preMoney}
              onChange={setPreMoney}
              min={500_000}
              max={20_000_000}
              step={250_000}
              format={fmt}
            />
            <SliderInput
              label={t("raise_amount")}
              value={raiseAmount}
              onChange={setRaiseAmount}
              min={100_000}
              max={5_000_000}
              step={50_000}
              format={fmt}
            />
            <SliderInput
              label={t("option_pool_expansion")}
              value={optionPoolPct}
              onChange={setOptionPoolPct}
              min={0}
              max={25}
              step={1}
              format={(v) => `${v}%`}
            />

            {/* SAFE: optional discount */}
            {isSafe ? (
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <label className="flex cursor-pointer items-center justify-between gap-3">
                  <span>
                    <span className="block text-xs font-semibold text-slate-700">Discount</span>
                    <span className="block text-[10px] text-slate-400">The investor converts at the better of the cap or the discount.</span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={discountPct > 0}
                    onChange={(e) => setDiscountPct(e.target.checked ? 20 : 0)}
                    className="h-4 w-4 cursor-pointer"
                    style={{ accentColor: "#2E78F5" }}
                  />
                </label>
                {discountPct > 0 ? (
                  <SliderInput label="Discount rate" value={discountPct} onChange={setDiscountPct} min={5} max={30} step={1} format={(v) => `${v}%`} />
                ) : null}
              </div>
            ) : null}

            {/* Convertible note terms */}
            {isNote ? (
              <div className="space-y-5 border-t border-slate-100 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Note terms</p>
                <SliderInput label="Interest rate" value={interestPct} onChange={setInterestPct} min={0} max={12} step={0.5} format={(v) => `${v}%`} />
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">Maturity date</span>
                    <span className="font-mono text-xs font-bold" style={{ color: "#2E78F5" }}>{maturityMonths} months</span>
                  </div>
                  <p className="mb-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800">{maturityDate}</p>
                  <div className="flex rounded-lg border border-slate-200 p-1">
                    {[12, 18, 24, 36].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMaturityMonths(m)}
                        className="flex-1 rounded-md py-1.5 text-[10px] font-semibold transition"
                        style={segment(maturityMonths === m)}
                      >
                        {m} mo
                      </button>
                    ))}
                  </div>
                </div>
                <SliderInput label="Discount" value={discountPct} onChange={setDiscountPct} min={0} max={30} step={1} format={(v) => `${v}%`} />
                <SliderInput label="Warrant coverage" value={warrantPct} onChange={setWarrantPct} min={0} max={50} step={5} format={(v) => `${v}%`} />
                <p className="text-[10px] leading-relaxed text-slate-400">
                  Warrant coverage is a percent of the note principal, exercisable at the next round price. No institutional dataset exists for it, so the report shows reference only.
                </p>
              </div>
            ) : null}

            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Post-money", value: fmt(result.postMoney) },
                { label: "Investor gets", value: `${result.newInvestorPct.toFixed(1)}%` },
                { label: "Founders retain", value: `${founderTotalPct.toFixed(1)}%` },
                {
                  label: "Price / share",
                  value: result.pricePerShare ? `$${result.pricePerShare.toFixed(3)}` : "—",
                },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-xl px-3 py-2 text-center"
                  style={{ background: "#F8F7FD" }}
                >
                  <p className="font-mono text-sm font-bold" style={{ color: "#2E78F5" }}>{m.value}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{m.label}</p>
                </div>
              ))}
            </div>

            {/* Discount break even */}
            {result.discountBreakEvenPreMoney ? (
              <div className="rounded-xl px-3 py-2.5 text-[11px] leading-relaxed text-slate-600" style={{ background: "#E9F0FD" }}>
                <p className="font-semibold text-slate-800">
                  Break even next round pre-money: {fmt(preMoney)} ÷ {100 - discountPct}% = {fmt(result.discountBreakEvenPreMoney)}
                </p>
                <p>Below it the discount gives the investor more shares. Above it the cap does. The ownership split here converts at the cap.</p>
              </div>
            ) : null}

            {/* Note: what converts */}
            {isNote ? (
              <div className="space-y-1 rounded-xl px-3 py-2.5 text-[11px] text-slate-600" style={{ background: "#E9F0FD" }}>
                <p className="text-sm font-bold" style={{ color: "#2E78F5" }}>{fmtMoney2(result.convertingAmount)} converts at maturity</p>
                <p>Principal {fmtMoney2(raiseAmount)} plus interest {fmtMoney2(result.interestAmount)}, simple interest over {maturityMonths} months.</p>
                {warrantPct > 0 ? <p>Warrants at {warrantPct}% coverage: {fmtMoney2(result.warrantValue)} of shares at the next round price. Not included in the ownership split.</p> : null}
              </div>
            ) : null}
          </div>

          {/* Right: ownership chart */}
          <div>
            <p className="mb-3 text-xs font-semibold text-slate-700">{t("post_round_ownership")}</p>
            <OwnershipBar shareholders={result.post} />

            {/* Dilution warning */}
            {founderTotalPct < 50 ? (
              <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-amber-800">{t("founders_below_50")}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-amber-700">
                  Combined founder ownership will be {founderTotalPct.toFixed(1)}% post-round. This may affect control in future governance decisions — consider adjusting valuation or raise amount.
                </p>
              </div>
            ) : null}

            {/* AI analysis entry */}
            <div className="mt-5 rounded-xl border-2 p-4 print:hidden" style={{ borderColor: "#CFC6F7" }}>
              <p className="text-sm font-bold text-slate-900">AI offering analysis</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Compares this structure with published data from Carta, PitchBook NVCA, Cooley and CRV. Every figure links to its source.
              </p>
              <button
                type="button"
                onClick={() => { setReportInputs(inputs); setRunId((n) => n + 1); }}
                className="mt-3 w-full rounded-lg py-2.5 text-xs font-bold text-white transition hover:opacity-90"
                style={{ background: "#2563EB" }}
              >
                {reportInputs ? "Run AI analysis again" : "Run AI analysis"}
              </button>
              {reportStale ? (
                <p className="mt-2 text-[11px] font-semibold text-amber-700">Inputs changed since the last run. Run again to update the report.</p>
              ) : null}
            </div>

            <p className="mt-4 text-[10px] leading-relaxed text-slate-400">
              Illustrative model only. Actual dilution depends on conversion mechanics, pro-rata rights, and discount rates. Consult your legal counsel before finalising round structure.
            </p>
          </div>
        </div>
      </div>
    </div>

    {reportInputs ? <OfferingAnalysisReport key={runId} inputs={reportInputs} /> : null}
    </div>
  );
}
