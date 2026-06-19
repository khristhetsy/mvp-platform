"use client";

import { useEffect, useState } from "react";
import type { DealBriefResult } from "@/app/api/investor/deal-brief/[companyId]/route";

const MATCH_STYLES: Record<string, { badge: string; dot: string }> = {
  strong:  { badge: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  partial: { badge: "bg-amber-50 text-amber-800 ring-amber-200",       dot: "bg-amber-400"  },
  weak:    { badge: "bg-slate-100 text-slate-600 ring-slate-200",       dot: "bg-slate-400"  },
};

export function InvestorDealBrief({ companyId }: { companyId: string }) {
  const [state, setState] = useState<"loading" | "done" | "error" | "dismissed">("loading");
  const [result, setResult] = useState<DealBriefResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/investor/deal-brief/${companyId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as DealBriefResult;
        if (!cancelled) { setResult(data); setState("done"); }
      } catch {
        if (!cancelled) setState("error");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [companyId]);

  if (state === "dismissed") return null;

  if (state === "loading") {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
        Preparing your personalized thesis brief…
      </div>
    );
  }

  if (state === "error" || !result) return null;

  const style = MATCH_STYLES[result.thesisMatch] ?? MATCH_STYLES.partial;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
            {result.thesisMatchLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setState("dismissed")}
          className="shrink-0 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Dismiss brief"
        >
          ✕
        </button>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Headline */}
        <p className="text-sm font-semibold text-slate-900 leading-snug">{result.headline}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Why it fits */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
              Why it fits your thesis
            </p>
            <ul className="space-y-1.5">
              {result.whyItFits.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* Watch-outs */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-600">
              Watch-outs
            </p>
            <ul className="space-y-1.5">
              {result.watchOuts.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 px-5 py-2.5">
        <p className="text-[10px] text-slate-400">
          AI brief personalized to your investment thesis · Not investment advice
          {result.source === "fallback" ? " · Add ANTHROPIC_API_KEY for deeper analysis" : ""}
        </p>
      </div>
    </div>
  );
}
