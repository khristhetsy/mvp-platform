import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { JOURNEY_STAGES } from './types';
import type { JourneyStage, FounderJourneyState } from './types';
import { createNotification, notifyStaffIfNotRecent } from '@/lib/notifications/notifications';

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

  // Qualify → Deploy: auto-submit for admin review once the founder meets every
  // requirement (readiness ≥ 75 + the 3 core docs). The admin still approves —
  // this just removes the manual "request review" step so qualified founders are
  // never left waiting on a button. Idempotent: skips if already pending/approved.
  if (
    currentStage === 'qualify' &&
    state.conditions.readinessQualified &&
    state.conditions.requiredDocsUploaded &&
    state.approvalStatus !== 'pending' &&
    state.approvalStatus !== 'approved'
  ) {
    await rawClient(supabase)
      .from('profiles')
      .update({
        stage_approval_status: 'pending',
        stage_approval_requested_at: new Date().toISOString(),
      })
      .eq('id', profileId);
    await notifyStageAdvance(
      profileId,
      "You're submitted for review",
      "You've met every Qualify requirement. Our team is reviewing your readiness to unlock the Deploy stage.",
    );
    await notifyStaffIfNotRecent({
      type: 'founder_stage_review',
      title: 'Founder ready for Deploy review',
      message: 'A founder met all Qualify requirements and was auto-submitted for stage approval.',
      entityType: 'profile',
      entityId: profileId,
      withinHours: 24,
    }).catch(() => { /* non-critical */ });
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
