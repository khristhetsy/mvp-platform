import { formatUsd } from "@/lib/ui/format-display";
import {
  countHighMatches,
  matchInvestorToCompany,
  rankCompaniesForInvestor,
  rankInvestorsForCompany,
  type CompanyMatchProfile,
  type InvestorMatchProfile,
} from "@/lib/matching/investor-company-matching";
import {
  loadAdminCompanyMatchProfiles,
  loadApprovedInvestorMatchProfiles,
  loadFounderCompanyMatchContext,
} from "@/lib/matching/load-matching-data";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Company } from "@/lib/supabase/types";

export type MatchingCenterPairRow = {
  investorId: string;
  investorName: string;
  investorType: string | null;
  investorGeographies: string[];
  checkSizeMin: number | null;
  checkSizeMax: number | null;
  companyId: string;
  companyName: string;
  industry: string | null;
  companyGeography: string | null;
  matchScore: number;
  matchReasons: string[];
  missingFitReasons: string[];
  publishedAt: string | null;
};

export type MatchingCenterScoreBucket = {
  id: "high" | "medium" | "low" | "minimal";
  label: string;
  count: number;
};

export type AdminMatchingCenterSnapshot = {
  stats: {
    marketplaceCompanyCount: number;
    approvedInvestorCount: number;
    totalPairs: number;
    highMatchCount: number;
    averageMatchScore: number;
  };
  scoreDistribution: MatchingCenterScoreBucket[];
  topCompanies: Array<{
    companyId: string;
    companyName: string;
    industry: string | null;
    geography: string | null;
    topMatchScore: number;
    highMatchInvestorCount: number;
  }>;
  topInvestors: Array<{
    investorId: string;
    investorName: string;
    investorType: string | null;
    topMatchScore: number;
    highMatchCompanyCount: number;
  }>;
  recentMatches: MatchingCenterPairRow[];
  pairs: MatchingCenterPairRow[];
  filterOptions: {
    industries: string[];
    investorTypes: string[];
    geographies: string[];
  };
};

export type FounderMatchingCenterRow = {
  investorId: string;
  investorName: string;
  investorType: string | null;
  preferredSectors: string[];
  geographies: string[];
  checkSizeMin: number | null;
  checkSizeMax: number | null;
  matchScore: number;
  matchReasons: string[];
  missingFitReasons: string[];
};

export type FounderMatchingCenterSnapshot = {
  companyId: string;
  companyName: string;
  industry: string | null;
  companyGeography: string | null;
  strongMatchCount: number;
  approvedInvestorCount: number;
  matches: FounderMatchingCenterRow[];
  filterOptions: {
    industries: string[];
    investorTypes: string[];
    geographies: string[];
  };
};

function isMarketplaceListed(company: CompanyMatchProfile) {
  return (
    company.reviewStatus === "approved" &&
    company.isPublished &&
    company.marketplaceVisible &&
    Boolean(company.publishedAt)
  );
}

function scoreBucket(score: number): MatchingCenterScoreBucket["id"] {
  if (score >= 70) return "high";
  if (score >= 50) return "medium";
  if (score >= 25) return "low";
  return "minimal";
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b),
  );
}

async function loadInvestorDisplayNames(investorIds: string[]) {
  if (investorIds.length === 0) {
    return new Map<string, string>();
  }

  const admin = createServiceRoleClient();
  const { data } = await admin.from("profiles").select("id, full_name, email").in("id", investorIds);

  return new Map(
    (data ?? []).map((row) => [row.id, row.full_name?.trim() || row.email?.trim() || "Platform investor"]),
  );
}

function buildPairRow(
  investor: InvestorMatchProfile,
  company: CompanyMatchProfile,
  investorName: string,
): MatchingCenterPairRow {
  const match = matchInvestorToCompany(investor, company);

  return {
    investorId: investor.profile_id,
    investorName,
    investorType: investor.investor_type ?? null,
    investorGeographies: investor.preferred_geographies ?? [],
    checkSizeMin: investor.check_size_min,
    checkSizeMax: investor.check_size_max,
    companyId: company.id,
    companyName: company.companyName,
    industry: company.industry,
    companyGeography: company.geography,
    matchScore: match.matchScore,
    matchReasons: match.matchReasons,
    missingFitReasons: match.missingFitReasons,
    publishedAt: company.publishedAt,
  };
}

export async function loadAdminMatchingCenterSnapshot(): Promise<AdminMatchingCenterSnapshot> {
  const [companies, investors] = await Promise.all([
    loadAdminCompanyMatchProfiles(),
    loadApprovedInvestorMatchProfiles(),
  ]);

  const marketplaceCompanies = companies.filter(isMarketplaceListed);
  const investorIds = investors.map((row) => row.profile_id);
  const nameById = await loadInvestorDisplayNames(investorIds);

  const pairs: MatchingCenterPairRow[] = [];

  for (const company of marketplaceCompanies) {
    for (const investor of investors) {
      pairs.push(buildPairRow(investor, company, nameById.get(investor.profile_id) ?? "Platform investor"));
    }
  }

  const scores = pairs.map((row) => row.matchScore);
  const averageMatchScore =
    scores.length > 0 ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : 0;

  const distributionCounts = { high: 0, medium: 0, low: 0, minimal: 0 };
  for (const score of scores) {
    distributionCounts[scoreBucket(score)] += 1;
  }

  const topCompanies = marketplaceCompanies
    .map((company) => {
      const ranked = rankInvestorsForCompany(company, investors, 1);
      const companyPairs = pairs.filter((row) => row.companyId === company.id);
      return {
        companyId: company.id,
        companyName: company.companyName,
        industry: company.industry,
        geography: company.geography,
        topMatchScore: ranked[0]?.match.matchScore ?? 0,
        highMatchInvestorCount: countHighMatches(
          companyPairs.map((row) => ({ companyId: row.companyId, matchScore: row.matchScore, matchReasons: row.matchReasons, missingFitReasons: row.missingFitReasons })),
          70,
        ),
      };
    })
    .sort((a, b) => b.topMatchScore - a.topMatchScore || b.highMatchInvestorCount - a.highMatchInvestorCount)
    .slice(0, 12);

  const topInvestors = investors
    .map((investor) => {
      const ranked = rankCompaniesForInvestor(investor, marketplaceCompanies, 1);
      const investorPairs = pairs.filter((row) => row.investorId === investor.profile_id);
      return {
        investorId: investor.profile_id,
        investorName: nameById.get(investor.profile_id) ?? "Platform investor",
        investorType: investor.investor_type ?? null,
        topMatchScore: ranked[0]?.match.matchScore ?? 0,
        highMatchCompanyCount: countHighMatches(
          investorPairs.map((row) => ({ companyId: row.companyId, matchScore: row.matchScore, matchReasons: row.matchReasons, missingFitReasons: row.missingFitReasons })),
          70,
        ),
      };
    })
    .sort((a, b) => b.topMatchScore - a.topMatchScore || b.highMatchCompanyCount - a.highMatchCompanyCount)
    .slice(0, 12);

  const recentMatches = [...pairs]
    .filter((row) => row.matchScore >= 50)
    .sort((a, b) => {
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bTime - aTime || b.matchScore - a.matchScore;
    })
    .slice(0, 20);

  return {
    stats: {
      marketplaceCompanyCount: marketplaceCompanies.length,
      approvedInvestorCount: investors.length,
      totalPairs: pairs.length,
      highMatchCount: countHighMatches(
        pairs.map((row) => ({ companyId: row.companyId, matchScore: row.matchScore, matchReasons: row.matchReasons, missingFitReasons: row.missingFitReasons })),
        70,
      ),
      averageMatchScore,
    },
    scoreDistribution: [
      { id: "high", label: "Strong (70%+)", count: distributionCounts.high },
      { id: "medium", label: "Moderate (50–69%)", count: distributionCounts.medium },
      { id: "low", label: "Exploratory (25–49%)", count: distributionCounts.low },
      { id: "minimal", label: "Minimal (<25%)", count: distributionCounts.minimal },
    ],
    topCompanies,
    topInvestors,
    recentMatches,
    pairs,
    filterOptions: {
      industries: uniqueSorted(pairs.map((row) => row.industry)),
      investorTypes: uniqueSorted(pairs.map((row) => row.investorType)),
      geographies: uniqueSorted([
        ...pairs.map((row) => row.companyGeography),
        ...pairs.flatMap((row) => row.investorGeographies),
      ]),
    },
  };
}

function formatCheckSize(min: number | null, max: number | null) {
  if (min == null && max == null) return "Not set";
  const fmt = (value: number) => formatUsd(value);
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
  if (min != null) return `${fmt(min)}+`;
  if (max != null) return `Up to ${fmt(max)}`;
  return "Not set";
}

export { formatCheckSize as formatMatchingCheckSize };

export async function loadFounderMatchingCenter(company: Company): Promise<FounderMatchingCenterSnapshot> {
  const [investors, fitContext] = await Promise.all([
    loadApprovedInvestorMatchProfiles(),
    loadFounderCompanyMatchContext(company),
  ]);

  const companyProfile = fitContext.companyProfile;
  const investorIds = investors.map((row) => row.profile_id);
  const nameById = await loadInvestorDisplayNames(investorIds);
  const ranked = rankInvestorsForCompany(companyProfile, investors, 100);

  const matches: FounderMatchingCenterRow[] = ranked.map((row) => ({
    investorId: row.investor.profile_id,
    investorName: nameById.get(row.investor.profile_id) ?? row.investor.investor_type ?? "Platform investor",
    investorType: row.investor.investor_type ?? null,
    preferredSectors: row.investor.preferred_sectors ?? [],
    geographies: row.investor.preferred_geographies ?? [],
    checkSizeMin: row.investor.check_size_min,
    checkSizeMax: row.investor.check_size_max,
    matchScore: row.match.matchScore,
    matchReasons: row.match.matchReasons,
    missingFitReasons: row.match.missingFitReasons,
  }));

  return {
    companyId: company.id,
    companyName: company.company_name,
    industry: companyProfile.industry,
    companyGeography: companyProfile.geography,
    strongMatchCount: fitContext.strongMatchCount,
    approvedInvestorCount: fitContext.approvedInvestorCount,
    matches,
    filterOptions: {
      industries: uniqueSorted([
        companyProfile.industry,
        ...investors.flatMap((row) => row.preferred_sectors ?? []),
      ]),
      investorTypes: uniqueSorted(matches.map((row) => row.investorType)),
      geographies: uniqueSorted(matches.flatMap((row) => row.geographies)),
    },
  };
}

export type MatchingCenterFilters = {
  industry: string;
  investorType: string;
  geography: string;
  minScore: number;
  maxScore: number;
};

export function filterMatchingCenterPairs(
  pairs: MatchingCenterPairRow[],
  filters: MatchingCenterFilters,
): MatchingCenterPairRow[] {
  return pairs.filter((row) => {
    if (filters.industry && row.industry?.toLowerCase() !== filters.industry.toLowerCase()) {
      return false;
    }
    if (filters.investorType && row.investorType?.toLowerCase() !== filters.investorType.toLowerCase()) {
      return false;
    }
    if (filters.geography) {
      const geo = filters.geography.toLowerCase();
      const companyGeo = row.companyGeography?.toLowerCase() ?? "";
      const investorGeo = row.investorGeographies.some((value) => value.toLowerCase().includes(geo));
      if (!companyGeo.includes(geo) && !investorGeo) {
        return false;
      }
    }
    if (row.matchScore < filters.minScore || row.matchScore > filters.maxScore) {
      return false;
    }
    return true;
  });
}

function investorSectorMatchesIndustry(sectors: string[], industry: string) {
  const needle = industry.trim().toLowerCase();
  if (!needle) return true;
  return sectors.some((sector) => {
    const token = sector.trim().toLowerCase();
    return token.includes(needle) || needle.includes(token);
  });
}

export function filterFounderMatchingRows(
  rows: FounderMatchingCenterRow[],
  filters: MatchingCenterFilters,
): FounderMatchingCenterRow[] {
  return rows.filter((row) => {
    if (filters.industry && !investorSectorMatchesIndustry(row.preferredSectors ?? [], filters.industry)) {
      return false;
    }
    if (filters.investorType && row.investorType?.toLowerCase() !== filters.investorType.toLowerCase()) {
      return false;
    }
    if (filters.geography) {
      const geo = filters.geography.toLowerCase();
      if (!row.geographies.some((value) => value.toLowerCase().includes(geo))) {
        return false;
      }
    }
    if (row.matchScore < filters.minScore || row.matchScore > filters.maxScore) {
      return false;
    }
    return true;
  });
}
