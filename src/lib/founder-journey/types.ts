export const JOURNEY_STAGES = ['initialize', 'qualify', 'deploy', 'optimize'] as const;

export type JourneyStage = (typeof JOURNEY_STAGES)[number];

export type StageApprovalStatus = 'pending' | 'approved' | 'rejected' | null;

export type StageConditions = {
  onboardingComplete: boolean;
  readinessScore: number | null;
  readinessQualified: boolean;
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
