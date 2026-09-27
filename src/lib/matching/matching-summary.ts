/** What the pass did, for the Last result column on Scheduled jobs. */
export function matchingSummary(pass: { companiesEligible: number; investorsConsidered: number; suggestedWritten: number }): string {
  if (pass.companiesEligible === 0) return "0 matches: no company at CRR 60 or above";
  if (pass.investorsConsidered === 0) return "0 matches: no approved investors";
  if (pass.suggestedWritten === 0) return `0 new matches from ${pass.companiesEligible} companies and ${pass.investorsConsidered} investors`;
  return `${pass.suggestedWritten} new match${pass.suggestedWritten === 1 ? "" : "es"}`;
}
