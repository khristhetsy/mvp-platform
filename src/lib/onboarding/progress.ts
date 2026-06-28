import type { Company, DocumentRecord } from "@/lib/supabase/types";

export const ONBOARDING_STEP_IDS = [
  "company_profile",
  "funding_information",
  "documents_uploaded",
  "readiness_generated",
  "investor_readiness_review",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

export type OnboardingStepMeta = {
  id: OnboardingStepId;
  title: string;
  description: string;
};

export const ONBOARDING_STEPS: OnboardingStepMeta[] = [
  {
    id: "company_profile",
    title: "Company profile",
    description: "Tell investors who you are, what you build, and where you operate.",
  },
  {
    id: "funding_information",
    title: "Funding information",
    description: "Share your stage, raise target, and how capital will be deployed.",
  },
  {
    id: "documents_uploaded",
    title: "Documents",
    description: "Upload your pitch deck and diligence materials.",
  },
  {
    id: "readiness_generated",
    title: "Readiness & diligence",
    description: "Generate AI diligence insights and track readiness improvements.",
  },
  {
    id: "investor_readiness_review",
    title: "Investor readiness review",
    description: "Submit for admin review and stronger marketplace visibility.",
  },
];

export type OnboardingStepCompletion = Record<
  OnboardingStepId,
  {
    completed: boolean;
    completedAt: string | null;
  }
>;

export type FounderOnboardingProgress = {
  percent: number;
  completedAt: string | null;
  currentStep: OnboardingStepId;
  steps: OnboardingStepCompletion;
  pitchDeckUploaded: boolean;
  diligenceReportExists: boolean;
  isComplete: boolean;
};

const AUTO_DESCRIPTION = "Company profile created automatically during onboarding.";

export function parseOnboardingStepState(value: unknown): {
  currentStep: OnboardingStepId;
  steps: Partial<OnboardingStepCompletion>;
} {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const current =
    typeof raw.current_step === "string" && ONBOARDING_STEP_IDS.includes(raw.current_step as OnboardingStepId)
      ? (raw.current_step as OnboardingStepId)
      : "company_profile";

  const steps: Partial<OnboardingStepCompletion> = {};

  for (const stepId of ONBOARDING_STEP_IDS) {
    const entry = raw[stepId];
    if (entry && typeof entry === "object") {
      const row = entry as { completed?: boolean; completedAt?: string | null };
      steps[stepId] = {
        completed: Boolean(row.completed),
        completedAt: typeof row.completedAt === "string" ? row.completedAt : null,
      };
    }
  }

  return { currentStep: current, steps };
}

function isCompanyProfileComplete(company: Company) {
  const description = company.business_description?.trim() ?? "";
  return (
    Boolean(company.company_name?.trim()) &&
    Boolean(company.industry?.trim()) &&
    Boolean(company.country?.trim()) &&
    description.length >= 20 &&
    description !== AUTO_DESCRIPTION &&
    Boolean(company.founder_goals?.trim() && company.founder_goals.trim().length >= 10)
  );
}

function isFundingInformationComplete(company: Company) {
  return (
    company.funding_amount != null &&
    company.funding_amount > 0 &&
    Boolean(company.revenue_stage?.trim()) &&
    Boolean(company.use_of_funds?.trim() && company.use_of_funds.trim().length >= 10)
  );
}

function hasPitchDeck(documents: DocumentRecord[]) {
  return documents.some((document) => document.document_type?.toUpperCase() === "PITCH_DECK");
}

function isInvestorReviewComplete(company: Company) {
  const status = company.review_status ?? company.status ?? null;
  return Boolean(status && status !== "draft");
}

export function computeFounderOnboardingProgress(input: {
  company: Company;
  documents: DocumentRecord[];
  diligenceReportExists: boolean;
  storedStepState?: unknown;
}): FounderOnboardingProgress {
  const parsed = parseOnboardingStepState(input.storedStepState ?? input.company.onboarding_step_state);

  const detected: OnboardingStepCompletion = {
    company_profile: {
      completed: isCompanyProfileComplete(input.company),
      completedAt: parsed.steps.company_profile?.completedAt ?? null,
    },
    funding_information: {
      completed: isFundingInformationComplete(input.company),
      completedAt: parsed.steps.funding_information?.completedAt ?? null,
    },
    documents_uploaded: {
      completed: hasPitchDeck(input.documents),
      completedAt: parsed.steps.documents_uploaded?.completedAt ?? null,
    },
    readiness_generated: {
      completed: input.diligenceReportExists,
      completedAt: parsed.steps.readiness_generated?.completedAt ?? null,
    },
    investor_readiness_review: {
      completed: isInvestorReviewComplete(input.company),
      completedAt: parsed.steps.investor_readiness_review?.completedAt ?? null,
    },
  };

  for (const stepId of ONBOARDING_STEP_IDS) {
    if (detected[stepId].completed && !detected[stepId].completedAt) {
      detected[stepId].completedAt = new Date().toISOString();
    }
  }

  // Steps that count toward completing onboarding (Stage 1). Intentionally a
  // short list so founders reach the workspace fast, then build their data room
  // in Stage 2 where the readiness/document tools live.
  // Excluded:
  // "documents_uploaded"        — uploading a pitch deck is NOT required to finish
  //                               onboarding; it's surfaced as a Stage 2 next-step
  //                               and is still required later for Qualify→Deploy.
  // "investor_readiness_review" — requires an admin to act; founder cannot trigger it.
  // "readiness_generated"       — diligence reports are generated by admin/AI only;
  //                               no founder-accessible POST route exists for this.
  const FOUNDER_ACTIONABLE_STEP_IDS = ONBOARDING_STEP_IDS.filter(
    (id) =>
      id !== "investor_readiness_review" &&
      id !== "readiness_generated" &&
      id !== "documents_uploaded",
  );

  const completedCount = FOUNDER_ACTIONABLE_STEP_IDS.filter((stepId) => detected[stepId].completed).length;
  const percent = Math.round((completedCount / FOUNDER_ACTIONABLE_STEP_IDS.length) * 100);
  const isComplete = completedCount === FOUNDER_ACTIONABLE_STEP_IDS.length;

  let currentStep = parsed.currentStep;
  if (!detected[currentStep].completed) {
    // keep stored step if still incomplete
  } else {
    const firstIncomplete = ONBOARDING_STEP_IDS.find((stepId) => !detected[stepId].completed);
    currentStep = firstIncomplete ?? ONBOARDING_STEP_IDS[ONBOARDING_STEP_IDS.length - 1];
  }

  const completedAt: string | null = isComplete
    ? input.company.onboarding_completed_at ?? new Date().toISOString()
    : input.company.onboarding_completed_at ?? null;

  return {
    percent,
    completedAt,
    currentStep,
    steps: detected,
    pitchDeckUploaded: hasPitchDeck(input.documents),
    diligenceReportExists: input.diligenceReportExists,
    isComplete,
  };
}

export function buildOnboardingStepStatePayload(
  progress: FounderOnboardingProgress,
  currentStep?: OnboardingStepId,
) {
  const payload: Record<string, unknown> = {
    current_step: currentStep ?? progress.currentStep,
  };

  for (const stepId of ONBOARDING_STEP_IDS) {
    payload[stepId] = progress.steps[stepId];
  }

  return payload;
}

export function getNextOnboardingStep(stepId: OnboardingStepId): OnboardingStepId | null {
  const index = ONBOARDING_STEP_IDS.indexOf(stepId);
  if (index < 0 || index >= ONBOARDING_STEP_IDS.length - 1) {
    return null;
  }

  return ONBOARDING_STEP_IDS[index + 1];
}
