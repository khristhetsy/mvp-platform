"use client";

/**
 * InvestableReadinessPanel
 *
 * Investor-only. Shows overall readiness score + per-factor breakdown.
 * Tabs: Overview · Recommendations · History · Platform Comparison
 * Export: print-friendly PDF via window.print()
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
  scoreHistory?: Array<{ score: number; scoredAt: string }>;
  platformAvg?: number | null;
  percentile?: number | null;
};

const FACTOR_COLORS: Record<string, string> = {
  revenue_cashflow:   "#378ADD",
  customer_traction:  "#10B981",
  founder_team:       "#1D9E75",
  market_evidence:    "#378ADD",
  unit_economics:     "#F59E0B",
  governance_legal:   "#E8922A",
  ip_moat:            "#8B5CF6",
  burn_runway:        "#EF4444",
  exit_strategy:      "#6366F1",
  pitch_quality:      "#94A3B8",
  deal_structure:     "#A78BFA",
  industry_alignment: "#1D9E75",
  impact_esg:         "#1D9E75",
};

const FACTOR_TAGS: Record<string, { bg: string; text: string }> = {
  Financial:    { bg: "#E6F1FB", text: "#185FA5" },
  Traction:     { bg: "#ECFDF5", text: "#065F46" },
  Team:         { bg: "#EAF3DE", text: "#3B6D11" },
  Market:       { bg: "#E6F1FB", text: "#185FA5" },
  Economics:    { bg: "#FFFBEB", text: "#92400E" },
  Legal:        { bg: "#FAEEDA", text: "#854F0B" },
  Moat:         { bg: "#F5F3FF", text: "#5B21B6" },
  Strategy:     { bg: "#EEF2FF", text: "#3730A3" },
  Documents:    { bg: "#EEF0FF", text: "#4338CA" },
  "Deal Terms": { bg: "#F3F0FE", text: "#5B2EAA" },
  Fit:          { bg: "#EAF3DE", text: "#3B6D11" },
  ESG:          { bg: "#EAF3DE", text: "#3B6D11" },
};

type Tab = "overview" | "recommendations" | "history" | "comparison";

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

// ─── Derived recommendations from factor scores ───────────────────────────────

type Recommendation = {
  priority: "high" | "medium" | "low";
  factor: string;
  action: string;
  detail: string;
};

function buildRecommendations(factorScores: Record<FactorKey, FactorScore>): Recommendation[] {
  const recs: Recommendation[] = [];
  for (const f of READINESS_FACTORS) {
    const score = factorScores[f.key as FactorKey];
    if (!score) continue;
    const pct = score.pts / score.max;
    // Add red flags as high priority
    for (const flag of score.flags) {
      if (flag.severity === "red") {
        recs.push({
          priority: "high",
          factor: f.label,
          action: flag.label,
          detail: flag.detail,
        });
      }
    }
    // Add amber flags on weak factors as medium priority
    if (pct < 0.6) {
      for (const flag of score.flags) {
        if (flag.severity === "amber") {
          recs.push({
            priority: "medium",
            factor: f.label,
            action: flag.label,
            detail: flag.detail,
          });
        }
      }
    }
    // Low score with no explicit flags → generic nudge
    if (pct < 0.4 && score.flags.filter((f) => f.severity !== "green").length === 0) {
      recs.push({
        priority: "low",
        factor: f.label,
        action: `Strengthen ${f.label}`,
        detail: score.aiSummary || "Upload additional supporting documents for this factor.",
      });
    }
  }
  // Sort: high → medium → low
  const order = { high: 0, medium: 1, low: 2 };
  return recs.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 12);
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function OverviewTab({
  factorScores,
  setActiveKey,
  displayScore,
  mainColor,
}: {
  factorScores: Record<FactorKey, FactorScore>;
  setActiveKey: (k: FactorKey) => void;
  displayScore: number;
  mainColor: string;
}) {
  return (
    <>
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
                  <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: color }} />
                </div>
              </div>
              <span className="w-8 text-right text-sm font-medium" style={{ color }}>{score.pts}</span>
              <span className="text-xs text-slate-400">/ {f.max}</span>
              <span className="text-slate-300">›</span>
            </button>
          );
        })}
      </div>
      <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">Total</span>
        <span className="text-lg font-semibold" style={{ color: mainColor }}>
          {displayScore}
          <span className="ml-1 text-sm font-normal text-slate-400">/ 100</span>
        </span>
      </div>
    </>
  );
}

function RecommendationsTab({ factorScores }: { factorScores: Record<FactorKey, FactorScore> }) {
  const recs = buildRecommendations(factorScores);
  const priorityStyle: Record<string, { dot: string; badge: string; label: string }> = {
    high:   { dot: "bg-red-400",   badge: "bg-red-50 text-red-700",    label: "High priority" },
    medium: { dot: "bg-amber-400", badge: "bg-amber-50 text-amber-700", label: "Suggested" },
    low:    { dot: "bg-slate-300", badge: "bg-slate-100 text-slate-600", label: "Optional" },
  };

  if (recs.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-3xl">🎉</p>
        <p className="mt-2 text-sm font-medium text-slate-700">No critical gaps found</p>
        <p className="mt-1 text-xs text-slate-400">This company scores well across all factors.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100 px-4 py-2">
      {recs.map((rec, i) => {
        const s = priorityStyle[rec.priority];
        return (
          <div key={i} className="py-4 flex gap-3">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.badge}`}>{s.label}</span>
                <span className="text-xs text-slate-400">{rec.factor}</span>
              </div>
              <p className="text-sm font-medium text-slate-700">{rec.action}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{rec.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HistoryTab({ history }: { history: Array<{ score: number; scoredAt: string }> }) {
  if (history.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-sm text-slate-400">No score history yet.</div>
    );
  }

  const max = Math.max(...history.map((h) => h.score));
  const min = Math.min(...history.map((h) => h.score));
  const range = max - min || 20;

  // Reverse so oldest is left
  const ordered = [...history].reverse();
  const W = 420;
  const H = 100;
  const pad = { l: 32, r: 12, t: 10, b: 24 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const points = ordered.map((h, i) => {
    const x = pad.l + (i / Math.max(ordered.length - 1, 1)) * innerW;
    const y = pad.t + innerH - ((h.score - min) / range) * innerH;
    return { x, y, score: h.score, date: h.scoredAt };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="px-6 py-4 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Score over time</p>
      <div className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50 p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
          {/* Grid lines */}
          {[0, 0.5, 1].map((t) => {
            const y = pad.t + innerH - t * innerH;
            return (
              <g key={t}>
                <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3,3" />
                <text x={pad.l - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#94A3B8">
                  {Math.round(min + t * range)}
                </text>
              </g>
            );
          })}
          {/* Line */}
          <polyline
            points={polyline}
            fill="none"
            stroke="#6366F1"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Dots */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill="#6366F1" />
              <title>{`${p.score} pts · ${new Date(p.date).toLocaleDateString()}`}</title>
            </g>
          ))}
          {/* X-axis dates */}
          {ordered.map((h, i) => {
            const x = pad.l + (i / Math.max(ordered.length - 1, 1)) * innerW;
            if (i > 0 && i < ordered.length - 1 && ordered.length > 4) return null;
            return (
              <text key={i} x={x} y={H - 4} textAnchor="middle" fontSize="8" fill="#94A3B8">
                {new Date(h.scoredAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Table */}
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
        {history.map((h, i) => {
          const color = scoreColor(h.score / 100);
          return (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs text-slate-400">
                  {new Date(h.scoredAt).toLocaleDateString(undefined, {
                    year: "numeric", month: "short", day: "numeric",
                  })}
                </p>
                {i === 0 && <span className="text-xs font-medium text-indigo-500">Latest</span>}
              </div>
              <div className="flex items-center gap-3">
                <div className="w-20 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${h.score}%`, background: color }} />
                </div>
                <span className="w-10 text-right text-sm font-semibold" style={{ color }}>
                  {h.score}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComparisonTab({
  displayScore,
  platformAvg,
  percentile,
  mainColor,
}: {
  displayScore: number;
  platformAvg: number | null;
  percentile: number | null;
  mainColor: string;
}) {
  const diff = platformAvg !== null ? displayScore - platformAvg : null;

  return (
    <div className="px-6 py-4 space-y-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Platform comparison</p>

      {/* Percentile banner */}
      {percentile !== null && (
        <div className="rounded-2xl bg-indigo-50 px-5 py-4 text-center">
          <p className="text-5xl font-semibold text-indigo-600">{percentile}th</p>
          <p className="mt-1 text-sm text-indigo-500">percentile on this platform</p>
          <p className="mt-0.5 text-xs text-indigo-400">
            Scores higher than {percentile}% of companies
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-center">
          <p className="text-2xl font-semibold" style={{ color: mainColor }}>{displayScore}</p>
          <p className="mt-0.5 text-xs text-slate-400">This company</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-center">
          <p className="text-2xl font-semibold text-slate-700">{platformAvg ?? "—"}</p>
          <p className="mt-0.5 text-xs text-slate-400">Platform avg</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-center">
          {diff !== null ? (
            <p className={`text-2xl font-semibold ${diff >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {diff >= 0 ? "+" : ""}{diff}
            </p>
          ) : (
            <p className="text-2xl font-semibold text-slate-300">—</p>
          )}
          <p className="mt-0.5 text-xs text-slate-400">vs avg</p>
        </div>
      </div>

      {/* Gauge bar */}
      {platformAvg !== null && (
        <div>
          <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="absolute top-0 left-0 h-full rounded-full transition-all"
              style={{ width: `${displayScore}%`, background: mainColor }}
            />
            {/* Platform avg marker */}
            <div
              className="absolute top-0 h-full w-0.5 bg-slate-500"
              style={{ left: `${platformAvg}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>0</span>
            <span className="text-slate-500" style={{ position: "relative", left: `${platformAvg - 50}%` }}>
              Avg {platformAvg}
            </span>
            <span>100</span>
          </div>
        </div>
      )}

      {platformAvg === null && (
        <p className="text-center text-xs text-slate-400">
          Platform data not yet available.
        </p>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function InvestableReadinessPanel({
  companyName,
  totalScore,
  factorScores,
  effectiveScore,
  isOverridden = false,
  scoredAt,
  scoreHistory = [],
  platformAvg = null,
  percentile = null,
}: Props) {
  const [activeKey, setActiveKey] = useState<FactorKey | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  const displayScore = effectiveScore ?? totalScore;
  const scorePct = displayScore / 100;
  const mainColor = scoreColor(scorePct);

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview",         label: "Overview" },
    { id: "recommendations",  label: "Recommendations" },
    { id: "history",          label: "History" },
    { id: "comparison",       label: "Comparison" },
  ];

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm print:shadow-none print:border-slate-300">
        {/* Header */}
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
                Investable Readiness Score
              </p>
              <p className="mt-0.5 text-sm text-slate-500">{companyName}</p>
            </div>
            <div className="flex items-center gap-3">
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
              {/* PDF export button */}
              <button
                onClick={() => window.print()}
                className="print:hidden rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                title="Export as PDF"
              >
                ↓ PDF
              </button>
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
              Rule-based scoring · {new Date(scoredAt).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-slate-100 print:hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-3 text-xs font-medium transition-colors ${
                tab === t.id
                  ? "border-b-2 border-indigo-500 text-indigo-600"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "overview" && (
          <OverviewTab
            factorScores={factorScores}
            setActiveKey={setActiveKey}
            displayScore={displayScore}
            mainColor={mainColor}
          />
        )}
        {tab === "recommendations" && <RecommendationsTab factorScores={factorScores} />}
        {tab === "history" && <HistoryTab history={scoreHistory} />}
        {tab === "comparison" && (
          <ComparisonTab
            displayScore={displayScore}
            platformAvg={platformAvg}
            percentile={percentile}
            mainColor={mainColor}
          />
        )}
      </div>

      {/* Print-only: full factor list (always visible in PDF) */}
      <div className="hidden print:block mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Factor Breakdown</p>
        {READINESS_FACTORS.map((f) => {
          const score = factorScores[f.key as FactorKey];
          if (!score) return null;
          const color = FACTOR_COLORS[f.key] ?? "#378ADD";
          return (
            <div key={f.key} className="flex items-center gap-3 py-1.5 border-b border-slate-100">
              <span className="flex-1 text-sm text-slate-600">{f.label}</span>
              <span className="text-sm font-medium" style={{ color }}>{score.pts} / {score.max}</span>
            </div>
          );
        })}
      </div>

      {/* Factor modal */}
      {activeKey && factorScores[activeKey] && (
        <FactorModal
          factorKey={activeKey}
          score={factorScores[activeKey]}
          onClose={() => setActiveKey(null)}
        />
      )}
    </>
  );
}
