import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { requireRole } from '@/lib/supabase/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { JOURNEY_STAGES } from './types';
import type { JourneyStage, StageGateResult, FounderJourneyState } from './types';
import { evaluateFounderJourney } from './evaluate';
import { autoAdvanceStage } from './advance';

/**
 * Evaluate the founder's journey AND apply any auto-advance, returning the fresh
 * state. Call this from surfaces a founder reliably lands on (dashboard,
 * onboarding) so completing onboarding promotes them — otherwise advancement
 * only fires on stage-gated pages, which are locked until they're promoted
 * (a chicken-and-egg that strands qualified founders at Stage 1).
 */
export async function advanceFounderJourney(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<FounderJourneyState> {
  const state = await evaluateFounderJourney(supabase, profileId);
  const resultingStage = await autoAdvanceStage(supabase, profileId, state);
  // Stage changed → re-evaluate so the returned state reflects the new stage.
  return resultingStage !== state.stage ? evaluateFounderJourney(supabase, profileId) : state;
}

export async function checkFounderStageAccess(minStage: JourneyStage): Promise<StageGateResult> {
  const profile = await requireRole(['founder']);
  const supabase = await createServerSupabaseClient();

  const state = await evaluateFounderJourney(supabase, profile.id);
  const resultingStage = await autoAdvanceStage(supabase, profile.id, state);

  const resultingIndex = JOURNEY_STAGES.indexOf(resultingStage);
  const minIndex = JOURNEY_STAGES.indexOf(minStage);

  if (resultingIndex >= minIndex) {
    return { allowed: true };
  }

  return {
    allowed: false,
    stage: resultingStage,
    minRequired: minStage,
    pendingApproval: state.pendingApproval,
  };
}
