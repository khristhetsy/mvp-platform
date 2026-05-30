import { getInvestorProfileByProfileId } from "@/lib/investor/profile";
import { loadMarketplaceCompanyMatchProfiles } from "@/lib/matching/load-matching-data";
import { rankCompaniesForInvestor } from "@/lib/matching/investor-company-matching";
import type { CompanyMatchProfile } from "@/lib/matching/investor-company-matching";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function loadInvestorRecommendedMatches(
  supabase: SupabaseClient<Database>,
  investorProfileId: string,
  limit = 12,
) {
  const [investorProfile, companies] = await Promise.all([
    getInvestorProfileByProfileId(investorProfileId),
    loadMarketplaceCompanyMatchProfiles(supabase),
  ]);

  if (!investorProfile) {
    return { matches: [], companies: [] as CompanyMatchProfile[] };
  }

  const ranked = rankCompaniesForInvestor(investorProfile, companies, limit);

  return {
    investorProfile,
    matches: ranked.map((row) => ({
      company: row.company,
      matchScore: row.match.matchScore,
      matchReasons: row.match.matchReasons,
      missingFitReasons: row.match.missingFitReasons,
    })),
  };
}
