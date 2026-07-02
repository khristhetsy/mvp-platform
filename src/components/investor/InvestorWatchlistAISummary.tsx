"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { WatchlistAISummaryResult, CompanyInsight } from "@/app/api/investor/watchlist/ai-summary/route";

type RowRef = {
  companyId: string;
  companyName: string;
  industry: string | null;
  stage: string | null;
};

const ALIGNMENT_STYLES: Record<string, { bar: string; badge: string; text: string }> = {
  "Strong fit":   { bar: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-800", text: "text-emerald-700" },
  "Moderate fit": { bar: "bg-indigo-400",  badge: "bg-indigo-50 text-indigo-800",   text: "text-indigo-700"  },
  "Weak fit":     { bar: "bg-slate-300",   badge: "bg-slate-100 text-slate-600",    text: "text-slate-500"   },
};

function ScoreBar({ score, label }: { score: number; label: string }) {
  const style = ALIGNMENT_STYLES[label] ?? ALIGNMENT_STYLES["Moderate fit"];
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${style.bar}`}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
      <span className={`text-[10px] font-semibold ${style.text}`}>{score}</span>
    </div>
  );
}

export function InvestorWatchlistAISummary({ rows }: { rows: RowRef[] }) {
  const t = useTranslations("investorCmp");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<WatchlistAISummaryResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function analyze() {
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/investor/watchlist/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companies: rows.map((r) => ({
            companyId: r.companyId,
            companyName: r.companyName,
            industry: r.industry,
            stage: r.stage,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as WatchlistAISummaryResult;
      setResult(data);
      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Analysis failed. Please try again.");
      setState("error");
    }
  }

  if (rows.length === 0) return null;

  if (state === "idle") {
    return (
      <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-indigo-900">{t("thesis_alignment_analysis")}</p>
          <p className="mt-0.5 text-xs text-indigo-600">
            AI scores each saved company against your investment thesis.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void analyze()}
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          Analyze watchlist →
        </button>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        <p className="text-sm text-slate-600">{t("scoring_companies_against_your_thesis")}</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="mb-6 rounded-xl border border-red-100 bg-red-50 px-5 py-4">
        <p className="text-sm text-red-700">{errorMsg}</p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="mt-2 text-xs font-semibold text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!result) return null;

  // Build a map for quick lookup
  const insightMap = new Map<string, CompanyInsight>(
    result.insights.map((i) => [i.companyId, i]),
  );

  const topPickNames = result.topPicks
    .map((id) => rows.find((r) => r.companyId === id)?.companyName)
    .filter(Boolean);

  return (
    <div className="mb-6 rounded-xl border border-indigo-100 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{t("thesis_alignment_analysis")}</p>
          <p className="mt-0.5 text-xs text-slate-500">{result.thesisCoverage}</p>
        </div>
        <button
          type="button"
          onClick={() => { setState("idle"); setResult(null); }}
          className="shrink-0 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-2">
        {/* Top picks */}
        {topPickNames.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
              Top thesis matches
            </p>
            <ul className="space-y-1.5">
              {topPickNames.map((name) => (
                <li key={name} className="flex items-center gap-2 text-xs font-medium text-slate-800">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  {name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Missing segments */}
        {result.missingSegments.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-600">
              Thesis gaps
            </p>
            <ul className="space-y-1.5">
              {result.missingSegments.map((seg, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  {seg}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Per-company scores */}
      {result.insights.length > 0 && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Company alignment scores
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => {
              const insight = insightMap.get(row.companyId);
              if (!insight) return null;
              const style = ALIGNMENT_STYLES[insight.alignmentLabel] ?? ALIGNMENT_STYLES["Moderate fit"];
              return (
                <div key={row.companyId} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800 leading-tight">{row.companyName}</p>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${style.badge}`}>
                      {insight.alignmentLabel}
                    </span>
                  </div>
                  <ScoreBar score={insight.alignmentScore} label={insight.alignmentLabel} />
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{insight.reasoning}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {result.source === "fallback" && (
        <p className="border-t border-slate-100 px-5 py-2.5 text-[10px] text-slate-400">
          Algorithmic assessment — add ANTHROPIC_API_KEY for AI-powered thesis analysis
        </p>
      )}
    </div>
  );
}
