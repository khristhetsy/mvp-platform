import { buildProfileCompletion } from "@/lib/data/founder-readiness";
import { OUTREACH_GATE, type Crr } from "@/lib/crr/crr-for";
import type { FounderJourneyState } from "@/lib/founder-journey/types";
import type { Company } from "@/lib/supabase/types";

/**
 * The outreach gate. One number for the whole platform: the engine's, which is
 * also what `outreach_unlocked` is written with on every score row.
 *
 * It used to be 70 here and 65 in the engine, so a founder page could say
 * "outreach is unlocked" while the thing that actually gates outreach disagreed.
 */
export const OUTREACH_THRESHOLD = OUTREACH_GATE;

/**
 * The founder's Capital Readiness Rating.
 *
 * This used to compute its own number — 0.6 × a document-type count + 0.3 ×
 * profile completeness + two 5-point milestones — which never touched a factor,
 * a dimension or a weight. Re-scoring could not move it, and it disagreed with
 * the admin and investor surfaces about the same company.
 *
 * Now it is a projection of the engine score from `crrFor()`. Readiness and
 * profile completeness survive as supporting figures: they feed the score, they
 * are no longer the score.
 */
export function investableCrrFrom(
  crr: Crr,
  state: FounderJourneyState,
  company: Company | null,
): { crr: number; readiness: number; profilePercent: number; outreachReady: boolean } {
  return {
    crr: crr.score ?? 0,
    readiness: state.conditions.readinessScore ?? 0,
    profilePercent: buildProfileCompletion(company).percent,
    outreachReady: crr.outreachUnlocked,
  };
}
