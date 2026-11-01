/**
 * Old versus new top investors for one founder, so the match prefilter can be checked on
 * real data before the `match_prefilter` setting is turned on.
 *
 * "Old" is what the board does today: read up to 3,000 contacts, score them all, keep the
 * top N. "New" reads the short list from the match index, then scores it with the same
 * engine and the same admin weights. Nothing here writes anything.
 */
import { loadInvestorContacts, type ScoredInvestorContact } from "@/lib/investors/load-investor-matches";
import { buildCompanyMatchProfile, scoreContactAgainstCompany } from "@/lib/matching/contact-match";
import { founderIndustries, loadPrefilteredInvestors } from "./candidate-investors";

type CompanyInput = Parameters<typeof buildCompanyMatchProfile>[0];
type Weights = Parameters<typeof scoreContactAgainstCompany>[2];

export type Overlap = { shared: number; of: number; pct: number | null };

/** How many of the old top ids the new list also has. pct is shared / of, one decimal. */
export function overlapStats(oldIds: readonly string[], newIds: readonly string[]): Overlap {
  const old = new Set(oldIds);
  const shared = newIds.filter((id) => old.has(id)).length;
  return { shared, of: oldIds.length, pct: oldIds.length ? Math.round((shared / oldIds.length) * 1000) / 10 : null };
}

type Ranked = { id: string; score: number };

/** Highest score first; equal scores by id so a rerun gives the same list. */
export function topRanked(items: readonly Ranked[], n: number): Ranked[] {
  return [...items].sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1)).slice(0, n);
}

function stats(list: Ranked[]) {
  if (list.length === 0) return { avg: null as number | null, min: null as number | null };
  const total = list.reduce((sum, r) => sum + r.score, 0);
  return { avg: Math.round((total / list.length) * 10) / 10, min: list[list.length - 1].score };
}

export type FounderComparison = {
  companyId: string;
  companyName: string | null;
  industry: string | null;
  canonicalIndustries: string[];
  /** True when the short list could not fill the board, so the live board would use the old read. */
  fellBack: boolean;
  oldMs: number;
  newMs: number;
  newCandidates: number | null;
  overlap: Overlap | null;
  oldAvgScore: number | null;
  newAvgScore: number | null;
  oldMinScore: number | null;
  newMinScore: number | null;
};

function scoreAll(rows: ScoredInvestorContact[], company: CompanyInput, weights: Weights): Ranked[] {
  const profile = buildCompanyMatchProfile(company);
  return rows.map((s) => ({ id: s.id, score: scoreContactAgainstCompany(s, profile, weights).matchScore }));
}

export async function compareFounder(company: CompanyInput & { industry?: string | null }, weights: Weights, want = 50): Promise<FounderComparison> {
  const scoreAgainst = {
    fundingAmount: company.funding_amount ?? null,
    revenue: null,
    revenueStage: company.revenue_stage ?? null,
    useOfFunds: (company as { use_of_funds?: string | null }).use_of_funds ?? null,
    industry: company.industry ?? null,
  };

  const t0 = Date.now();
  const oldRows = await loadInvestorContacts({ scoreAgainst, investorsOnly: true, requireIndustryMatch: false, score: false, limit: 3000 });
  const oldTop = topRanked(scoreAll(oldRows, company, weights), want);
  const oldMs = Date.now() - t0;

  const t1 = Date.now();
  const newRows = await loadPrefilteredInvestors({ industry: company.industry ?? null, scoreAgainst, want, force: true });
  const newTop = newRows ? topRanked(scoreAll(newRows, company, weights), want) : [];
  const newMs = Date.now() - t1;

  const o = stats(oldTop);
  const n = stats(newTop);
  return {
    companyId: company.id,
    companyName: company.company_name ?? null,
    industry: company.industry ?? null,
    canonicalIndustries: founderIndustries(company.industry),
    fellBack: newRows === null,
    oldMs,
    newMs,
    newCandidates: newRows ? newRows.length : null,
    overlap: newRows ? overlapStats(oldTop.map((r) => r.id), newTop.map((r) => r.id)) : null,
    oldAvgScore: o.avg,
    newAvgScore: newRows ? n.avg : null,
    oldMinScore: o.min,
    newMinScore: newRows ? n.min : null,
  };
}

export function summarize(rows: readonly FounderComparison[]) {
  const compared = rows.filter((r) => r.overlap && r.overlap.pct !== null);
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  return {
    founders: rows.length,
    fellBack: rows.filter((r) => r.fellBack).length,
    compared: compared.length,
    avgOverlapPct: avg(compared.map((r) => r.overlap!.pct!)),
    lowestOverlapPct: compared.length ? Math.min(...compared.map((r) => r.overlap!.pct!)) : null,
    avgOldMs: avg(rows.map((r) => r.oldMs)),
    avgNewMs: avg(compared.map((r) => r.newMs)),
  };
}
