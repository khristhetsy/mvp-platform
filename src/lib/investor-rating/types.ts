// Partner Score — investor rating types.
// Behavioral rating computed from on-platform activity. See
// docs/investor-platform-spec.md.

export const PARTNER_TIERS = [
  "new",
  "emerging",
  "active",
  "established",
  "premier",
] as const;

export type PartnerTier = (typeof PARTNER_TIERS)[number];

export const TIER_LABELS: Record<PartnerTier, string> = {
  new: "New",
  emerging: "Emerging",
  active: "Active",
  established: "Established",
  premier: "Premier",
};

/** Minimum distinct founders engaged before a composite score is shown. */
export const COLD_START_MIN_SAMPLE = 3;

export const PILLAR_WEIGHTS = {
  followThrough: 0.35,
  responsiveness: 0.25,
  credibility: 0.2,
  portfolioReadiness: 0.1,
  trackRecord: 0.1,
} as const;

/** Raw signals fed to the pure scoring function (computed by the loader). */
export type PartnerScoreInputs = {
  /** Distinct founders the investor has engaged — drives the cold-start gate. */
  sampleSize: number;

  // Follow-through
  interestsExpressed: number;
  dealRoomsOpened: number;
  pledgesMade: number;
  pledgesHonored: number;
  ghostedCount: number; // interests with no deal room and no message within window

  // Responsiveness
  founderThreads: number; // threads where a founder messaged the investor
  repliedThreads: number;
  medianResponseHours: number | null;
  daysSinceLastActive: number | null;

  // Credibility
  accredited: boolean;
  profileCompleteness: number; // 0..1
  pledgesWithinRange: number; // pledges that fell within the stated check-size range

  // Portfolio readiness (descriptor, light weight)
  backedReadinessAvg: number | null; // avg readiness (0..100) of backed companies

  // Track record / tenure
  closedDeals: number;
  tenureMonths: number;
};

export type PartnerPillars = {
  followThrough: number; // each 0..100
  responsiveness: number;
  credibility: number;
  portfolioReadiness: number;
  trackRecord: number;
};

export type PartnerFacts = {
  conversionRate: number; // 0..1
  pledgeHonorRate: number; // 0..1
  ghostRate: number; // 0..1
  replyRate: number; // 0..1
  medianResponseHours: number | null;
  accredited: boolean;
  closedDeals: number;
  backedReadinessAvg: number | null;
  daysSinceLastActive: number | null;
};

export type PartnerScore = {
  status: "new" | "rated";
  tier: PartnerTier;
  score: number | null; // 0..100, null when "new"
  pillars: PartnerPillars;
  facts: PartnerFacts;
  sampleSize: number;
};
