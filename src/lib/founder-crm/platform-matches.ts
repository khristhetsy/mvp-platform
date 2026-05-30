import {
  companyToMatchProfile,
  loadApprovedInvestorMatchProfiles,
} from "@/lib/matching/load-matching-data";
import { rankInvestorsForCompany } from "@/lib/matching/investor-company-matching";
import type { Company } from "@/lib/supabase/types";

export async function loadFounderPlatformInvestorMatches(company: Company, limit = 8) {
  const investors = await loadApprovedInvestorMatchProfiles();
  const companyProfile = companyToMatchProfile(company);
  const ranked = rankInvestorsForCompany(companyProfile, investors, limit);

  return ranked.map((row) => ({
    platformInvestorId: row.investor.profile_id,
    matchScore: row.match.matchScore,
    matchReasons: row.match.matchReasons,
    label: row.investor.investor_type ?? "Platform investor",
  }));
}
