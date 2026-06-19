import type { PartnerScore, PartnerTier } from "./types";
import { TIER_LABELS } from "./types";

// Founder-safe projection of an investor's Partner Score.
//
// SECURITY BOUNDARY: founders may see an investor's TIER and a few objective
// activity FACTS — never the numeric score, the pillar breakdown, or the
// investor's private coaching/improvement panel. This function is the single
// place that enforces that boundary; founder-facing UI must consume only this,
// never a raw PartnerScore.

export type FounderFacingPartner = {
  tier: PartnerTier;
  tierLabel: string;
  facts: {
    /** Human phrase like "~1 day", or null if unknown. */
    repliesWithin: string | null;
    dealsClosed: number;
    activeRecently: boolean;
    /** Only surfaced when follow-through is strong (never a negative callout). */
    reliableFollowThrough: boolean;
  };
};

function repliesWithin(medianHours: number | null): string | null {
  if (medianHours === null) return null;
  if (medianHours < 24) return "~1 day";
  if (medianHours < 72) return "~3 days";
  if (medianHours < 168) return "~1 week";
  return "over a week";
}

export function founderFacingPartnerView(score: PartnerScore): FounderFacingPartner {
  return {
    tier: score.tier,
    tierLabel: TIER_LABELS[score.tier],
    facts: {
      repliesWithin: repliesWithin(score.facts.medianResponseHours),
      dealsClosed: score.facts.closedDeals,
      activeRecently:
        score.facts.daysSinceLastActive !== null && score.facts.daysSinceLastActive <= 14,
      reliableFollowThrough: score.facts.pledgeHonorRate >= 0.7,
    },
  };
}
