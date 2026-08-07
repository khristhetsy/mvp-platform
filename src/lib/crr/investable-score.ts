import { buildProfileCompletion } from "@/lib/data/founder-readiness";
import type { FounderJourneyState } from "@/lib/founder-journey/types";
import type { Company } from "@/lib/supabase/types";

/** CRR score at or above which automated investor outreach unlocks. */
export const OUTREACH_THRESHOLD = 70;

/**
 * The founder's Capital Readiness Rating (CRR) — the single canonical score
 * shown on both the Dashboard and the Journey, and the gate for automated
 * outreach. Composite of readiness, profile completeness, and the onboarding /
 * required-documents milestones. Kept here so every surface shows one number.
 */
export function computeInvestableCrr(
  state: FounderJourneyState,
  company: Company | null,
): { crr: number; readiness: number; profilePercent: number; outreachReady: boolean } {
  const readiness = state.conditions.readinessScore ?? 0;
  const profilePercent = buildProfileCompletion(company).percent;
  const crr = Math.round(
    Math.min(
      100,
      0.6 * readiness +
        0.3 * profilePercent +
        (state.conditions.onboardingComplete ? 5 : 0) +
        (state.conditions.requiredDocsUploaded ? 5 : 0),
    ),
  );
  return { crr, readiness, profilePercent, outreachReady: crr >= OUTREACH_THRESHOLD };
}
