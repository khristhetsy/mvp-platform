"use client";

import { useState } from "react";
import type { AIAssessmentResult, AIAssessmentRecommendation } from "@/app/api/admin/companies/[id]/ai-assessment/route";

const RECOMMENDATION_STYLES: Record<AIAssessmentRecommendation, {
  badge: string;
  border: string;
  label: string;
  icon: string;
}> = {
  approve: {
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    border: "border-emerald-200",
    label: "Recommend approval",
    icon: "✓",
  },
  request_changes: {
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
    border: "border-amber-200",
    label: "Request changes",
    icon: "△",
  },
  decline: {
    badge: "bg-red-50 text-red-800 ring-red-200",
    border: "border-red-200",
    label: "Recommend decline",
    icon: "✕",
  },
};

export function AdminCompanyAIAssessment({ companyId }: { companyId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<AIAssessmentResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function runAssessment() {
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/ai-assessment`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as AIAssessmentResult;
      setResult(data);
      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Assessment failed. Please try again.");
      setState("error");
    }
  }

  if (state === "idle") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-indigo-900">AI Company Assessment</p>
          <p className="mt-0.5 text-xs text-indigo-600">
            Generate a structured review summary — recommendation, strengths, concerns, and data gaps.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runAssessment()}
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          Assess company →
        </button>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        <p className="text-sm text-slate-600">Analyzing company data…</p>
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

  const style = RECOMMENDATION_STYLES[result.recommendation];

  return (
    <div className={`rounded-xl border ${style.border} bg-white shadow-sm`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style.badge}`}>
            <span>{style.icon}</span>
            {style.label}
          </span>
        </div>
        <button
          type="button"
          onClick={() => { setState("idle"); setResult(null); }}
          className="shrink-0 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Headline */}
        <p className="text-sm font-semibold text-slate-900 leading-snug">{result.headline}</p>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* Strengths */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
              Strengths
            </p>
            <ul className="space-y-1.5">
              {result.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  {s}
                </li>
              ))}
            </ul>
          </div>

          {/* Concerns */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-600">
              Concerns
            </p>
            <ul className="space-y-1.5">
              {result.concerns.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  {c}
                </li>
              ))}
            </ul>
          </div>

          {/* Data gaps */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Data gaps
            </p>
            <ul className="space-y-1.5">
              {result.dataGaps.length > 0 ? (
                result.dataGaps.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                    {g}
                  </li>
                ))
              ) : (
                <li className="text-xs text-slate-400 italic">No critical gaps identified</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {result.source === "fallback" && (
        <p className="border-t border-slate-100 px-5 py-2.5 text-[10px] text-slate-400">
          Algorithmic assessment — add ANTHROPIC_API_KEY for AI-powered analysis
        </p>
      )}
    </div>
  );
}
