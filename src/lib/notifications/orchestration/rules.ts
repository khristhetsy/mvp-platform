/** Deterministic SLA windows (hours unless noted). No auto-close/escalate. */
export const SLA_RULES = {
  criticalComplianceHours: 24,
  investorDocumentReviewHours: 48,
  companyReviewHours: 72,
  founderRemediationDays: 7,
  investorSpvRequirementDays: 7,
  onboardingInactivityDays: 14,
  spvInactivityDays: 5,
} as const;

export const SLA_RULES_MS = {
  criticalCompliance: SLA_RULES.criticalComplianceHours * 60 * 60 * 1000,
  investorDocumentReview: SLA_RULES.investorDocumentReviewHours * 60 * 60 * 1000,
  companyReview: SLA_RULES.companyReviewHours * 60 * 60 * 1000,
  founderRemediation: SLA_RULES.founderRemediationDays * 24 * 60 * 60 * 1000,
  investorSpvRequirement: SLA_RULES.investorSpvRequirementDays * 24 * 60 * 60 * 1000,
  onboardingInactivity: SLA_RULES.onboardingInactivityDays * 24 * 60 * 60 * 1000,
  spvInactivity: SLA_RULES.spvInactivityDays * 24 * 60 * 60 * 1000,
} as const;

export const ORCHESTRATION_SCAN_LIMIT = 150;
export const INACTIVITY_SCAN_LIMIT = 40;
export const RECENT_ACTIVITY_WINDOW_DAYS = 14;
