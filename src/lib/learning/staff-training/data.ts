import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { coerceCoachTone, type CoachTone } from "@/lib/learning/coach/tones";
import type { TrainingAudience } from "./catalog";

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
