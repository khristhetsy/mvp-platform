import {
  buildOnboardingStepStatePayload,
  computeFounderOnboardingProgress,
  type OnboardingStepId,
} from "@/lib/onboarding/progress";
import type { Company, DocumentRecord } from "@/lib/supabase/types";

export function buildCompanyOnboardingSyncUpdate(input: {
  company: Company;
  documents: DocumentRecord[];
  diligenceReportExists: boolean;
  currentStep?: OnboardingStepId;
}) {
  const progress = computeFounderOnboardingProgress({
    company: input.company,
    documents: input.documents,
    diligenceReportExists: input.diligenceReportExists,
    storedStepState: input.company.onboarding_step_state,
  });

  const now = new Date().toISOString();

  return {
    onboarding_progress_percent: progress.percent,
    onboarding_step_state: buildOnboardingStepStatePayload(progress, input.currentStep),
    onboarding_completed_at: progress.isComplete
      ? input.company.onboarding_completed_at ?? now
      : null,
    progress,
  };
}
