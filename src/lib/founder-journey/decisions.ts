// Pure stage-advancement decisions, separated from the DB side-effects in
// autoAdvanceStage so they can be unit-tested. This is the most bug-prone logic
// in the journey (it had the initialize→qualify dead-end, the rejection
// re-submit loop, and the chicken-and-egg trigger), so it gets its own coverage.

import type { JourneyStage, StageApprovalStatus, StageConditions } from './types';

/** Initialize → Qualify auto-advances once the founder finishes onboarding. */
export function shouldAdvanceInitializeToQualify(stage: JourneyStage, conditions: StageConditions): boolean {
  return stage === 'initialize' && conditions.onboardingComplete;
}

/**
 * Qualify → Deploy: auto-submit for admin review when the founder meets every
 * requirement AND has never been reviewed (approvalStatus === null). Crucially,
 * a rejected/pending/approved founder is NOT auto-resubmitted — that would
 * nullify the admin's decision in a loop.
 */
export function shouldAutoRequestReview(
  stage: JourneyStage,
  conditions: StageConditions,
  approvalStatus: StageApprovalStatus,
): boolean {
  return (
    stage === 'qualify' &&
    conditions.readinessQualified &&
    conditions.requiredDocsUploaded &&
    approvalStatus === null
  );
}

/** Deploy → Optimize auto-advances once there's a deal room or investor interest. */
export function shouldAdvanceDeployToOptimize(stage: JourneyStage, conditions: StageConditions): boolean {
  return stage === 'deploy' && (conditions.hasDealRoom || conditions.hasInvestorInterest);
}
