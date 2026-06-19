import Link from "next/link";
import { Sparkles, Lock, ArrowUpRight } from "lucide-react";
import type { PartnerScore } from "@/lib/investor-rating/types";
import { TIER_LABELS } from "@/lib/investor-rating/types";
import type { PartnerCoaching } from "@/lib/investor-rating/coaching";

const TIER_CLASS: Record<string, string> = {
  premier: "bg-emerald-50 text-emerald-700",
  established: "bg-indigo-50 text-indigo-700",
  active: "bg-amber-50 text-amber-800",
  emerging: "bg-slate-100 text-slate-600",
  new: "bg-slate-100 text-slate-500",
};

const PILLARS: Array<[keyof PartnerScore["pillars"], string]> = [
  ["followThrough", "Follow-through"],
  ["responsiveness", "Responsiveness"],
  ["credibility", "Credibility"],
  ["portfolioReadiness", "Portfolio readiness"],
  ["trackRecord", "Track record"],
];

function barColor(value: number): string {
  if (value >= 70) return "bg-emerald-500";
  if (value >= 40) return "bg-amber-500";
  return "bg-rose-400";
}

export function InvestorPartnerScorePanel({
  score,
  coaching,
}: Readonly<{
  score: PartnerScore;
  coaching: PartnerCoaching;
}>) {
  const isNew = score.status === "new";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">
            Your Partner Score
          </p>
          {isNew ? (
            <p className="mt-1 text-sm text-slate-600">
              Building history — {score.sampleSize} founder{score.sampleSize === 1 ? "" : "s"} engaged
            </p>
          ) : (
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold text-indigo-600">{score.score}</span>
              <span className="text-sm text-slate-500">/ 100</span>
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium ${TIER_CLASS[score.tier] ?? TIER_CLASS.new}`}
        >
          {TIER_LABELS[score.tier]}
        </span>
      </div>

      {/* Coaching summary */}
      <div className="mt-3.5 flex gap-2.5 rounded-lg bg-slate-50 px-3.5 py-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" strokeWidth={1.9} aria-hidden />
        <p className="text-[13px] leading-6 text-slate-600">{coaching.summary}</p>
      </div>

      {/* Pillars */}
      {!isNew ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">
            Your pillars
          </p>
          <div className="space-y-2">
            {PILLARS.map(([key, label]) => {
              const value = Math.round(score.pillars[key]);
              return (
                <div key={key}>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-slate-600">{label}</span>
                    <span className="font-medium text-slate-700">{value}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                    <div className={`h-1.5 rounded-full ${barColor(value)}`} style={{ width: `${value}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Improvement nudges */}
      {coaching.recommendations.length > 0 ? (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">
            Improve your score
          </p>
          <div className="space-y-2">
            {coaching.recommendations.map((rec) => (
              <div
                key={rec.title}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"
              >
                <ArrowUpRight className="h-4 w-4 shrink-0 text-indigo-500" strokeWidth={1.9} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-slate-900">{rec.title}</p>
                  <p className="text-xs text-slate-500">{rec.detail}</p>
                </div>
                {rec.actionHref ? (
                  <Link
                    href={rec.actionHref}
                    className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    {rec.actionLabel ?? "Open"} →
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-3.5 flex items-center gap-1.5 text-[11px] text-slate-400">
        <Lock className="h-3 w-3" strokeWidth={1.9} aria-hidden />
        Only you can see your score and these suggestions. Founders see your tier and activity facts.
      </p>
    </div>
  );
}
