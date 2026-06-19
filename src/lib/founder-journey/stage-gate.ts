import { requireRole } from '@/lib/supabase/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { JOURNEY_STAGES } from './types';
import type { JourneyStage, StageGateResult } from './types';
import { evaluateFounderJourney } from './evaluate';
import { autoAdvanceStage } from './advance';

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
