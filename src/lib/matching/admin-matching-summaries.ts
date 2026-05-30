import {
  countHighMatches,
  rankInvestorsForCompany,
  matchInvestorToCompany,
  type CompanyMatchProfile,
} from "@/lib/matching/investor-company-matching";
import { loadAdminCompanyMatchProfiles, loadApprovedInvestorMatchProfiles } from "@/lib/matching/load-matching-data";

export type CompanyMatchingSummary = {
  highMatchInvestorCount: number;
  topMatchScore: number;
};

export type InvestorMatchingSummary = {
  highMatchCompanyCount: number;
  topMatchScore: number;
};

export async function getCompanyMatchingSummaries(companyIds: string[]) {
  const map = new Map<string, CompanyMatchingSummary>();

  if (companyIds.length === 0) {
    return map;
  }

  const [companies, investors] = await Promise.all([
    loadAdminCompanyMatchProfiles(),
    loadApprovedInvestorMatchProfiles(),
  ]);

  const companyMap = new Map(companies.map((company) => [company.id, company]));

  for (const companyId of companyIds) {
    const company = companyMap.get(companyId);
    if (!company) {
      map.set(companyId, { highMatchInvestorCount: 0, topMatchScore: 0 });
      continue;
    }

    const ranked = rankInvestorsForCompany(company, investors, 50);
    const scores = ranked.map((row) => row.match);

    map.set(companyId, {
      highMatchInvestorCount: countHighMatches(scores, 70),
      topMatchScore: scores[0]?.matchScore ?? 0,
    });
  }

  return map;
}

export async function getInvestorMatchingSummaries(profileIds: string[]) {
  const map = new Map<string, InvestorMatchingSummary>();

  if (profileIds.length === 0) {
    return map;
  }

  const [companies, investors] = await Promise.all([
    loadAdminCompanyMatchProfiles(),
    loadApprovedInvestorMatchProfiles(),
  ]);

  const marketplaceCompanies = companies.filter(
    (company) =>
      company.reviewStatus === "approved" &&
      company.isPublished &&
      company.marketplaceVisible &&
      Boolean(company.publishedAt),
  );

  for (const profileId of profileIds) {
    const investor = investors.find((row) => row.profile_id === profileId);
    if (!investor) {
      map.set(profileId, { highMatchCompanyCount: 0, topMatchScore: 0 });
      continue;
    }

    const scores = marketplaceCompanies.map((company) => matchInvestorToCompany(investor, company));

    map.set(profileId, {
      highMatchCompanyCount: countHighMatches(scores, 70),
      topMatchScore: Math.max(0, ...scores.map((row) => row.matchScore)),
    });
  }

  return map;
}
