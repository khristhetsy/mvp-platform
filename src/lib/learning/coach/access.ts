import type { SupabaseClient } from "@supabase/supabase-js";
import { type CoachTone, coerceCoachTone, DEFAULT_COACH_TONE } from "@/lib/learning/coach/tones";

export type CoachEnrollment = {
  id: string;
  status: "active" | "paused" | "ended";
  tone: CoachTone;
  source: string;
};

export type CoachAccess = {
  enrollment: CoachEnrollment | null;
  courseEnabled: boolean;
  /** True only when the founder is enrolled and active AND the course has the coach switched on. */
  active: boolean;
  tone: CoachTone;
};

/**
 * The coach is off unless both are true: the founder has an active enrollment, and an admin
 * enabled the coach for this course. Read with the founder's own session, so RLS applies.
 */
export async function getCoachAccess(
  client: SupabaseClient,
  input: { founderId: string; companyId: string | null; courseSlug: string },
): Promise<CoachAccess> {
  const off: CoachAccess = { enrollment: null, courseEnabled: false, active: false, tone: DEFAULT_COACH_TONE };
  if (!input.companyId) return off;

  const [enr, cfg] = await Promise.all([
    client
      .from("coach_enrollments")
      .select("id, status, tone, source")
      .eq("founder_id", input.founderId)
      .eq("company_id", input.companyId)
      .maybeSingle(),
    client.from("course_coach_config").select("enabled, tone").eq("course_key", input.courseSlug).maybeSingle(),
  ]);

  const row = enr.data as { id: string; status: CoachEnrollment["status"]; tone: string; source: string } | null;
  const config = cfg.data as { enabled: boolean; tone: string | null } | null;
  const enrollment: CoachEnrollment | null = row
    ? { id: row.id, status: row.status, tone: coerceCoachTone(row.tone), source: row.source }
    : null;
  const courseEnabled = config?.enabled === true;

  return {
    enrollment,
    courseEnabled,
    active: Boolean(enrollment && enrollment.status === "active" && courseEnabled),
    // The founder's own style wins. The course style is the fallback for a new enrollment.
    tone: enrollment?.tone ?? coerceCoachTone(config?.tone),
  };
}
