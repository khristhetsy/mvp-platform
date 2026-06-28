import {
  COLD_START_MIN_SAMPLE,
  PILLAR_WEIGHTS,
  type PartnerPillars,
  type PartnerScore,
  type PartnerScoreInputs,
  type PartnerTier,
} from "./types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

/** Safe rate — returns 0 when the denominator is 0 (no activity yet). */
function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/** Map a median response time (hours) to a 0–100 score. */
function responseTimeScore(medianHours: number | null): number {
  if (medianHours === null) return 50; // unknown — neutral
  if (medianHours < 24) return 100;
  if (medianHours < 72) return 70;
  if (medianHours < 168) return 40; // < 7 days
  return 15;
}

/** Recency decay multiplier from days since last activity. */
function recencyMultiplier(daysSinceLastActive: number | null): number {
  if (daysSinceLastActive === null) return 0.7;
  if (daysSinceLastActive <= 30) return 1;
  if (daysSinceLastActive <= 90) return 0.7;
  if (daysSinceLastActive <= 180) return 0.4;
  return 0.2;
}

export function computePillars(input: PartnerScoreInputs): PartnerPillars {
  // Follow-through (35%) — conversion + pledge-honor, minus a ghost penalty.
  const conversionRate = rate(input.dealRoomsOpened, input.interestsExpressed);
  const pledgeHonorRate = rate(input.pledgesHonored, input.pledgesMade);
  const ghostRate = rate(input.ghostedCount, input.interestsExpressed);
  const followThrough = clamp(
    100 * (0.5 * conversionRate + 0.5 * pledgeHonorRate) - 100 * Math.min(ghostRate, 0.3),
  );

  // Responsiveness (25%) — reply rate + response speed, decayed by recency.
  const replyRate = rate(input.repliedThreads, input.founderThreads);
  const responsiveness = clamp(
    recencyMultiplier(input.daysSinceLastActive) *
      (0.6 * 100 * replyRate + 0.4 * responseTimeScore(input.medianResponseHours)),
  );

  // Credibility (20%) — verification + profile completeness + pledge consistency.
  // Verified KYC (Stage 2) is the dominant signal: it earns the full
  // accreditation weight, a self-attested checkbox earns only a token amount,
  // and unverified earns nothing. This makes completing Stage 2 the single
  // biggest credibility lever an investor controls.
  const consistency =
    input.amountPledgesMade > 0 ? rate(input.pledgesWithinRange, input.amountPledgesMade) : 1;
  const accreditationScore = input.accreditationVerified ? 1 : input.accredited ? 0.15 : 0;
  const credibility = clamp(
    50 * accreditationScore +
      30 * clamp(input.profileCompleteness, 0, 1) +
      20 * consistency,
  );

  // Portfolio readiness (10%) — descriptor; null → neutral so it neither helps nor
  // hurts. Deliberately light so backing rough early companies isn't punished.
  const portfolioReadiness =
    input.backedReadinessAvg === null ? 60 : clamp(input.backedReadinessAvg);

  // Track record (10%) — base + experience + tenure. Experience combines closed
  // on-platform deals with admin-verified prior (off-platform) investments.
  const experience = Math.min(input.closedDeals + input.verifiedPriorDeals, 3);
  const trackRecord = clamp(55 + 12 * experience + 9 * Math.min(input.tenureMonths / 6, 1));

  return { followThrough, responsiveness, credibility, portfolioReadiness, trackRecord };
}

export function tierFromScore(score: number): PartnerTier {
  if (score >= 80) return "premier";
  if (score >= 60) return "established";
  if (score >= 40) return "active";
  return "emerging";
}

/**
 * Pure Partner Score computation. Returns "new" with facts (but no composite)
 * until the investor has engaged enough founders to be meaningfully rated.
 */
export function computePartnerScore(input: PartnerScoreInputs): PartnerScore {
  const pillars = computePillars(input);

  const facts = {
    conversionRate: rate(input.dealRoomsOpened, input.interestsExpressed),
    pledgeHonorRate: rate(input.pledgesHonored, input.pledgesMade),
    ghostRate: rate(input.ghostedCount, input.interestsExpressed),
    replyRate: rate(input.repliedThreads, input.founderThreads),
    medianResponseHours: input.medianResponseHours,
    accredited: input.accredited,
    closedDeals: input.closedDeals,
    backedReadinessAvg: input.backedReadinessAvg,
    daysSinceLastActive: input.daysSinceLastActive,
  };

  if (input.sampleSize < COLD_START_MIN_SAMPLE) {
    return {
      status: "new",
      tier: "new",
      score: null,
      pillars,
      facts,
      sampleSize: input.sampleSize,
    };
  }

  const score = Math.round(
    PILLAR_WEIGHTS.followThrough * pillars.followThrough +
      PILLAR_WEIGHTS.responsiveness * pillars.responsiveness +
      PILLAR_WEIGHTS.credibility * pillars.credibility +
      PILLAR_WEIGHTS.portfolioReadiness * pillars.portfolioReadiness +
      PILLAR_WEIGHTS.trackRecord * pillars.trackRecord,
  );

  return {
    status: "rated",
    tier: tierFromScore(score),
    score,
    pillars,
    facts,
    sampleSize: input.sampleSize,
  };
}
