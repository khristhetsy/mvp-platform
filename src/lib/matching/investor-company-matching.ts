/**
 * Investor–company match scoring (Phase 1, rules-based).
 *
 * Weights (max 100):
 * - Sector alignment: 30
 * - Stage alignment: 25
 * - Check size fit: 20
 * - Geography alignment: 15
 * - Readiness score bonus: 5 (readiness_score / 20, capped)
 * - Marketplace approved + published bonus: 5
 *
 * Sector/stage/geography use case-insensitive token overlap.
 * Check size: company target raise within investor min–max, or partial overlap.
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
>;

export type InvestorCompanyMatchResult = {
  companyId: string;
  matchScore: number;
  matchReasons: string[];
  missingFitReasons: string[];
};

const WEIGHTS = {
  sector: 30,
  stage: 25,
  checkSize: 20,
  geography: 15,
  readiness: 5,
  marketplace: 5,
} as const;

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

function scoreSector(investor: InvestorMatchProfile, company: CompanyMatchProfile) {
  const sectors = tokenizeList(investor.preferred_sectors);
  if (sectors.length === 0) {
    return { points: 0, matched: false, reason: null, missing: "Investor sector preferences not set" };
  }

  if (tokensOverlap(sectors, company.industry)) {
    return { points: WEIGHTS.sector, matched: true, reason: "Sector alignment", missing: null };
  }

  return {
    points: 0,
    matched: false,
    reason: null,
    missing: "Sector not in investor preferences",
  };
}

function scoreStage(investor: InvestorMatchProfile, company: CompanyMatchProfile) {
  const stages = tokenizeList(investor.preferred_stages);
  if (stages.length === 0) {
    return { points: 0, matched: false, reason: null, missing: "Investor stage preferences not set" };
  }

  if (tokensOverlap(stages, company.stage)) {
    return { points: WEIGHTS.stage, matched: true, reason: "Stage alignment", missing: null };
  }

  return {
    points: 0,
    matched: false,
    reason: null,
    missing: "Funding stage outside investor preferences",
  };
}

function scoreGeography(investor: InvestorMatchProfile, company: CompanyMatchProfile) {
  const geos = tokenizeList(investor.preferred_geographies);
  if (geos.length === 0) {
    return { points: 0, matched: false, reason: null, missing: "Investor geography preferences not set" };
  }

  if (tokensOverlap(geos, company.geography)) {
    return { points: WEIGHTS.geography, matched: true, reason: "Geography alignment", missing: null };
  }

  return {
    points: 0,
    matched: false,
    reason: null,
    missing: "Geography outside investor preferences",
  };
}

function scoreCheckSize(investor: InvestorMatchProfile, company: CompanyMatchProfile) {
  const min = investor.check_size_min;
  const max = investor.check_size_max;
  const target = company.fundingAmount;

  if (min == null && max == null) {
    return { points: 0, matched: false, reason: null, missing: "Investor check size range not set" };
  }

  if (target == null || target <= 0) {
    return { points: 0, matched: false, reason: null, missing: "Company target raise not set" };
  }

  const lower = min ?? 0;
  const upper = max ?? Number.MAX_SAFE_INTEGER;

  if (target >= lower && target <= upper) {
    return { points: WEIGHTS.checkSize, matched: true, reason: "Check size fit", missing: null };
  }

  const nearLower = target >= lower * 0.5 && target < lower;
  const nearUpper = target > upper && target <= upper * 1.5;

  if (nearLower || nearUpper) {
    return {
      points: Math.round(WEIGHTS.checkSize * 0.5),
      matched: true,
      reason: "Partial check size overlap",
      missing: null,
    };
  }

  return {
    points: 0,
    matched: false,
    reason: null,
    missing: "Target raise outside investor check size range",
  };
}

function scoreReadiness(company: CompanyMatchProfile) {
  const score = company.readinessScore ?? 0;
  if (score <= 0) {
    return { points: 0, reason: null };
  }

  const points = Math.min(WEIGHTS.readiness, Math.round(score / 20));
  return { points, reason: points > 0 ? "Readiness score bonus" : null };
}

function scoreMarketplace(company: CompanyMatchProfile) {
  const listed =
    company.reviewStatus === "approved" &&
    company.isPublished &&
    company.marketplaceVisible &&
    Boolean(company.publishedAt);

  if (!listed) {
    return { points: 0, reason: null, missing: "Not yet published on marketplace" };
  }

  return { points: WEIGHTS.marketplace, reason: "Marketplace listed", missing: null };
}

export function matchInvestorToCompany(
  investor: InvestorMatchProfile,
  company: CompanyMatchProfile,
): InvestorCompanyMatchResult {
  if (investor.approval_status !== "approved") {
    return {
      companyId: company.id,
      matchScore: 0,
      matchReasons: [],
      missingFitReasons: ["Investor account not approved for matching"],
    };
  }

  const sector = scoreSector(investor, company);
  const stage = scoreStage(investor, company);
  const geography = scoreGeography(investor, company);
  const checkSize = scoreCheckSize(investor, company);
  const readiness = scoreReadiness(company);
  const marketplace = scoreMarketplace(company);

  const matchReasons = [sector, stage, geography, checkSize, readiness, marketplace]
    .map((item) => item.reason)
    .filter((value): value is string => Boolean(value));

  const missingFitReasons = [sector, stage, geography, checkSize, marketplace]
    .map((item) => item.missing)
    .filter((value): value is string => Boolean(value));

  const rawScore =
    sector.points +
    stage.points +
    geography.points +
    checkSize.points +
    readiness.points +
    marketplace.points;

  return {
    companyId: company.id,
    matchScore: Math.min(100, Math.max(0, rawScore)),
    matchReasons,
    missingFitReasons,
  };
}

export function rankCompaniesForInvestor(
  investor: InvestorMatchProfile,
  companies: CompanyMatchProfile[],
  limit = 12,
) {
  return companies
    .map((company) => ({ company, match: matchInvestorToCompany(investor, company) }))
    .sort((a, b) => b.match.matchScore - a.match.matchScore)
    .slice(0, limit);
}

export function rankInvestorsForCompany(
  company: CompanyMatchProfile,
  investors: InvestorMatchProfile[],
  limit = 10,
) {
  return investors
    .filter((investor) => investor.approval_status === "approved")
    .map((investor) => ({ investor, match: matchInvestorToCompany(investor, company) }))
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
      `${input.strongMatchCount} approved investor${input.strongMatchCount === 1 ? "" : "s"} show strong CapitalOS match signals for your profile.`,
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
