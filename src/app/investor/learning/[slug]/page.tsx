import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCourseBySlug, courseLessonCount, courseDurationMinutes, formatCourseDuration } from "@/lib/learning/courses";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorCoursePage({
  params,
}: Readonly<{ params: Promise<{ slug: string }> }>) {
  await requireRole(["investor", "admin", "analyst"]);
  const t = await getTranslations("appPages");
  const { slug } = await params;

  const course = getCourseBySlug(slug);
  if (!course) notFound();

  const lessonCount = courseLessonCount(course);
  const duration = formatCourseDuration(courseDurationMinutes(course));

  return (
    <div className="space-y-8 pb-16">
      {/* Hero */}
      <div className={`rounded-2xl bg-gradient-to-br ${course.thumbnailAccent} p-8 text-white`}>
        <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
          {course.category} · {course.level}
        </p>
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{course.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/90">{course.longDescription}</p>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/80">
          <span>{lessonCount} lessons</span>
          <span>{duration} total</span>
          <span>By {course.instructor}</span>
        </div>
        <p className="mt-4 rounded-lg bg-white/10 px-4 py-2.5 text-xs text-white/80 max-w-xl">
          This course is part of the iCapOS founder eLearning program. Content is for founder
          training and investor preparation only — not legal, tax, securities, or investment advice.
        </p>
      </div>

      {/* What you'll learn */}
      {course.whatYouWillLearn && course.whatYouWillLearn.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">{t("what_founders_learn_in_this_course")}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {course.whatYouWillLearn.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="mt-0.5 text-emerald-500">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Curriculum */}
      <div>
        <h2 className="text-base font-semibold text-slate-900">{t("course_curriculum")}</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Educational content only — not legal, tax, or investment advice.
        </p>
        <div className="mt-4 space-y-4">
          {course.sections.map((section) => (
            <div key={section.slug} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5">
                <h3 className="text-sm font-semibold text-slate-800">{section.title}</h3>
              </div>
              <ul className="divide-y divide-slate-100">
                {section.lessons.map((lesson, idx) => (
                  <li key={lesson.slug} className="flex items-start gap-3 px-5 py-3.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-medium text-slate-500 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">{lesson.title}</p>
                      {lesson.content && (
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-500 line-clamp-2">
                          {lesson.content}
                        </p>
                      )}
                      {lesson.keyPoints && lesson.keyPoints.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {lesson.keyPoints.map((kp, ki) => (
                            <li key={ki} className="flex items-start gap-1.5 text-xs text-slate-500">
                              <span className="text-indigo-400 mt-0.5">·</span>
                              {kp}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">{lesson.durationMinutes}m</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-6">
        <Link
          href="/investor/opportunities"
          className="text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          ← Back to opportunities
        </Link>
        <p className="text-xs text-slate-400">
          Founder eLearning · View only
        </p>
      </div>
    </div>
  );
}
