// Founder-facing Matching Center: rank investor contacts (registered members +
// internal CRM prospects) against the founder's company, anonymized. Mirrors the
// admin center (matching-center.ts) but scoped to one company and identity-safe.
import type { Company } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { companyToMatchProfile, loadApprovedInvestorMatchProfiles } from "@/lib/matching/load-matching-data";
import { loadProspectInvestorMatchProfiles, isProspectInvestorId } from "@/lib/matching/prospect-investors";
import { rankInvestorsForCompany } from "@/lib/matching/investor-company-matching";
import { getInvestorMatchConfig } from "@/lib/settings/platform-settings";

export type FounderInvestorMatchCard = {
  matchScore: number;
  isProspect: boolean;
  investorType: string | null;
  checkBand: string | null;
  reasons: string[];
  /** Opaque reference (investor/prospect id) — sent back on an intro request,
   *  never shown to the founder, so identity stays private. */
  ref: string;
  /** Detail-panel inputs (fit breakdown + criteria) for the click-to-open modal. */
  fitSector: number;
  fitStage: number;
  fitCheck: number;
  fitGeo: number;
  sectors: string[];
  capitalTypes: string[];
  stages: string[];
  geographies: string[];
};

export type FounderMatchingCenter = {
  cards: FounderInvestorMatchCard[];
  total: number;
  strong: number;
};

function usdShort(n: number): string {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` : `$${Math.round(n / 1_000)}K`;
}
function checkBand(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${usdShort(min)} – ${usdShort(max)}`;
  if (min != null) return `${usdShort(min)}+`;
  return `up to ${usdShort(max as number)}`;
}

async function latestReadiness(companyId: string): Promise<number | null> {
  try {
    const admin = createServiceRoleClient();
    const { data } = await admin
      .from("company_readiness_scores")
      .select("total_score")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as { total_score?: number | null } | null)?.total_score ?? null;
  } catch {
    return null;
  }
}

export async function loadFounderMatchingCenter(company: Company, limit = 25): Promise<FounderMatchingCenter> {
  const readinessScore = await latestReadiness(company.id);
  const profile = companyToMatchProfile(company, { readinessScore });

  const [members, prospects, cfg] = await Promise.all([
    loadApprovedInvestorMatchProfiles(),
    loadProspectInvestorMatchProfiles(),
    getInvestorMatchConfig(),
  ]);

  const investors = [...members, ...prospects.profiles];
  const ranked = rankInvestorsForCompany(profile, investors, limit, cfg.engineWeights);

  const cards: FounderInvestorMatchCard[] = ranked.map(({ investor, match }) => {
    const has = (re: RegExp) => match.matchReasons.some((x) => re.test(x));
    return {
      matchScore: match.matchScore,
      isProspect: isProspectInvestorId(investor.profile_id),
      investorType: investor.investor_type ?? null,
      checkBand: checkBand(investor.check_size_min ?? null, investor.check_size_max ?? null),
      reasons: match.matchReasons.slice(0, 4),
      ref: investor.profile_id,
      // Fit bars derived from the same match reasons the engine emitted.
      fitSector: has(/sector/i) ? 100 : 0,
      fitStage: has(/stage/i) ? 100 : 0,
      fitCheck: has(/check/i) ? 100 : 0,
      fitGeo: has(/geograph/i) ? 100 : 0,
      sectors: investor.preferred_sectors ?? [],
      capitalTypes: investor.capitalTypes ?? [],
      stages: investor.preferred_stages ?? [],
      geographies: investor.preferred_geographies ?? [],
    };
  });

  return { cards, total: cards.length, strong: cards.filter((c) => c.matchScore >= 70).length };
}
