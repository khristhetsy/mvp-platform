/**
 * One line summary of each coached playbook for the places founders enter from: the learning
 * overview, the course catalog and the dashboard. Empty unless the coach is active for the founder.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company, Profile } from "@/lib/supabase/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCoachAccess } from "@/lib/learning/coach/access";
import { getCoachCourse } from "@/lib/learning/coach/courses";
import { MONDAY_REVIEW_SLUG, type ProgramDefinition } from "@/lib/learning/coach/program";
import { PROGRAMS } from "@/lib/learning/coach/programs";
import { coachLessonHref } from "@/lib/learning/coach/program-links";
import { loadProgramRaw, weekLine } from "@/lib/learning/coach/program-reads";
import { courseDurationMinutes, courseLessonCount } from "@/lib/learning/courses";

export type CoachedCourseSummary = {
  courseSlug: string;
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

async function summarise(program: ProgramDefinition, profile: Profile, company: Company): Promise<CoachedCourseSummary | null> {
  const course = getCoachCourse(program.courseSlug);
  if (!course) return null;
  const raw = await loadProgramRaw({ profile, company, program });
  const next = program.modules.find((m) => !raw.lessonsDone.includes(m.lessonSlug));
  const nextSlug = next?.lessonSlug ?? MONDAY_REVIEW_SLUG;
  const nextTitle = next ? (course.sections[0].lessons.find((l) => l.slug === next.lessonSlug)?.title ?? next.shortTitle) : "Monday review";
  return {
    courseSlug: program.courseSlug,
    title: course.title,
    lessonCount: courseLessonCount(course),
    lessonsDone: raw.lessonsDone.length,
    totalMinutes: courseDurationMinutes(course),
    nextLessonSlug: nextSlug,
    nextLessonTitle: nextTitle,
    nextMinutes: next?.minutes ?? program.review.minutes,
    href: coachLessonHref(program.courseSlug, nextSlug),
    line: weekLine(raw, next?.lessonSlug ?? program.modules[program.modules.length - 1].lessonSlug, program),
  };
}

/** Every coached course the founder can open right now, in program order. */
export async function loadCoachedCourseSummaries(input: { profile: Profile; company: Company | null }): Promise<CoachedCourseSummary[]> {
  if (!input.company) return [];
  const company = input.company;
  try {
    const supabase = (await createServerSupabaseClient()) as unknown as SupabaseClient;
    const out: CoachedCourseSummary[] = [];
    for (const program of PROGRAMS) {
      const access = await getCoachAccess(supabase, { founderId: input.profile.id, companyId: company.id, courseSlug: program.courseSlug }).catch(() => null);
      if (!access?.active) continue;
      const s = await summarise(program, input.profile, company).catch(() => null);
      if (s) out.push(s);
    }
    return out;
  } catch {
    return [];
  }
}

/** The first coached course the founder can open, for callers that show one line. */
export async function loadCoachedCourseSummary(input: { profile: Profile; company: Company | null }): Promise<CoachedCourseSummary | null> {
  const all = await loadCoachedCourseSummaries(input);
  return all[0] ?? null;
}
