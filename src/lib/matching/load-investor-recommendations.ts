import { getInvestorProfileByProfileId } from "@/lib/investor/profile";
import { loadMarketplaceCompanyMatchProfiles } from "@/lib/matching/load-matching-data";
import { rankCompaniesForInvestor } from "@/lib/matching/investor-company-matching";
import type { CompanyMatchProfile } from "@/lib/matching/investor-company-matching";
import { getInvestorMatchConfig } from "@/lib/settings/platform-settings";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function loadInvestorRecommendedMatches(
  supabase: SupabaseClient<Database>,
  investorProfileId: string,
  limit = 12,
) {
  const [investorProfile, companies, cfg] = await Promise.all([
    getInvestorProfileByProfileId(investorProfileId),
    loadMarketplaceCompanyMatchProfiles(supabase),
    getInvestorMatchConfig(),
  ]);

  if (!investorProfile) {
    return { matches: [], companies: [] as CompanyMatchProfile[] };
  }

  const ranked = rankCompaniesForInvestor(investorProfile, companies, limit, cfg.engineWeights);

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
