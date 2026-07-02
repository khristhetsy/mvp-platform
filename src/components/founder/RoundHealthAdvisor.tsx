"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { RoundHealthAdvisorResult, RoundHealthRecommendation } from "@/app/api/founder/round-health-advisor/route";

const GRADE_STYLES: Record<string, { bg: string; text: string; ring: string }> = {
  A: { bg: "bg-emerald-500", text: "text-white",    ring: "ring-emerald-200" },
  B: { bg: "bg-indigo-500",  text: "text-white",    ring: "ring-indigo-200"  },
  C: { bg: "bg-amber-400",   text: "text-white",    ring: "ring-amber-200"   },
  D: { bg: "bg-red-500",     text: "text-white",    ring: "ring-red-200"     },
};

const PRIORITY_STYLES: Record<string, { badge: string; border: string }> = {
  high:   { badge: "bg-red-50 text-red-700",    border: "border-l-red-400"    },
  medium: { badge: "bg-amber-50 text-amber-700", border: "border-l-amber-400" },
  low:    { badge: "bg-slate-100 text-slate-600", border: "border-l-slate-300" },
};

function RecommendationCard({ rec }: { rec: RoundHealthRecommendation }) {
  const style = PRIORITY_STYLES[rec.priority] ?? PRIORITY_STYLES.low;
  return (
    <div className={`rounded-lg border border-slate-200 border-l-4 bg-white p-4 ${style.border}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{rec.title}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${style.badge}`}>
          {rec.priority}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-slate-600">{rec.action}</p>
      {rec.metric && (
        <p className="mt-1.5 text-[11px] font-medium text-slate-400">{rec.metric}</p>
      )}
    </div>
  );
}

export function RoundHealthAdvisor() {
  const t = useTranslations("founderCmp");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<RoundHealthAdvisorResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function runAnalysis() {
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/founder/round-health-advisor");
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as RoundHealthAdvisorResult;
      setResult(data);
      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Analysis failed. Please try again.");
      setState("error");
    }
  }

  if (state === "idle") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-indigo-900">{t("ai_round_health_check")}</p>
          <p className="mt-0.5 text-xs text-indigo-600">
            Get a personalized assessment of your raise with specific next steps — powered by Claude AI.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runAnalysis()}
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          Analyze my round →
        </button>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        <p className="text-sm text-slate-600">{t("analyzing_your_round_data")}</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4">
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

  const gradeStyle = GRADE_STYLES[result.healthGrade] ?? GRADE_STYLES.B;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-4 ${gradeStyle.bg} ${gradeStyle.ring}`}>
          <span className={`text-xl font-bold ${gradeStyle.text}`}>{result.healthGrade}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">{result.healthLabel}</p>
          <p className="mt-0.5 text-xs text-slate-500">{result.summary}</p>
        </div>
        <button
          type="button"
          onClick={() => { setState("idle"); setResult(null); }}
          className="shrink-0 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Clear analysis"
        >
          Refresh
        </button>
      </div>

      {/* Recommendations */}
      <div className="space-y-3 p-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Recommendations
        </p>
        {result.recommendations.map((rec, i) => (
          <RecommendationCard key={i} rec={rec} />
        ))}
      </div>

      {result.source === "fallback" && (
        <p className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
          Analysis based on algorithmic rules. Connect an Anthropic API key for AI-powered insights.
        </p>
      )}
    </div>
  );
}
