/**
 * One line summary of the coached playbook for the places founders enter from: the learning
 * overview, the course catalog and the dashboard. Null unless the coach is active for the founder.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company, Profile } from "@/lib/supabase/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCoachAccess } from "@/lib/learning/coach/access";
import { OUTREACH_PLAYBOOK, OUTREACH_PLAYBOOK_SLUG } from "@/lib/learning/outreach-playbook";
import { PROGRAM_MODULES, MONDAY_REVIEW_SLUG } from "@/lib/learning/coach/program";
import { coachLessonHref } from "@/lib/learning/coach/program-links";
import { loadProgramRaw, weekLine } from "@/lib/learning/coach/program-reads";
import { courseDurationMinutes, courseLessonCount } from "@/lib/learning/courses";

export type CoachedCourseSummary = {
  title: string;
  lessonCount: number;
  lessonsDone: number;
  totalMinutes: number;
  nextLessonSlug: string;
  nextLessonTitle: string;
  nextMinutes: number;
  href: string;
  /** Where the founder is this week and the next step, from their own numbers. */
  line: string;
};

export async function loadCoachedCourseSummary(input: { profile: Profile; company: Company | null }): Promise<CoachedCourseSummary | null> {
  if (!input.company) return null;
  try {
    const supabase = (await createServerSupabaseClient()) as unknown as SupabaseClient;
    const access = await getCoachAccess(supabase, { founderId: input.profile.id, companyId: input.company.id, courseSlug: OUTREACH_PLAYBOOK_SLUG });
    if (!access.active) return null;
    const raw = await loadProgramRaw({ profile: input.profile, company: input.company });
    const next = PROGRAM_MODULES.find((m) => !raw.lessonsDone.includes(m.lessonSlug));
    const nextSlug = next?.lessonSlug ?? MONDAY_REVIEW_SLUG;
    const nextTitle = next ? OUTREACH_PLAYBOOK.sections[0].lessons.find((l) => l.slug === next.lessonSlug)?.title ?? next.shortTitle : "Monday review";
    return {
      title: OUTREACH_PLAYBOOK.title,
      lessonCount: courseLessonCount(OUTREACH_PLAYBOOK),
      lessonsDone: raw.lessonsDone.length,
      totalMinutes: courseDurationMinutes(OUTREACH_PLAYBOOK),
      nextLessonSlug: nextSlug,
      nextLessonTitle: nextTitle,
      nextMinutes: next?.minutes ?? 5,
      href: coachLessonHref(OUTREACH_PLAYBOOK_SLUG, nextSlug),
      line: weekLine(raw, next?.lessonSlug ?? "plan-goals"),
    };
  } catch {
    return null;
  }
}
