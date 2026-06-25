function scoreClass(score: number) {
  if (score >= 75) return "bg-emerald-50 text-emerald-800 ring-emerald-100";
  if (score >= 50) return "bg-amber-50 text-amber-900 ring-amber-100";
  return "bg-slate-100 text-slate-700 ring-slate-100";
}

export function FounderInvestorMatchCard({
  investorId,
  investorName,
  investorType,
  geographies,
  checkSizeLabel,
  matchScore,
  matchReasons,
  missingFitReasons,
  onClick,
}: Readonly<{
  investorId: string;
  investorName: string;
  investorType: string | null;
  geographies: string[];
  checkSizeLabel: string;
  matchScore: number;
  matchReasons: string[];
  missingFitReasons: string[];
  onClick?: () => void;
}>) {
  const inner = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{investorName}</p>
          <p className="mt-1 text-xs text-slate-500">
            {[investorType, geographies.slice(0, 3).join(", ")].filter(Boolean).join(" · ") || "Platform investor"}
          </p>
          <p className="mt-1 text-xs text-slate-600">Check size: {checkSizeLabel}</p>
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
          {missingFitReasons.slice(0, 3).map((reason) => (
            <li key={reason}>• {reason}</li>
          ))}
        </ul>
      ) : null}

      {onClick && (
        <p className="mt-4 text-[10px] font-semibold text-indigo-400 opacity-0 transition group-hover:opacity-100">
          View details →
        </p>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        data-investor-id={investorId}
        onClick={onClick}
        className="group w-full text-left rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-[0.99]"
      >
        {inner}
      </button>
    );
  }

  return (
    <article data-investor-id={investorId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {inner}
    </article>
  );
}
