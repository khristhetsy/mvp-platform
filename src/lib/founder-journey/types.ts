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
