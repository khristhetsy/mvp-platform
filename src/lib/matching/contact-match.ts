import type { ScoredInvestorContact } from "@/lib/investors/load-investor-matches";
import { parseMoneyBand } from "@/lib/investors/preference-match";
import { activeRatingScore } from "@/lib/investors/preferences";
import { splitProfileCsv } from "@/lib/profile/options";
import {
  matchInvestorToCompany,
  type CompanyMatchProfile,
  type InvestorMatchProfile,
  type InvestorCompanyMatchResult,
  type EngineWeights,
} from "@/lib/matching/investor-company-matching";

/**
 * Bridges a CRM investor contact (from the Odoo mirror) into the additive
 * `matchInvestorToCompany` engine, so the founder board and the outreach
 * enrollment score investors the exact same way (sector + stage + check size +
 * geography + marketplace), instead of the old preference-ratio scorer.
 */

/** Build a CompanyMatchProfile from the founder's company columns. */
export function buildCompanyMatchProfile(company: {
  id: string;
  company_name?: string | null;
  slug?: string | null;
  industry?: string | null;
  revenue_stage?: string | null;
  funding_stage?: string | null;
  operating_stage?: string | null;
  seeking_investor_types?: string | null;
  seeking_capital_types?: string | null;
  state?: string | null;
  country?: string | null;
  funding_amount?: number | null;
  review_status?: string | null;
  is_published?: boolean | null;
  marketplace_visible?: boolean | null;
  published_at?: string | null;
  readinessScore?: number | null;
  /** Founder's actual ARR / MRR, USD (option B — from the CRM contact). */
  arr?: number | null;
  mrr?: number | null;
}): CompanyMatchProfile {
  // Funding stage + operating stage + revenue stage all feed the stage factor.
  const stageParts = [company.funding_stage, company.operating_stage, company.revenue_stage]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  const soughtInvestorTypes = splitProfileCsv(company.seeking_investor_types);
  const soughtCapitalTypes = splitProfileCsv(company.seeking_capital_types);
  return {
    id: company.id,
    companyName: company.company_name ?? "",
    slug: company.slug ?? null,
    industry: company.industry ?? null,
    stage: stageParts.length ? stageParts.join(", ") : (company.revenue_stage ?? null),
    geography: [company.state, company.country].filter(Boolean).join(", ") || null,
    fundingAmount: company.funding_amount ?? null,
    readinessScore: company.readinessScore ?? null,
    onboardingPercent: 100,
    reviewStatus: company.review_status ?? null,
    isPublished: Boolean(company.is_published),
    marketplaceVisible: Boolean(company.marketplace_visible),
    publishedAt: company.published_at ?? null,
    arr: company.arr ?? null,
    mrr: company.mrr ?? null,
    ...(soughtInvestorTypes.length ? { soughtInvestorTypes } : {}),
    ...(soughtCapitalTypes.length ? { soughtCapitalTypes } : {}),
  };
}

/** Map a CRM investor contact into the match-engine's investor shape. */
export function investorProfileFromContact(s: ScoredInvestorContact): InvestorMatchProfile {
  const band = s.preferences.investmentSize[0] ? parseMoneyBand(s.preferences.investmentSize[0]) : null;
  return {
    profile_id: s.id,
    investor_type: s.investorType,
    check_size_min: band ? band.min : null,
    check_size_max: band && Number.isFinite(band.max) ? band.max : null,
    preferred_sectors: s.sectors,
    preferred_geographies: [],
    preferred_stages: s.preferences.useOfFunds,
    preferred_arr_range: s.preferences.arrRange[0] ?? null,
    preferred_mrr_range: s.preferences.mrrRange[0] ?? null,
    approval_status: "approved",
    capitalTypes: s.capitalTypes,
    activeRating: activeRatingScore(s.preferences),
  };
}

/** Score one contact against a company profile with the additive engine. */
export function scoreContactAgainstCompany(
  s: ScoredInvestorContact,
  company: CompanyMatchProfile,
  weights?: EngineWeights,
): InvestorCompanyMatchResult {
  return matchInvestorToCompany(investorProfileFromContact(s), company, weights);
}
