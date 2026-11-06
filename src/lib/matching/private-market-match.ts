import { crrScoresFor } from "@/lib/crr/crr-for";
import { getInvestorProfileByProfileId } from "@/lib/investor/profile";
import { companyToMatchProfile } from "@/lib/matching/load-matching-data";
import { matchInvestorToCompany } from "@/lib/matching/investor-company-matching";
import { getInvestorMatchConfig } from "@/lib/settings/platform-settings";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Company } from "@/lib/supabase/types";

/**
 * The signed in investor's match percent for each listed company, from the same
 * engine and admin weights as the rest of the platform. Admins and analysts have
 * no investor profile, so they get an empty map (the board shows n/a). Any
 * failure also returns an empty map: no made up percentage.
 */
export async function matchScoresForInvestor(profileId: string, companyIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (companyIds.length === 0) return out;
  try {
    const investor = await getInvestorProfileByProfileId(profileId);
    if (!investor) return out;
    const admin = createServiceRoleClient();
    const [{ data, error }, scores, cfg] = await Promise.all([
      admin.from("companies").select("*").in("id", companyIds),
      crrScoresFor(companyIds),
      getInvestorMatchConfig(),
    ]);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const profile = companyToMatchProfile(row as Company, { readinessScore: scores.get(row.id) ?? null });
      out.set(row.id, Math.round(matchInvestorToCompany(investor, profile, cfg.engineWeights).matchScore));
    }
  } catch (err) {
    console.error("[private-market] match scores failed", err);
    out.clear();
  }
  return out;
}
