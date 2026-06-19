import type { PartnerScore } from "@/lib/investor-rating/types";
import { TIER_LABELS } from "@/lib/investor-rating/types";

const TIER_CLASS: Record<string, string> = {
  premier: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  established: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  active: "bg-amber-50 text-amber-800 ring-amber-100",
  emerging: "bg-slate-100 text-slate-600 ring-slate-200",
  new: "bg-slate-100 text-slate-500 ring-slate-200",
};

const PILLAR_LABELS: Array<[keyof PartnerScore["pillars"], string, string]> = [
  ["followThrough", "Follow-through", "35%"],
  ["responsiveness", "Responsiveness", "25%"],
  ["credibility", "Credibility", "20%"],
  ["portfolioReadiness", "Portfolio readiness", "10%"],
  ["trackRecord", "Track record", "10%"],
];

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function PartnerScoreCard({
  name,
  subtitle,
  rating,
}: Readonly<{
  name: string;
  subtitle?: string;
  rating: PartnerScore;
}>) {
  const isNew = rating.status === "new";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
          {subtitle ? <p className="truncate text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${
            TIER_CLASS[rating.tier] ?? TIER_CLASS.new
          }`}
        >
          {TIER_LABELS[rating.tier]}
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2 border-b border-slate-100 pb-3">
        {isNew ? (
          <span className="text-sm text-slate-500">
            Building history — {rating.sampleSize} founder{rating.sampleSize === 1 ? "" : "s"} engaged
          </span>
        ) : (
          <>
            <span className="text-3xl font-semibold text-slate-900">{rating.score}</span>
            <span className="text-xs text-slate-500">/ 100 · Partner Score</span>
          </>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {PILLAR_LABELS.map(([key, label, weight]) => (
          <div key={key}>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">
                {label} <span className="text-slate-400">·{weight}</span>
              </span>
              <span className="font-medium text-slate-700">{Math.round(rating.pillars[key])}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-100">
              <div
                className="h-1.5 rounded-full bg-indigo-500"
                style={{ width: `${Math.round(rating.pillars[key])}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div>Conversion: <span className="font-medium text-slate-900">{pct(rating.facts.conversionRate)}</span></div>
        <div>Pledge honor: <span className="font-medium text-slate-900">{pct(rating.facts.pledgeHonorRate)}</span></div>
        <div>Reply rate: <span className="font-medium text-slate-900">{pct(rating.facts.replyRate)}</span></div>
        <div>
          Median reply:{" "}
          <span className="font-medium text-slate-900">
            {rating.facts.medianResponseHours == null ? "—" : `${Math.round(rating.facts.medianResponseHours)}h`}
          </span>
        </div>
      </div>
    </div>
  );
}
