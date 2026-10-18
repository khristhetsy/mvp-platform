import type { Course, CourseLesson, CoachStep } from "@/lib/learning/course-types";
import { OUTREACH_PLAYBOOK } from "@/lib/learning/outreach-playbook";

/** Courses in the coach format. Other courses join once their lessons have steps. */
export const COACH_COURSES: Course[] = [OUTREACH_PLAYBOOK];

export function getCoachCourse(slug: string): Course | null {
  return COACH_COURSES.find((c) => c.slug === slug) ?? null;
}

export function getCoachLesson(courseSlug: string, lessonSlug: string): { course: Course; lesson: CourseLesson; steps: CoachStep[] } | null {
  const course = getCoachCourse(courseSlug);
  if (!course) return null;
  for (const section of course.sections) {
    const lesson = section.lessons.find((l) => l.slug === lessonSlug);
    if (lesson?.steps?.length) return { course, lesson, steps: lesson.steps };
  }
  return null;
}
