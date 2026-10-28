export const JOURNEY_STAGES = ['initialize', 'qualify', 'deploy', 'optimize'] as const;

export type JourneyStage = (typeof JOURNEY_STAGES)[number];

export type StageApprovalStatus = 'pending' | 'approved' | 'rejected' | null;

export type StageConditions = {
  onboardingComplete: boolean;
  /** Preparation completion — a count of required document types present, gate 75. */
  readinessScore: number | null;
  readinessQualified: boolean;
  /** The CRR engine score on the company's own stage profile, or null if never scored. */
  crrScore: number | null;
  /**
   * The engine's own outreach gate (`outreach_unlocked`), never a hard-coded
   * threshold. Gates Automated Outreach and brokered introductions in Marketing.
   * It does NOT gate stage advancement — a founder reaches Marketing at any CRR.
   */
  crrQualified: boolean;
  requiredDocsUploaded: boolean;
  hasDealRoom: boolean;
  hasInvestorInterest: boolean;
  /**
   * Outreach step complete: automated launched AND at least one manual email
   * sent (loadOutreachStatus). Filled in by the admin company workspace only; the
   * founder journey evaluator leaves it unset. Never gates stage advancement.
   */
  outreachComplete?: boolean;
  /**
   * Whether the founder's current (non-archived) uploads, or a finalized in-platform
   * plan, cover these Preparation rows. Filled in by the admin company workspace only
   * (see stage-menu-signals.ts); the founder journey evaluator leaves them unset and
   * none of them gates stage advancement.
   */
  hasBusinessPlan?: boolean;
  hasPitchDeck?: boolean;
  hasCapTable?: boolean;
  hasFinancialModel?: boolean;
};

export type FounderJourneyState = {
  stage: JourneyStage;
  stageIndex: number;
  approvalStatus: StageApprovalStatus;
  approvalFeedback: string | null;
  conditions: StageConditions;
  canRequestApproval: boolean;
  pendingApproval: boolean;
};

export type StageGateResult =
  | { allowed: true }
  | {
      allowed: false;
      stage: JourneyStage;
      minRequired: JourneyStage;
      pendingApproval: boolean;
    };
