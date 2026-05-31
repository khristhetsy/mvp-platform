import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { courseLessonHref } from "@/lib/learning/course-keys";
import {
  buildCourseCurriculumProgress,
  computeCoursePercentComplete,
  findContinueCourseLesson,
} from "@/lib/learning/course-progress";
import { courseDurationMinutes, courseLessonCount, formatCourseDuration } from "@/lib/learning/courses";
import type { Course } from "@/lib/learning/course-types";
import type { FounderLessonProgressRecord } from "@/lib/learning/types";

export function FounderCourseLanding({
  course,
  progressRows,
}: Readonly<{
  course: Course;
  progressRows: FounderLessonProgressRecord[];
}>) {
  const percent = computeCoursePercentComplete(course, progressRows);
  const continueLesson = findContinueCourseLesson(course, progressRows);
  const curriculum = buildCourseCurriculumProgress(course, progressRows);
  const duration = formatCourseDuration(courseDurationMinutes(course));

  return (
    <div className="space-y-8">
      <div className={`rounded-xl bg-gradient-to-br ${course.thumbnailAccent} p-8 text-white`}>
        <Link href="/founder/learning" className="text-xs font-medium text-white/80 hover:text-white">
          ← Course catalog
        </Link>
        <p className="mt-4 text-xs uppercase tracking-wide text-white/70">{course.category} · {course.level}</p>
        <h1 className="mt-2 text-3xl font-semibold">{course.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/90">{course.longDescription}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-white/80">
          <span>Instructor: {course.instructor}</span>
          <span>{duration}</span>
          <span>{courseLessonCount(course)} lessons</span>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {continueLesson ? (
            <Link
              href={continueLesson.href}
              className="rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              {percent > 0 ? "Continue course" : "Start course"}
            </Link>
          ) : null}
          <span className="text-sm text-white/90">{percent}% learning progress</span>
        </div>
        <div className="mt-3 h-2 max-w-md overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <PageHeader
        title="What you will learn"
        description="Educational outcomes for founder training — not certification or investor approval."
      />
      <ul className="grid gap-2 sm:grid-cols-2">
        {course.whatYouWillLearn.map((item) => (
          <li key={item} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            ✓ {item}
          </li>
        ))}
      </ul>

      <section>
        <h2 className="text-lg font-semibold text-slate-950">Curriculum</h2>
        <p className="mt-1 text-sm text-slate-600">Modules, lessons, and quizzes in this course.</p>
        <div className="mt-4 space-y-6">
          {curriculum.map(({ section, lessons }) => (
            <div key={section.slug} className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-900">{section.title}</h3>
              <ul className="mt-3 divide-y divide-slate-100">
                {lessons.map(({ lesson, completed, inProgress }) => (
                  <li key={lesson.slug} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={courseLessonHref(course.slug, lesson.slug)}
                        className="text-sm font-medium text-slate-900 hover:text-indigo-600"
                      >
                        {lesson.title}
                      </Link>
                      <p className="text-xs text-slate-500">{lesson.durationMinutes} min</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {lesson.type === "quiz" ? (
                        <StatusBadge label="Quiz" status="info" />
                      ) : null}
                      {completed ? (
                        <StatusBadge label="Complete" status="success" />
                      ) : inProgress ? (
                        <StatusBadge label="In progress" status="warning" />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
