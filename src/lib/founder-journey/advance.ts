import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { JOURNEY_STAGES } from './types';
import type { JourneyStage, FounderJourneyState } from './types';
import { createNotification } from '@/lib/notifications/notifications';

// Cast helper — the new journey columns exist in the DB after the migration but are not
// yet reflected in the generated Database types. We use a raw untyped client reference
// only for these update calls so strict mode remains satisfied elsewhere.
function rawClient(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

/** Fire-and-forget founder notification when a stage auto-advances. */
async function notifyStageAdvance(profileId: string, title: string, message: string): Promise<void> {
  try {
    await createNotification({
      recipientUserId: profileId,
      type: 'founder_stage_review',
      title,
      message,
      entityType: 'profile',
      entityId: profileId,
      deepLink: '/founder/journey',
    });
  } catch {
    // Non-critical — never block stage evaluation on a notification.
  }
}

export async function autoAdvanceStage(
  supabase: SupabaseClient<Database>,
  profileId: string,
  state: FounderJourneyState,
): Promise<JourneyStage> {
  let currentStage = state.stage;

  // Initialize → Qualify: when onboarding is complete
  if (currentStage === 'initialize' && state.conditions.onboardingComplete) {
    await rawClient(supabase)
      .from('profiles')
      .update({
        journey_stage: 'qualify',
        journey_stage_updated_at: new Date().toISOString(),
        stage_approval_status: null,
      })
      .eq('id', profileId);
    currentStage = 'qualify';
    await notifyStageAdvance(profileId, "You've reached Qualify", "Build your fundraise readiness to unlock the investor workspace.");
  }

  // Deploy → Optimize: when deal room exists OR investor has expressed interest
  if (
    currentStage === 'deploy' &&
    (state.conditions.hasDealRoom || state.conditions.hasInvestorInterest)
  ) {
    await rawClient(supabase)
      .from('profiles')
      .update({
        journey_stage: 'optimize',
        journey_stage_updated_at: new Date().toISOString(),
      })
      .eq('id', profileId);
    currentStage = 'optimize';
    await notifyStageAdvance(profileId, "You've reached Optimize", "Your post-raise tools — updates, milestones, and analytics — are now available.");
  }

  return currentStage;
}

export async function requestStageApproval(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<void> {
  await rawClient(supabase)
    .from('profiles')
    .update({
      stage_approval_status: 'pending',
      stage_approval_requested_at: new Date().toISOString(),
    })
    .eq('id', profileId);
}

export { JOURNEY_STAGES };
export type { JourneyStage };
