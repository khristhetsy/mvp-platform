import type { Company, DocumentRecord } from "@/lib/supabase/types";

// Every step id ever written to companies.onboarding_step_state. Kept whole so
// stored state parses the same way it always did; `investor_readiness_review`
// is no longer shown anywhere, but it is still read and written so older rows
// and the review flow (which sets it with company_profile) keep working.
export const ONBOARDING_STEP_IDS = [
  "company_profile",
  "funding_information",
  "documents_uploaded",
  "readiness_generated",
  "investor_readiness_review",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

/** The only steps that count toward onboarding completion. */
export const REQUIRED_ONBOARDING_STEP_IDS = ["company_profile", "funding_information"] as const satisfies readonly OnboardingStepId[];

/** Shown on the checklist as "Recommended next"; never block completion. */
export const OPTIONAL_ONBOARDING_STEP_IDS = ["documents_uploaded", "readiness_generated"] as const satisfies readonly OnboardingStepId[];

/** Steps the founder sees, in display order. */
export const VISIBLE_ONBOARDING_STEP_IDS: readonly OnboardingStepId[] = [
  ...REQUIRED_ONBOARDING_STEP_IDS,
  ...OPTIONAL_ONBOARDING_STEP_IDS,
];

export type OnboardingStepMeta = {
  id: OnboardingStepId;
  title: string;
  description: string;
  /** True when the step counts toward onboarding completion. */
  required: boolean;
  /** Where the founder goes to act on the step. */
  href: string;
};

export const ONBOARDING_STEPS: OnboardingStepMeta[] = [
  {
    id: "company_profile",
    title: "Company profile",
    description: "Tell investors who you are, what you build, and where you operate.",
    required: true,
    href: "/founder/onboarding",
  },
  {
    id: "funding_information",
    title: "Funding information",
    description: "Share your stage and the amount of capital you are raising.",
    required: true,
    href: "/founder/onboarding",
  },
  {
    id: "documents_uploaded",
    title: "Upload documents",
    description: "Add your pitch deck and diligence materials to the data room.",
    required: false,
    href: "/founder/documents",
  },
  {
    id: "readiness_generated",
    title: "Generate readiness",
    description: "Run AI diligence to see your readiness rating and what to improve.",
    required: false,
    href: "/founder/readiness",
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
  /** Required steps done, of `requiredTotal`. */
  requiredCompleted: number;
  requiredTotal: number;
};

const AUTO_DESCRIPTION = "Company profile created automatically during onboarding.";

function isRequiredStep(stepId: OnboardingStepId) {
  return (REQUIRED_ONBOARDING_STEP_IDS as readonly OnboardingStepId[]).includes(stepId);
}

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
  // Essentials only: name, industry, country (now collected in onboarding), and a
  // real description. founder_goals is derived from an optional timeline, so it is
  // NOT required — requiring it silently stranded founders below 100%.
  const description = company.business_description?.trim() ?? "";
  return (
    Boolean(company.company_name?.trim()) &&
    Boolean(company.industry?.trim()) &&
    Boolean(company.country?.trim()) &&
    description.length >= 20 &&
    description !== AUTO_DESCRIPTION
  );
}

function isFundingInformationComplete(company: Company) {
  // The band select is the answer. funding_amount is derived from the band by a
  // database trigger and is never required here; requiring it stranded founders
  // whose exact amount had not been written yet.
  return Boolean(company.funding_amount_band?.trim());
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

  // A company that already finished onboarding stays finished. Its required
  // steps are held complete even if the live detection would now say otherwise
  // (for example a legacy row with funding_amount but no band).
  const alreadyCompletedAt = input.company.onboarding_completed_at ?? null;
  const locked = Boolean(alreadyCompletedAt);

  const detected: OnboardingStepCompletion = {
    company_profile: {
      completed: locked || isCompanyProfileComplete(input.company),
      completedAt: parsed.steps.company_profile?.completedAt ?? null,
    },
    funding_information: {
      completed: locked || isFundingInformationComplete(input.company),
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
      detected[stepId].completedAt = locked && isRequiredStep(stepId)
        ? alreadyCompletedAt
        : new Date().toISOString();
    }
  }

  const requiredTotal = REQUIRED_ONBOARDING_STEP_IDS.length;
  const requiredCompleted = REQUIRED_ONBOARDING_STEP_IDS.filter((stepId) => detected[stepId].completed).length;
  const percent = Math.round((requiredCompleted / requiredTotal) * 100);
  const isComplete = requiredCompleted === requiredTotal;

  // Current step: the stored step if it is still visible and open, otherwise the
  // first open visible step (required first), otherwise the last visible step.
  let currentStep: OnboardingStepId = parsed.currentStep;
  if (!VISIBLE_ONBOARDING_STEP_IDS.includes(currentStep) || detected[currentStep].completed) {
    const firstIncomplete = VISIBLE_ONBOARDING_STEP_IDS.find((stepId) => !detected[stepId].completed);
    currentStep = firstIncomplete ?? VISIBLE_ONBOARDING_STEP_IDS[VISIBLE_ONBOARDING_STEP_IDS.length - 1];
  }

  const completedAt: string | null = isComplete
    ? alreadyCompletedAt ?? new Date().toISOString()
    : alreadyCompletedAt;

  return {
    percent,
    completedAt,
    currentStep,
    steps: detected,
    pitchDeckUploaded: hasPitchDeck(input.documents),
    diligenceReportExists: input.diligenceReportExists,
    isComplete,
    requiredCompleted,
    requiredTotal,
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
  const index = VISIBLE_ONBOARDING_STEP_IDS.indexOf(stepId);
  if (index < 0 || index >= VISIBLE_ONBOARDING_STEP_IDS.length - 1) {
    return null;
  }

  return VISIBLE_ONBOARDING_STEP_IDS[index + 1];
}
