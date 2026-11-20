import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Invitation only courses. A course is open to everyone unless its access_mode is "invite_only";
 * then only people on its access list (an active staff_training_enrollments row tied to the course) can see it.
 */
export type CourseAccessMode = "open" | "invite_only";

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

/** Programs this person has an active access row for. */
export async function enrolledProgramIds(userId: string | null | undefined): Promise<Set<string>> {
  if (!userId) return new Set();
  const { data } = await db().from("staff_training_enrollments").select("program_id").eq("user_id", userId).eq("status", "active");
  return new Set(((data ?? []) as Array<{ program_id: string | null }>).map((r) => r.program_id).filter((v): v is string => Boolean(v)));
}

/** True when the course is open, or the person is on its access list. */
export async function mayTakeCourse(course: { id: string; access_mode?: string | null }, userId: string | null | undefined): Promise<boolean> {
  if (course.access_mode !== "invite_only") return true;
  return (await enrolledProgramIds(userId)).has(course.id);
}

/** The Training course, for menu links and redirects. */
export async function getTrainingProgramId(): Promise<string | null> {
  const { data } = await db().from("learning_programs").select("id").eq("slug", "training").maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}
