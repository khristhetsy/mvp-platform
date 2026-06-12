"use client";

/**
 * InvestableReadinessPanel
 *
 * Investor-only component. Shows overall investable readiness score and
 * per-factor breakdown. Clicking any factor opens a detailed report popup
 * with AI analysis, sub-scores, document evidence, and flags.
 */

import { useState } from "react";
import { READINESS_FACTORS } from "@/lib/ai/readiness-scoring";
import type { FactorKey, FactorScore } from "@/lib/ai/readiness-scoring";

type Props = {
  companyName: string;
  totalScore: number;
  factorScores: Record<FactorKey, FactorScore>;
  effectiveScore?: number | null;
  isOverridden?: boolean;
  scoredAt?: string | null;
};

const FACTOR_COLORS: Record<string, string> = {
  revenue_cashflow:   "#378ADD",
  founder_integrity:  "#1D9E75",
  governance_legal:   "#E8922A",
  market_evidence:    "#378ADD",
  pitch_quality:      "#6366F1",
  deal_structure:     "#A78BFA",
  industry_alignment: "#1D9E75",
  impact_esg:         "#1D9E75",
};

const FACTOR_TAGS: Record<string, { bg: string; text: string }> = {
  Financial:    { bg: "#E6F1FB", text: "#185FA5" },
  Team:         { bg: "#EAF3DE", text: "#3B6D11" },
  Legal:        { bg: "#FAEEDA", text: "#854F0B" },
  Market:       { bg: "#E6F1FB", text: "#185FA5" },
  Documents:    { bg: "#EEF0FF", text: "#4338CA" },
  "Deal Terms": { bg: "#F3F0FE", text: "#5B2EAA" },
  Fit:          { bg: "#EAF3DE", text: "#3B6D11" },
  ESG:          { bg: "#EAF3DE", text: "#3B6D11" },
};

function scoreColor(pct: number): string {
  if (pct >= 0.75) return "#1D9E75";
  if (pct >= 0.45) return "#E8922A";
  return "#D9534F";
}

function ScoreBadge({ rating }: { rating: string }) {
  const cls: Record<string, string> = {
    Strong:        "bg-emerald-50 text-emerald-700",
    Developing:    "bg-amber-50 text-amber-700",
    "Needs Work":  "bg-red-50 text-red-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls[rating] ?? "bg-slate-100 text-slate-600"}`}>
      {rating}
    </span>
  );
}

function FlagChip({ severity, label }: { severity: string; label: string }) {
  const cls: Record<string, string> = {
    red:   "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls[severity] ?? "bg-slate-100 text-slate-600"}`}>
      {label}
    </span>
  );
}

function FactorModal({
  factorKey,
  score,
  onClose,
}: {
  factorKey: FactorKey;
  score: FactorScore;
  onClose: () => void;
}) {
  const def = READINESS_FACTORS.find((f) => f.key === factorKey)!;
  const color = FACTOR_COLORS[factorKey] ?? "#378ADD";
  const tag = FACTOR_TAGS[def.tag] ?? { bg: "#F1F5F9", text: "#475569" };
  const pct = score.pts / score.max;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-6 py-5">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{ background: tag.bg, color: tag.text }}
          >
            {def.tag}
          </span>
          <h2 className="mt-2 text-base font-semibold text-slate-950">{def.label}</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {score.pts} / {score.max} pts · {score.rating}
          </p>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Score bar */}
          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-semibold" style={{ color }}>{score.pts}</span>
              <span className="text-lg text-slate-400">/ {score.max}</span>
              <ScoreBadge rating={score.rating} />
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct * 100}%`, background: color }}
              />
            </div>
          </div>

          {/* AI Analysis */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">AI Analysis</p>
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600">
              {score.aiSummary || "No analysis available."}
            </div>
          </div>

          {/* Sub-scores */}
          {score.subScores.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Sub-scores</p>
              <div className="space-y-2">
                {score.subScores.map((s) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 text-xs text-slate-500">{s.label}</span>
                    <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(s.pts / s.max) * 100}%`, background: color }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-medium text-slate-700">
                      {s.pts}/{s.max}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidence */}
          {score.evidence.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Evidence from documents
              </p>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {score.evidence.map((e, i) => (
                  <div key={i} className="flex gap-3 px-4 py-3">
                    <span className="mt-0.5 shrink-0">{e.icon}</span>
                    <div>
                      <p className="text-sm text-slate-700">{e.text}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{e.src}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Flags */}
          {score.flags.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Flags & recommendations
              </p>
              <div className="space-y-2">
                {score.flags.map((f, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3">
                    <FlagChip severity={f.severity} label={f.label} />
                    <p className="text-xs leading-relaxed text-slate-500">{f.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-slate-100 bg-white px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function InvestableReadinessPanel({
  companyName,
  totalScore,
  factorScores,
  effectiveScore,
  isOverridden = false,
  scoredAt,
}: Props) {
  const [activeKey, setActiveKey] = useState<FactorKey | null>(null);
  const displayScore = effectiveScore ?? totalScore;
  const scorePct = displayScore / 100;
  const mainColor = scoreColor(scorePct);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              Investable Readiness Score
            </p>
            <p className="mt-0.5 text-sm text-slate-500">{companyName}</p>
          </div>
          <div className="text-right">
            <span className="text-4xl font-semibold" style={{ color: mainColor }}>
              {displayScore}
            </span>
            <span className="ml-1 text-lg text-slate-400">/ 100</span>
            {isOverridden && (
              <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                Admin override
              </span>
            )}
          </div>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${scorePct * 100}%`, background: mainColor }}
          />
        </div>
        {scoredAt && (
          <p className="mt-2 text-xs text-slate-400">
            AI scored · {new Date(scoredAt).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Factor list */}
      <div className="px-4 py-3">
        <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Factor breakdown — click to expand
        </p>
        {READINESS_FACTORS.map((f) => {
          const score = factorScores[f.key as FactorKey];
          if (!score) return null;
          const color = FACTOR_COLORS[f.key] ?? "#378ADD";
          const pct = score.pts / score.max;

          return (
            <button
              key={f.key}
              onClick={() => setActiveKey(f.key as FactorKey)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{f.label}</span>
              <div className="hidden w-24 sm:block">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct * 100}%`, background: color }}
                  />
                </div>
              </div>
              <span className="w-8 text-right text-sm font-medium" style={{ color }}>
                {score.pts}
              </span>
              <span className="text-xs text-slate-400">/ {f.max}</span>
              <span className="text-slate-300">›</span>
            </button>
          );
        })}
      </div>

      {/* Total */}
      <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">Total</span>
        <span className="text-lg font-semibold" style={{ color: mainColor }}>
          {displayScore}
          <span className="ml-1 text-sm font-normal text-slate-400">/ 100</span>
        </span>
      </div>

      {/* Modal */}
      {activeKey && factorScores[activeKey] && (
        <FactorModal
          factorKey={activeKey}
          score={factorScores[activeKey]}
          onClose={() => setActiveKey(null)}
        />
      )}
    </div>
  );
}
