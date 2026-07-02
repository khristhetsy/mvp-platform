"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

type OpportunityRow = {
  companyId: string;
  companyName: string;
  industry: string | null;
  stage: string | null;
  location: string | null;
  readinessScore: number | null;
  matchScore: number | null;
  matchReasons: string[];
  fundingTarget: string | null;
};

function scoreClass(score: number) {
  if (score >= 80) return "bg-emerald-50 text-emerald-800";
  if (score >= 65) return "bg-indigo-50 text-indigo-800";
  return "bg-slate-100 text-slate-600";
}

export function InvestorForYouPanel({ rows }: { rows: OpportunityRow[] }) {
  const t = useTranslations("investorCmp");
  const topMatches = rows
    .filter((r) => (r.matchScore ?? 0) >= 60)
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
    .slice(0, 4);

  if (topMatches.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-900">{t("for_you")}</h2>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
          {topMatches.length} thesis match{topMatches.length !== 1 ? "es" : ""}
        </span>
        <span className="text-[11px] text-slate-400">{t("based_on_your_investment_profile")}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {topMatches.map((row) => (
          <Link
            key={row.companyId}
            href={`/investor/opportunities/${row.companyId}/report`}
            className="group flex flex-col rounded-xl border border-indigo-100 bg-white p-4 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
          >
            {/* Score + readiness row */}
            <div className="mb-2 flex items-center justify-between gap-2">
              {row.matchScore !== null && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${scoreClass(row.matchScore)}`}>
                  {row.matchScore}% match
                </span>
              )}
              {row.readinessScore !== null && (
                <span className="text-[10px] text-slate-400">
                  {row.readinessScore}% ready
                </span>
              )}
            </div>

            {/* Company name */}
            <p className="text-sm font-semibold leading-snug text-slate-900 transition-colors group-hover:text-indigo-700">
              {row.companyName}
            </p>

            {/* Meta tags */}
            <p className="mt-0.5 text-xs text-slate-500">
              {[row.industry, row.stage].filter(Boolean).join(" · ")}
            </p>
            {row.location && (
              <p className="mt-0.5 text-[11px] text-slate-400">{row.location}</p>
            )}

            {/* Match reasons */}
            {row.matchReasons.length > 0 && (
              <div className="mt-3 flex-1 space-y-1.5">
                {row.matchReasons.slice(0, 2).map((reason, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-600">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    {reason}
                  </div>
                ))}
              </div>
            )}

            <p className="mt-3 text-[11px] font-semibold text-indigo-600 transition-colors group-hover:text-indigo-800">
              View report →
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
