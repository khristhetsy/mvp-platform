"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RoundType = "safe" | "priced";
type SafeType = "pre_money" | "post_money";

type Shareholder = {
  id: string;
  label: string;
  shares: number;
  editable: boolean;
};

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

function computeDilution(opts: {
  roundType: RoundType;
  safeType: SafeType;
  preMoney: number;
  raiseAmount: number;
  optionPoolPct: number;
  shareholders: Shareholder[];
}): { post: Shareholder[]; pricePerShare: number | null; postMoney: number; newInvestorPct: number } {
  const { roundType, safeType, preMoney, raiseAmount, optionPoolPct, shareholders } = opts;
  const postMoney = preMoney + raiseAmount;

  const totalExisting = shareholders.reduce((s, sh) => s + sh.shares, 0);
  const optionPoolShares = Math.round((optionPoolPct / 100) * totalExisting / (1 - optionPoolPct / 100));

  if (roundType === "priced") {
    // Pre-money option pool expansion
    const totalPreMoney = totalExisting + optionPoolShares;
    const pricePerShare = preMoney / totalPreMoney;
    const newShares = Math.round(raiseAmount / pricePerShare);
    const totalPost = totalPreMoney + newShares;

    const post: Shareholder[] = [
      ...shareholders.map((sh) => ({
        ...sh,
        pct: (sh.shares / totalPost) * 100,
      })),
      {
        id: "option_pool",
        label: "Option pool (expansion)",
        shares: optionPoolShares,
        editable: false,
        pct: (optionPoolShares / totalPost) * 100,
      },
      {
        id: "new_investor",
        label: "New investors (this round)",
        shares: newShares,
        editable: false,
        pct: (newShares / totalPost) * 100,
      },
    ].map((sh) => ({ ...sh, pct: ((sh as { pct?: number }).pct ?? 0) }));

    return {
      post,
      pricePerShare,
      postMoney,
      newInvestorPct: (newShares / totalPost) * 100,
    };
  }

  // SAFE
  const safeValCap = preMoney; // valuation cap = pre-money
  const totalForSafe = safeType === "pre_money" ? totalExisting : totalExisting + optionPoolShares;
  const pricePerShare = safeValCap / totalForSafe;
  const safeShares = Math.round(raiseAmount / pricePerShare);
  const totalPost = totalExisting + optionPoolShares + safeShares;

  const post: Shareholder[] = [
    ...shareholders.map((sh) => ({
      ...sh,
      pct: (sh.shares / totalPost) * 100,
    })),
    {
      id: "option_pool",
      label: "Option pool",
      shares: optionPoolShares,
      editable: false,
      pct: (optionPoolShares / totalPost) * 100,
    },
    {
      id: "safe_investor",
      label: "SAFE investors",
      shares: safeShares,
      editable: false,
      pct: (safeShares / totalPost) * 100,
    },
  ].map((sh) => ({ ...sh, pct: ((sh as { pct?: number }).pct ?? 0) }));

  return {
    post,
    pricePerShare,
    postMoney,
    newInvestorPct: (safeShares / totalPost) * 100,
  };
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

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
        <span className="font-mono text-xs font-bold" style={{ color: "#534AB7" }}>{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200"
        style={{ accentColor: "#534AB7" }}
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
    founder_1: "#534AB7",
    founder_2: "#7c3aed",
    employees: "#06b6d4",
    option_pool: "#0ea5e9",
    new_investor: "#16a34a",
    safe_investor: "#16a34a",
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

const DEFAULT_SHAREHOLDERS: Shareholder[] = [
  { id: "founder_1", label: "Founder 1", shares: 4_000_000, editable: true },
  { id: "founder_2", label: "Founder 2", shares: 3_000_000, editable: true },
  { id: "employees", label: "Early employees / angels", shares: 1_000_000, editable: true },
];

export function RoundStructureCalculator() {
  const t = useTranslations("founderCmp");
  const [roundType, setRoundType] = useState<RoundType>("safe");
  const [safeType, setSafeType] = useState<SafeType>("post_money");
  const [preMoney, setPreMoney] = useState(5_000_000);
  const [raiseAmount, setRaiseAmount] = useState(1_000_000);
  const [optionPoolPct, setOptionPoolPct] = useState(10);

  const result = useMemo(
    () =>
      computeDilution({
        roundType,
        safeType,
        preMoney,
        raiseAmount,
        optionPoolPct,
        shareholders: DEFAULT_SHAREHOLDERS,
      }),
    [roundType, safeType, preMoney, raiseAmount, optionPoolPct],
  );

  const founderTotalPct = result.post
    .filter((s) => s.id.startsWith("founder"))
    .reduce((sum, s) => sum + ((s as { pct?: number }).pct ?? 0), 0);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Accent bar */}
      <div style={{ height: 3, background: "linear-gradient(90deg,#534AB7,#7c3aed,#06b6d4)" }} />

      <div className="p-5">
        {/* Header */}
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "#EEEDFE" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                stroke="#534AB7" strokeWidth="1.8" strokeLinecap="round" />
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
                {(["safe", "priced"] as RoundType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setRoundType(t)}
                    className="flex-1 rounded-md py-1.5 text-xs font-semibold transition"
                    style={{
                      background: roundType === t ? "#534AB7" : "transparent",
                      color: roundType === t ? "white" : "#64748b",
                    }}
                  >
                    {t === "safe" ? "SAFE / Note" : "Priced round"}
                  </button>
                ))}
              </div>
            </div>

            {/* SAFE type (only when safe selected) */}
            {roundType === "safe" ? (
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-700">{t("safe_type")}</p>
                <div className="flex rounded-lg border border-slate-200 p-1">
                  {(["pre_money", "post_money"] as SafeType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSafeType(t)}
                      className="flex-1 rounded-md py-1.5 text-[10px] font-semibold transition"
                      style={{
                        background: safeType === t ? "#534AB7" : "transparent",
                        color: safeType === t ? "white" : "#64748b",
                      }}
                    >
                      {t === "pre_money" ? "Pre-money cap" : "Post-money cap"}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <SliderInput
              label={t("pre_money_valuation")}
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
                  <p className="font-mono text-sm font-bold" style={{ color: "#534AB7" }}>{m.value}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{m.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: ownership chart */}
          <div>
            <p className="mb-3 text-xs font-semibold text-slate-700">{t("post_round_ownership")}</p>
            <OwnershipBar
              shareholders={result.post.map((s) => ({
                ...s,
                pct: (s as unknown as { pct: number }).pct,
              }))}
            />

            {/* Dilution warning */}
            {founderTotalPct < 50 ? (
              <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-amber-800">{t("founders_below_50")}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-amber-700">
                  Combined founder ownership will be {founderTotalPct.toFixed(1)}% post-round. This may affect control in future governance decisions — consider adjusting valuation or raise amount.
                </p>
              </div>
            ) : null}

            <p className="mt-4 text-[10px] leading-relaxed text-slate-400">
              Illustrative model only. Actual dilution depends on conversion mechanics, pro-rata rights, and discount rates. Consult your legal counsel before finalising round structure.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
