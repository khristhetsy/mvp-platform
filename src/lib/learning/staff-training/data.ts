import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { coerceCoachTone, type CoachTone } from "@/lib/learning/coach/tones";
import type { TrainingAudience } from "./catalog";
import { pickClaimableInvite, type ClaimableInvite } from "./invites";

export type Enrollment = {
  id: string;
  user_id: string;
  audience: TrainingAudience;
  organization_label: string;
  reviewer_label: string;
  coach_on: boolean;
  coach_tone: CoachTone;
  status: string;
};

export function service(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

/** The enrollment row is the access list. No active row, no course. */
export async function getEnrollment(userId: string): Promise<Enrollment | null> {
  const { data } = await service()
    .from("staff_training_enrollments")
    .select("id, user_id, audience, organization_label, reviewer_label, coach_on, coach_tone, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  const row = data as Enrollment;
  return { ...row, coach_tone: coerceCoachTone(row.coach_tone) };
}

export async function getProgress(userId: string): Promise<Record<string, number[]>> {
  const { data } = await service().from("staff_training_progress").select("module_key, step_index, done").eq("user_id", userId);
  const out: Record<string, number[]> = {};
  for (const r of (data ?? []) as { module_key: string; step_index: number; done: boolean }[]) {
    if (r.done) (out[r.module_key] ??= []).push(r.step_index);
  }
  return out;
}

type ProfileLite = { id: string; email?: string | null };

/**
 * Enrollment for this user. If they have none but an open invitation exists for their email
 * (they signed up after being invited), the invitation is accepted now and they are enrolled.
 */
export async function getOrClaimEnrollment(profile: ProfileLite): Promise<Enrollment | null> {
  const existing = await getEnrollment(profile.id);
  if (existing || !profile.email) return existing;
  const db = service();
  const { data } = await db
    .from("staff_training_invites")
    .select("id, email, audience, organization_label, reviewer_label, coach_enabled, status, expires_at, created_at")
    .ilike("email", profile.email.trim())
    .eq("status", "invited")
    .limit(20);
  const invite = pickClaimableInvite((data ?? []) as (ClaimableInvite & {
    audience: TrainingAudience; organization_label: string; reviewer_label: string; coach_enabled: boolean;
  })[], profile.email);
  if (!invite) return null;
  // Single use: only flip an invite that is still "invited".
  const { data: flipped } = await db.from("staff_training_invites")
    .update({ status: "accepted", accepted_by: profile.id, accepted_at: new Date().toISOString() })
    .eq("id", invite.id).eq("status", "invited").select("id");
  if (!flipped || flipped.length === 0) return getEnrollment(profile.id);
  await db.from("staff_training_enrollments").upsert({
    user_id: profile.id, invite_id: invite.id, audience: invite.audience,
    organization_label: invite.organization_label, reviewer_label: invite.reviewer_label,
    coach_on: invite.coach_enabled, status: "active",
  }, { onConflict: "user_id" });
  return getEnrollment(profile.id);
}
