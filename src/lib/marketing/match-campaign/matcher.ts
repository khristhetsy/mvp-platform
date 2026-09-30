/**
 * Matching one founder lead to the investor network. Pure.
 *
 * An investor counts as a match when both industry and stage align, which is
 * what the email tells the founder ("N investors fit your industry and
 * stage") and the engine score reaches minScore (the campaign's match floor,
 * 70 by default). The match % is the platform engine's score (explainMatch, the same
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

export type FounderMatch = MaskedMatch & {
  investor_contact_id: string;
  reasons: string[];
};

export function matchFounder(
  company: CompanyMatchProfile,
  investors: readonly CampaignInvestor[],
  weights?: EngineWeights,
  minScore = 0,
): FounderMatch[] {
  const out: FounderMatch[] = [];
  for (const inv of investors) {
    const b = explainMatch(inv.profile, company, weights);
    const sector = b.factors.find((f) => f.key === "sector");
    const stage = b.factors.find((f) => f.key === "stage");
    if (!sector || !stage || sector.points <= 0 || stage.points <= 0) continue;
    if (b.matchScore < minScore) continue;
    out.push({
      investor_contact_id: inv.id,
      investor_type: inv.investorType,
      sectors: inv.sectors,
      stages: inv.stages,
      check_band: inv.checkBand,
      match_score: b.matchScore,
      reasons: b.matchReasons,
    });
  }
  // Highest score first; ties broken by id so reruns are stable.
  out.sort((a, b) => b.match_score - a.match_score || a.investor_contact_id.localeCompare(b.investor_contact_id));
  return out;
}

/** The identity-free snapshot stored for the email and the match page. */
export function toMasked(m: MaskedMatch): MaskedMatch {
  return {
    investor_type: m.investor_type,
    sectors: m.sectors.slice(0, 4),
    stages: m.stages,
    check_band: m.check_band,
    match_score: m.match_score,
  };
}
