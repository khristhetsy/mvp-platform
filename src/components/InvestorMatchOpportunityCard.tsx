import Link from "next/link";

function scoreClass(score: number) {
  if (score >= 75) return "bg-emerald-50 text-emerald-800 ring-emerald-100";
  if (score >= 50) return "bg-amber-50 text-amber-900 ring-amber-100";
  return "bg-slate-100 text-slate-700 ring-slate-100";
}

export function InvestorMatchOpportunityCard({
  companyId,
  companyName,
  slug,
  industry,
  stage,
  location,
  fundingTarget,
  matchScore,
  matchReasons,
  missingFitReasons,
}: Readonly<{
  companyId: string;
  companyName: string;
  slug: string | null;
  industry: string | null;
  stage: string | null;
  location: string | null;
  fundingTarget: string | null;
  matchScore: number;
  matchReasons: string[];
  missingFitReasons: string[];
}>) {
  const href = slug ? `/deals/${slug}` : "/deals";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{companyName}</p>
          <p className="mt-1 text-xs text-slate-500">
            {[industry, stage, location].filter(Boolean).join(" · ") || "Marketplace listing"}
          </p>
          {fundingTarget ? <p className="mt-1 text-xs text-slate-600">Target raise: {fundingTarget}</p> : null}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${scoreClass(matchScore)}`}>
          {matchScore}% match
        </span>
      </div>

      {matchReasons.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {matchReasons.map((reason) => (
            <span
              key={reason}
              className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-800"
            >
              {reason}
            </span>
          ))}
        </div>
      ) : null}

      {missingFitReasons.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-slate-500">
          {missingFitReasons.slice(0, 2).map((reason) => (
            <li key={reason}>• {reason}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/investor/opportunities/${companyId}/report`}
          className="inline-flex min-h-11 items-center rounded-full bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500"
        >
          View report
        </Link>
        <Link
          href={href}
          className="inline-flex min-h-11 items-center rounded-full border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          View opportunity
        </Link>
      </div>
    </article>
  );
}
