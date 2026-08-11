/**
 * Investor–company match scoring (Phase 1, rules-based).
 *
 * The score is PURE investor↔company fit — a percentage over only the factors
 * that could be evaluated (both sides had data). Admin-tunable factors:
 * - Sector alignment
 * - Stage alignment
 * - Check size fit (partial credit for a near-miss)
 * - Geography alignment
 * - Investor type / Capital type match (vs the founder's "seeking")
 * - Active-investor signal
 *
 * No company-state bonuses (readiness score, marketplace listing) — those are not
 * part of matching, so they never inflate the score. Sector/stage/geography use
 * case-insensitive token overlap.
 */

import type { InvestorProfileRecord } from "@/lib/investor/types";

export type CompanyMatchProfile = {
  id: string;
  companyName: string;
  slug: string | null;
  industry: string | null;
  stage: string | null;
  geography: string | null;
  fundingAmount: number | null;
  readinessScore: number | null;
  onboardingPercent: number;
  reviewStatus: string | null;
  isPublished: boolean;
  marketplaceVisible: boolean;
  publishedAt: string | null;
  /** Founder's sought investor types / capital types (from Seeking). Optional —
   *  absent means the factor simply drops out of the score. */
  soughtInvestorTypes?: string[];
  soughtCapitalTypes?: string[];
};

export type InvestorMatchProfile = Pick<
  InvestorProfileRecord,
  | "profile_id"
  | "investor_type"
  | "check_size_min"
  | "check_size_max"
  | "preferred_sectors"
  | "preferred_geographies"
  | "preferred_stages"
  | "approval_status"
> & {
  /** Extras for the added factors (absent for platform investors → factor drops out). */
  capitalTypes?: string[];
  activeRating?: number | null;
};

export type InvestorCompanyMatchResult = {
  companyId: string;
  matchScore: number;
  matchReasons: string[];
  missingFitReasons: string[];
};

/** Admin-tunable weights for the four investor-fit factors. Readiness and
 *  marketplace are small fixed bonuses, not tunable. */
export type EngineWeights = {
  sector: number;
  stage: number;
  checkSize: number;
  geography: number;
  investorType: number;
  capitalType: number;
  activeRating: number;
};
export const DEFAULT_ENGINE_WEIGHTS: EngineWeights = {
  sector: 25,
  stage: 20,
  checkSize: 15,
  geography: 10,
  investorType: 10,
  capitalType: 10,
  activeRating: 10,
};

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

function tokenizeList(values: string[]) {
  return values.flatMap((value) =>
    normalizeToken(value)
      .split(/[,;/|]+/)
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

function tokensOverlap(needles: string[], haystack: string | null) {
  if (!haystack?.trim() || needles.length === 0) {
    return false;
  }

  const hay = normalizeToken(haystack);
  return needles.some((needle) => hay.includes(needle) || needle.includes(hay));
}

/** A single factor's outcome. `evaluated` = both sides had data, so it counts
 *  toward the denominator; when false the factor drops out entirely (no penalty). */
type FactorResult = { points: number; weight: number; evaluated: boolean; reason: string | null; missing: string | null };

function scoreSector(investor: InvestorMatchProfile, company: CompanyMatchProfile, weight: number): FactorResult {
  const sectors = tokenizeList(investor.preferred_sectors);
  if (sectors.length === 0 || !company.industry?.trim()) {
    return { points: 0, weight, evaluated: false, reason: null, missing: sectors.length === 0 ? "Investor sector preferences not set" : null };
  }
  if (tokensOverlap(sectors, company.industry)) {
    return { points: weight, weight, evaluated: true, reason: "Sector alignment", missing: null };
  }
  return { points: 0, weight, evaluated: true, reason: null, missing: "Sector not in investor preferences" };
}

function scoreStage(investor: InvestorMatchProfile, company: CompanyMatchProfile, weight: number): FactorResult {
  const stages = tokenizeList(investor.preferred_stages);
  if (stages.length === 0 || !company.stage?.trim()) {
    return { points: 0, weight, evaluated: false, reason: null, missing: null };
  }
  if (tokensOverlap(stages, company.stage)) {
    return { points: weight, weight, evaluated: true, reason: "Stage alignment", missing: null };
  }
  return { points: 0, weight, evaluated: true, reason: null, missing: "Funding stage outside investor preferences" };
}

function scoreGeography(investor: InvestorMatchProfile, company: CompanyMatchProfile, weight: number): FactorResult {
  const geos = tokenizeList(investor.preferred_geographies);
  if (geos.length === 0 || !company.geography?.trim()) {
    return { points: 0, weight, evaluated: false, reason: null, missing: null };
  }
  if (tokensOverlap(geos, company.geography)) {
    return { points: weight, weight, evaluated: true, reason: "Geography alignment", missing: null };
  }
  return { points: 0, weight, evaluated: true, reason: null, missing: "Geography outside investor preferences" };
}

function scoreCheckSize(investor: InvestorMatchProfile, company: CompanyMatchProfile, weight: number): FactorResult {
  const min = investor.check_size_min;
  const max = investor.check_size_max;
  const target = company.fundingAmount;
  if ((min == null && max == null) || target == null || target <= 0) {
    return { points: 0, weight, evaluated: false, reason: null, missing: null };
  }
  const lower = min ?? 0;
  const upper = max ?? Number.MAX_SAFE_INTEGER;
  if (target >= lower && target <= upper) {
    return { points: weight, weight, evaluated: true, reason: "Check size fit", missing: null };
  }
  const nearLower = target >= lower * 0.5 && target < lower;
  const nearUpper = target > upper && target <= upper * 1.5;
  if (nearLower || nearUpper) {
    return { points: Math.round(weight * 0.5), weight, evaluated: true, reason: "Partial check size overlap", missing: null };
  }
  return { points: 0, weight, evaluated: true, reason: null, missing: "Target raise outside investor check size range" };
}

function listsOverlap(a: string[], b: string[]): boolean {
  return a.some((x) => b.some((y) => x.includes(y) || y.includes(x)));
}

function scoreInvestorType(investor: InvestorMatchProfile, company: CompanyMatchProfile, weight: number): FactorResult {
  const sought = tokenizeList(company.soughtInvestorTypes ?? []);
  if (sought.length === 0 || !investor.investor_type?.trim()) {
    return { points: 0, weight, evaluated: false, reason: null, missing: null };
  }
  if (tokensOverlap(sought, investor.investor_type)) {
    return { points: weight, weight, evaluated: true, reason: "Investor type match", missing: null };
  }
  return { points: 0, weight, evaluated: true, reason: null, missing: "Investor type not among those sought" };
}

function scoreCapitalType(investor: InvestorMatchProfile, company: CompanyMatchProfile, weight: number): FactorResult {
  const sought = tokenizeList(company.soughtCapitalTypes ?? []);
  const offered = tokenizeList(investor.capitalTypes ?? []);
  if (sought.length === 0 || offered.length === 0) {
    return { points: 0, weight, evaluated: false, reason: null, missing: null };
  }
  if (listsOverlap(sought, offered)) {
    return { points: weight, weight, evaluated: true, reason: "Capital type match", missing: null };
  }
  return { points: 0, weight, evaluated: true, reason: null, missing: "Capital type not offered" };
}

function scoreActiveRating(investor: InvestorMatchProfile, weight: number): FactorResult {
  const rating = investor.activeRating;
  if (rating == null || rating <= 0) {
    return { points: 0, weight, evaluated: false, reason: null, missing: null };
  }
  const fit = Math.min(1, rating / 5);
  return { points: Math.round(weight * fit), weight, evaluated: true, reason: rating >= 4 ? "Highly active investor" : null, missing: null };
}

export function matchInvestorToCompany(
  investor: InvestorMatchProfile,
  company: CompanyMatchProfile,
  weights: EngineWeights = DEFAULT_ENGINE_WEIGHTS,
): InvestorCompanyMatchResult {
  if (investor.approval_status !== "approved") {
    return {
      companyId: company.id,
      matchScore: 0,
      matchReasons: [],
      missingFitReasons: ["Investor account not approved for matching"],
    };
  }

  const sector = scoreSector(investor, company, weights.sector);
  const stage = scoreStage(investor, company, weights.stage);
  const geography = scoreGeography(investor, company, weights.geography);
  const checkSize = scoreCheckSize(investor, company, weights.checkSize);
  const investorType = scoreInvestorType(investor, company, weights.investorType);
  const capitalType = scoreCapitalType(investor, company, weights.capitalType);
  const activeRating = scoreActiveRating(investor, weights.activeRating);

  // Normalize over ONLY the factors we could actually evaluate. A blank field
  // (no investor preference, or no company value) drops out of the denominator
  // instead of costing points — missing data never penalizes the founder. A
  // field that IS set but doesn't fit still counts as a real 0.
  const factors = [sector, stage, geography, checkSize, investorType, capitalType, activeRating];
  let earned = 0;
  let possible = 0;
  for (const f of factors) {
    if (f.evaluated) {
      earned += f.points;
      possible += f.weight;
    }
  }

  const base = possible > 0 ? (earned / possible) * 100 : 0;
  const matchScore = Math.max(0, Math.round(base));

  const matchReasons = factors
    .map((item) => item.reason)
    .filter((value): value is string => Boolean(value));

  const missingFitReasons = factors
    .map((item) => item.missing)
    .filter((value): value is string => Boolean(value));

  return {
    companyId: company.id,
    matchScore,
    matchReasons,
    missingFitReasons,
  };
}

export function rankCompaniesForInvestor(
  investor: InvestorMatchProfile,
  companies: CompanyMatchProfile[],
  limit = 12,
  weights?: EngineWeights,
) {
  return companies
    .map((company) => ({ company, match: matchInvestorToCompany(investor, company, weights) }))
    .sort((a, b) => b.match.matchScore - a.match.matchScore)
    .slice(0, limit);
}

export function rankInvestorsForCompany(
  company: CompanyMatchProfile,
  investors: InvestorMatchProfile[],
  limit = 10,
  weights?: EngineWeights,
) {
  return investors
    .filter((investor) => investor.approval_status === "approved")
    .map((investor) => ({ investor, match: matchInvestorToCompany(investor, company, weights) }))
    .sort((a, b) => b.match.matchScore - a.match.matchScore)
    .slice(0, limit);
}

export function countHighMatches(matches: InvestorCompanyMatchResult[], threshold = 70) {
  return matches.filter((match) => match.matchScore >= threshold).length;
}

/** Opaque founder-facing signals — no investor preference details. */
export function buildFounderInvestorFitSignals(input: {
  company: CompanyMatchProfile;
  approvedInvestorMatchCount: number;
  strongMatchCount: number;
}) {
  const signals: string[] = [];

  if (input.company.isPublished && input.company.marketplaceVisible) {
    signals.push("Your company is visible on the marketplace, which improves investor discovery.");
  } else if (input.company.reviewStatus === "approved") {
    signals.push("Admin approval is complete — publish to marketplace to improve investor visibility.");
  }

  if ((input.company.readinessScore ?? 0) >= 75) {
    signals.push("Readiness score is in a strong range for institutional investor review.");
  } else if ((input.company.readinessScore ?? 0) >= 50) {
    signals.push("Improving readiness materials can increase investor engagement.");
  }

  if (input.strongMatchCount > 0) {
    signals.push(
      `${input.strongMatchCount} approved investor${input.strongMatchCount === 1 ? "" : "s"} show strong iCapOS match signals for your profile.`,
    );
  } else if (input.approvedInvestorMatchCount > 0) {
    signals.push(
      `${input.approvedInvestorMatchCount} approved investor${input.approvedInvestorMatchCount === 1 ? "" : "s"} may review opportunities like yours as matching improves.`,
    );
  }

  if (input.company.onboardingPercent < 100) {
    signals.push("Completing onboarding strengthens investor-facing profile completeness.");
  }

  return signals;
}
