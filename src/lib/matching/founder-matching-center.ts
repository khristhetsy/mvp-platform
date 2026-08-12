// Founder-facing Matching Center: rank investor contacts (registered members +
// internal CRM prospects) against the founder's company. Names + firm are shown
// to founders; direct contact still happens through a brokered introduction.
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
  /** Reference (investor/prospect id) — sent back on an intro request. */
  ref: string;
  /** Investor identity (now surfaced to founders). */
  name: string;
  firm: string | null;
  /** True once an introduction with this investor has been facilitated — gates
   *  the founder's Follow-up action. Prospects (non-members) are never connected. */
  connected: boolean;
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

  // Resolve real names + firms for the ranked investors. Members come from their
  // profile + investor_profile; prospects carry a name from the CRM import.
  const admin = createServiceRoleClient();
  const memberIds = ranked.map((r) => r.investor.profile_id).filter((id) => !isProspectInvestorId(id));
  const nameById = new Map<string, string>();
  const firmById = new Map<string, string>();
  const connectedSet = new Set<string>();
  if (memberIds.length) {
    const [profs, ips, intros] = await Promise.all([
      admin.from("profiles").select("id, full_name").in("id", memberIds),
      admin.from("investor_profiles").select("profile_id, firm_name").in("profile_id", memberIds),
      admin.from("intro_requests").select("investor_id").eq("company_id", company.id).eq("status", "facilitated").in("investor_id", memberIds),
    ]);
    for (const p of (profs.data ?? []) as Array<{ id: string; full_name: string | null }>) if (p.full_name) nameById.set(p.id, p.full_name);
    for (const ip of (ips.data ?? []) as Array<{ profile_id: string; firm_name: string | null }>) if (ip.firm_name) firmById.set(ip.profile_id, ip.firm_name);
    for (const r of (intros.data ?? []) as Array<{ investor_id: string }>) connectedSet.add(r.investor_id);
  }
  const prospectName = (id: string): string => {
    const n = prospects.names.get(id);
    return (n ? n.replace(/\s*·\s*prospect\s*$/i, "") : "").trim() || "Investor";
  };

  const cards: FounderInvestorMatchCard[] = ranked.map(({ investor, match }) => {
    const has = (re: RegExp) => match.matchReasons.some((x) => re.test(x));
    const isP = isProspectInvestorId(investor.profile_id);
    return {
      matchScore: match.matchScore,
      isProspect: isP,
      investorType: investor.investor_type ?? null,
      checkBand: checkBand(investor.check_size_min ?? null, investor.check_size_max ?? null),
      reasons: match.matchReasons.slice(0, 4),
      ref: investor.profile_id,
      name: isP ? prospectName(investor.profile_id) : (nameById.get(investor.profile_id) ?? "Investor"),
      firm: isP ? null : (firmById.get(investor.profile_id) ?? null),
      connected: !isP && connectedSet.has(investor.profile_id),
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

  // Show only genuine matches — keep those at/above the admin Minimum match score.
  const qualifying = cards.filter((c) => c.matchScore >= cfg.minMatch);
  return { cards: qualifying, total: qualifying.length, strong: qualifying.filter((c) => c.matchScore >= 70).length };
}
