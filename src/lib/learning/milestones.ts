import { READINESS_SCORE_THRESHOLD } from "@/lib/remediation/rules";
import type { ReadinessMilestone, ReadinessMilestoneKey } from "@/lib/learning/types";
import type { Company, DocumentRecord } from "@/lib/supabase/types";

export type MilestoneComputationInput = {
  company: Company | null;
  documents: DocumentRecord[];
  onboardingPercent: number;
  readinessScore: number | null;
  hasDiligenceReport: boolean;
  remediationActive: number;
  remediationHighPriorityOpen: number;
  learningPercentComplete: number;
  learningModulesCompleted: number;
};

function hasPitchDeck(documents: DocumentRecord[]) {
  return documents.some((document) => document.document_type?.toUpperCase() === "PITCH_DECK");
}

function hasFinancials(documents: DocumentRecord[]) {
  return documents.some((document) => document.document_type?.toUpperCase() === "FINANCIAL_STATEMENTS");
}

function isReviewSubmitted(company: Company | null) {
  if (!company) return false;
  const status = company.review_status ?? company.status ?? null;
  return Boolean(status && status !== "draft");
}

function profileFoundationComplete(company: Company | null) {
  if (!company) return false;
  const description = company.business_description?.trim() ?? "";
  return description.length >= 20 && Boolean(company.industry?.trim());
}

const MILESTONE_DEFINITIONS: Array<{
  key: ReadinessMilestoneKey;
  label: string;
  description: string;
  evaluate: (input: MilestoneComputationInput) => { met: string[]; pending: string[] };
}> = [
  {
    key: "foundation_ready",
    label: "Foundation Ready",
    description: "Core profile and onboarding foundation established for institutional review.",
    evaluate: (input) => {
      const met: string[] = [];
      const pending: string[] = [];
      if (input.onboardingPercent >= 80) met.push("Onboarding at least 80% complete");
      else pending.push("Complete onboarding to 80%");
      if (profileFoundationComplete(input.company)) met.push("Company description and industry set");
      else pending.push("Add investor-grade company description and industry");
      return { met, pending };
    },
  },
  {
    key: "investor_ready_l1",
    label: "Investor Ready Level 1",
    description: "Minimum investor package for marketplace and first institutional conversations.",
    evaluate: (input) => {
      const met: string[] = [];
      const pending: string[] = [];
      if (input.onboardingPercent >= 100) met.push("Onboarding 100% complete");
      else pending.push("Finish founder onboarding");
      if (hasPitchDeck(input.documents)) met.push("Pitch deck uploaded");
      else pending.push("Upload pitch deck");
      if (input.learningModulesCompleted >= 2) met.push("At least 2 learning modules completed");
      else pending.push("Complete 2 recommended learning modules");
      return { met, pending };
    },
  },
  {
    key: "investor_ready_l2",
    label: "Investor Ready Level 2",
    description: "Readiness score and remediation posture suitable for active investor outreach.",
    evaluate: (input) => {
      const met: string[] = [];
      const pending: string[] = [];
      const score = input.readinessScore ?? 0;
      if (score >= 60) met.push("Readiness score at least 60");
      else pending.push("Raise readiness score to 60+");
      if (input.remediationHighPriorityOpen <= 2) met.push("At most 2 open high-priority remediation tasks");
      else pending.push("Close high-priority remediation gaps");
      if (hasFinancials(input.documents)) met.push("Financial statements uploaded");
      else pending.push("Upload financial statements");
      return { met, pending };
    },
  },
  {
    key: "institutional_ready",
    label: "Institutional Ready",
    description: "Submitted for admin review with sustained learning progression.",
    evaluate: (input) => {
      const met: string[] = [];
      const pending: string[] = [];
      if (isReviewSubmitted(input.company)) met.push("Submitted for investor readiness review");
      else pending.push("Submit company for admin review");
      if (input.learningPercentComplete >= 40) met.push("Learning progression at least 40%");
      else pending.push("Reach 40% overall learning completion");
      if (input.remediationActive <= 5) met.push("Remediation backlog manageable (≤5 active)");
      else pending.push("Reduce active remediation tasks to 5 or fewer");
      return { met, pending };
    },
  },
  {
    key: "diligence_verified",
    label: "Diligence Verified",
    description: "AI diligence completed with institutional readiness threshold met.",
    evaluate: (input) => {
      const met: string[] = [];
      const pending: string[] = [];
      if (input.hasDiligenceReport) met.push("AI diligence report generated");
      else pending.push("Generate AI diligence report");
      const score = input.readinessScore ?? 0;
      if (score >= READINESS_SCORE_THRESHOLD) met.push(`Readiness score ≥ ${READINESS_SCORE_THRESHOLD}`);
      else pending.push(`Improve readiness score to ${READINESS_SCORE_THRESHOLD}+`);
      return { met, pending };
    },
  },
  {
    key: "series_a_ready",
    label: "Series A Ready",
    description: "Published, high readiness, and advanced learning completion for growth rounds.",
    evaluate: (input) => {
      const met: string[] = [];
      const pending: string[] = [];
      if (input.company?.is_published) met.push("Company published to marketplace");
      else pending.push("Achieve marketplace publication");
      const score = input.readinessScore ?? 0;
      if (score >= READINESS_SCORE_THRESHOLD) met.push(`Readiness score ≥ ${READINESS_SCORE_THRESHOLD}`);
      else pending.push(`Readiness score ${READINESS_SCORE_THRESHOLD}+ required`);
      if (input.learningPercentComplete >= 70) met.push("Learning progression at least 70%");
      else pending.push("Reach 70% overall learning completion");
      return { met, pending };
    },
  },
];

export function computeReadinessMilestones(input: MilestoneComputationInput): ReadinessMilestone[] {
  return MILESTONE_DEFINITIONS.map((definition) => {
    const { met, pending } = definition.evaluate(input);
    const achieved = pending.length === 0 && met.length > 0;

    return {
      key: definition.key,
      label: definition.label,
      description: definition.description,
      achieved,
      achievedAt: achieved ? new Date().toISOString() : null,
      criteriaMet: met,
      criteriaPending: pending,
    };
  });
}

export function getCurrentMilestone(milestones: ReadinessMilestone[]) {
  const achieved = milestones.filter((milestone) => milestone.achieved);
  return achieved[achieved.length - 1] ?? null;
}

export function getNextMilestone(milestones: ReadinessMilestone[]) {
  return milestones.find((milestone) => !milestone.achieved) ?? null;
}

export function milestoneLabelForAdmin(milestones: ReadinessMilestone[]) {
  const current = getCurrentMilestone(milestones);
  if (current) return current.label;
  const next = getNextMilestone(milestones);
  return next ? `Working toward: ${next.label}` : "Not started";
}
