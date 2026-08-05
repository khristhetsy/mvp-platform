// Shared anonymized match-card list for the founder + investor Matching Centers.
// Identity is withheld; only fit score, coarse descriptors, and reason chips show.
export type MatchCenterCard = {
  matchScore: number;
  tag: string;
  title: string;
  subtitle: string | null;
  reasons: string[];
};

function barColor(score: number): string {
  if (score >= 70) return "#17a06a";
  if (score >= 45) return "#5b8def";
  return "#cbd5e1";
}

export function MatchingCenterList({
  cards,
  emptyText,
}: {
  cards: MatchCenterCard[];
  emptyText: string;
}) {
  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-slate-500">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cards.map((c, i) => (
        <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                {c.matchScore}% match
              </span>
              <p className="mt-2 truncate text-sm font-semibold text-slate-900">{c.title}</p>
              {c.subtitle && <p className="text-xs text-slate-500">{c.subtitle}</p>}
            </div>
            <span className="flex-none rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
              {c.tag}
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${Math.max(c.matchScore, 3)}%`, background: barColor(c.matchScore) }} />
          </div>

          {c.reasons.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.reasons.map((r) => (
                <span key={r} className="rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] text-slate-600">
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
