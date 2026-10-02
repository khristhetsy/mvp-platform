/**
 * Matching one founder lead to the investor network. Pure.
 *
 * An investor counts as a match when both industry and stage align, which is
 * what the email tells the founder ("N investors fit your industry and
 * stage") and the engine score reaches minScore (the campaign's match floor,
 * 70 by default). Industry alignment is the Match campaign sector tier
 * (sectorFit: exact, adjacent or generalist), not the engine's sector factor,
 * whose substring fallback let "Technology" match "Biotechnology". Matches rank
 * by tier first, then score. The match % is the platform engine's score (explainMatch, the same
 * computation behind matchInvestorToCompany) with the admin weights, so the
 * number a founder sees is the one the rest of iCapOS would show.
 */
import {
  explainMatch,
  type CompanyMatchProfile,
  type EngineWeights,
} from "@/lib/matching/investor-company-matching";
import type { CampaignInvestor } from "./investors";
import type { MaskedMatch } from "./types";
import { sectorFit, TIER_RANK, type Adjacency, type SectorTier } from "./sector-tier";

export type FounderMatch = MaskedMatch & {
  investor_contact_id: string;
  reasons: string[];
  sector_tier: SectorTier;
  matched_sectors: string[];
};

export type MatchOptions = {
  /** The founder's industries as separate labels; defaults to company.industry. */
  founderIndustries?: readonly string[] | null;
  adjacency?: Adjacency;
};

export function matchFounder(
  company: CompanyMatchProfile,
  investors: readonly CampaignInvestor[],
  weights?: EngineWeights,
  minScore = 0,
  opts: MatchOptions = {},
): FounderMatch[] {
  const industries = opts.founderIndustries?.length ? opts.founderIndustries : company.industry ? [company.industry] : [];
  const out: FounderMatch[] = [];
  for (const inv of investors) {
    const fit = sectorFit(industries, inv.sectors, opts.adjacency);
    if (!fit) continue;
    const b = explainMatch(inv.profile, company, weights);
    const stage = b.factors.find((f) => f.key === "stage");
    if (!stage || stage.points <= 0) continue;
    if (b.matchScore < minScore) continue;
    const sectorReason = `Sector alignment: ${fit.matched.join(", ")}`;
    const reasons = b.matchReasons.some((r) => r === "Sector alignment")
      ? b.matchReasons.map((r) => (r === "Sector alignment" ? sectorReason : r))
      : [sectorReason, ...b.matchReasons];
    out.push({
      investor_contact_id: inv.id,
      investor_type: inv.investorType,
      sectors: inv.sectors,
      stages: inv.stages,
      check_band: inv.checkBand,
      match_score: b.matchScore,
      reasons,
      sector_tier: fit.tier,
      matched_sectors: fit.matched,
    });
  }
  // Exact before adjacent before generalist, then highest score; ties broken by
  // id so reruns are stable.
  out.sort(
    (a, b) =>
      TIER_RANK[a.sector_tier] - TIER_RANK[b.sector_tier] ||
      b.match_score - a.match_score ||
      a.investor_contact_id.localeCompare(b.investor_contact_id),
  );
  return out;
}

/**
 * Name and firm as a founder sees them. The firm is dropped when it repeats the
 * name, and a contact with no name falls back to the firm.
 */
export function investorIdentity(name: string | null | undefined, company: string | null | undefined): { investor_name: string | null; investor_firm: string | null } {
  const n = name?.trim() || null;
  const c = company?.trim() || null;
  if (!n) return { investor_name: c, investor_firm: null };
  if (!c || c.toLowerCase() === n.toLowerCase()) return { investor_name: n, investor_firm: null };
  return { investor_name: n, investor_firm: c };
}

/** The snapshot stored for the email and the match page: name and firm, no contact details. */
export function toMasked(m: MaskedMatch): MaskedMatch {
  return {
    investor_name: m.investor_name ?? null,
    investor_firm: m.investor_firm ?? null,
    investor_type: m.investor_type,
    sectors: m.sectors.slice(0, 4),
    ...(m.matched_sectors?.length ? { matched_sectors: m.matched_sectors } : {}),
    stages: m.stages,
    check_band: m.check_band,
    match_score: m.match_score,
  };
}
