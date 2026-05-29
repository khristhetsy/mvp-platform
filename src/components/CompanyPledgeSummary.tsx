import {
  formatPledgeTotal,
  type CompanyPledgeSummary,
} from "@/lib/data/investor-pledges";

export function CompanyPledgeSummaryBlock({
  summary,
  compact = false,
}: Readonly<{ summary: CompanyPledgeSummary; compact?: boolean }>) {
  const investorLabel = summary.investorCount === 1 ? "investor" : "investors";

  if (compact) {
    return (
      <div className="rounded-2xl bg-slate-50 p-4" data-testid="company-pledge-summary">
        <p className="text-xs font-medium text-slate-500">Investor pledges</p>
        <p className="mt-1 text-sm font-semibold text-slate-950">
          Total pledged: {formatPledgeTotal(summary.totalPledged, summary.currency)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          From {summary.investorCount} {investorLabel}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="company-pledge-summary">
      <h2 className="text-lg font-semibold text-slate-950">Investor pledges</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Total pledged</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">
            {formatPledgeTotal(summary.totalPledged, summary.currency)}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">From investors</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">
            From {summary.investorCount} {investorLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
