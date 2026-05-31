"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FounderClassAssistant } from "@/components/FounderClassAssistant";
import { courseHref } from "@/lib/learning/course-keys";
import type { Course } from "@/lib/learning/course-types";
import type { CourseLesson, CourseSection } from "@/lib/learning/course-types";
import type { FounderLessonProgressRecord } from "@/lib/learning/types";

type CurriculumItem = {
  section: CourseSection;
  lessons: {
    lesson: CourseLesson;
    completed: boolean;
    inProgress: boolean;
  }[];
};

export function FounderClassLessonExperience({
  course,
  lesson,
  sectionTitle,
  curriculum,
  lessonIndex,
  lessonTotal,
  initialProgress,
  prevHref,
  nextHref,
}: Readonly<{
  course: Course;
  lesson: CourseLesson;
  sectionTitle: string;
  curriculum: CurriculumItem[];
  lessonIndex: number;
  lessonTotal: number;
  initialProgress: FounderLessonProgressRecord | null;
  prevHref: string | null;
  nextHref: string | null;
}>) {
  const router = useRouter();
  const [completed, setCompleted] = useState(initialProgress?.status === "completed");
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean } | null>(
    initialProgress?.quiz_score != null
      ? { score: initialProgress.quiz_score, passed: Boolean(initialProgress.quiz_passed) }
      : null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const quizRequired = lesson.type === "quiz" || Boolean(lesson.quiz?.questions.length);
  const canComplete = !quizRequired || (quizResult?.passed ?? false);

  async function submitQuiz() {
    setSaving(true);
    setError(null);
    const response = await fetch("/api/founder/learning/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "quiz",
        courseSlug: course.slug,
        lessonSlug: lesson.slug,
        answers: quizAnswers,
      }),
    });
    setSaving(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Quiz submission failed.");
      return;
    }
    const body = (await response.json()) as { score: number; passed: boolean };
    setQuizResult(body);
    if (body.passed) {
      setCompleted(true);
      router.refresh();
    }
  }

  async function markComplete() {
    if (!canComplete) {
      setError("Complete the quiz before marking this lesson done.");
      return;
    }
    setSaving(true);
    setError(null);
    const response = await fetch("/api/founder/learning/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        courseSlug: course.slug,
        lessonSlug: lesson.slug,
        quizPassed: quizResult?.passed ?? null,
        quizScore: quizResult?.score ?? null,
      }),
    });
    setSaving(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Unable to save progress.");
      return;
    }
    setCompleted(true);
    router.refresh();
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-6">
      <div className="min-w-0 space-y-6">
        <nav className="text-xs text-slate-500">
          <Link href="/founder/learning" className="text-indigo-600 hover:text-indigo-500">
            Courses
          </Link>
          <span className="mx-2">/</span>
          <Link href={courseHref(course.slug)} className="text-indigo-600 hover:text-indigo-500">
            {course.title}
          </Link>
        </nav>

        <div className="relative aspect-video overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
              <span className="ml-1 text-2xl">▶</span>
            </div>
            <p className="mt-4 text-sm font-medium">Video lesson placeholder</p>
            <p className="mt-1 max-w-md px-4 text-xs text-slate-400">
              {lesson.durationMinutes} min · {lesson.type === "quiz" ? "Quiz module" : "Founder training"} · Video
              delivery in Phase 2
            </p>
          </div>
        </div>

        <header>
          <p className="text-xs font-medium text-slate-500">
            {sectionTitle} · Lesson {lessonIndex + 1} of {lessonTotal}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">{lesson.title}</h1>
        </header>

        {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        <article className="prose prose-slate max-w-none">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Lesson transcript</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700">{lesson.content}</p>
          {lesson.keyPoints && lesson.keyPoints.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {lesson.keyPoints.map((point) => (
                <li key={point} className="rounded-md bg-slate-50 px-3 py-2">
                  {point}
                </li>
              ))}
            </ul>
          ) : null}
        </article>

        {lesson.quiz && lesson.quiz.questions.length > 0 ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Lesson quiz</h2>
            <p className="mt-1 text-xs text-slate-500">Passing score: {lesson.quiz.passingScore}%</p>
            <div className="mt-4 space-y-4">
              {lesson.quiz.questions.map((question) => (
                <fieldset key={question.id} className="rounded-lg border border-slate-100 p-4">
                  <legend className="text-sm font-medium text-slate-900">{question.prompt}</legend>
                  <div className="mt-3 space-y-2">
                    {question.choices.map((choice) => (
                      <label key={choice.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={question.id}
                          checked={quizAnswers[question.id] === choice.id}
                          onChange={() =>
                            setQuizAnswers((prev) => ({ ...prev, [question.id]: choice.id }))
                          }
                        />
                        {choice.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitQuiz()}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                Submit quiz
              </button>
              {quizResult ? (
                <p className={`text-sm font-medium ${quizResult.passed ? "text-emerald-700" : "text-amber-800"}`}>
                  Score: {quizResult.score}% — {quizResult.passed ? "Passed" : "Review and retry"}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="rounded-xl border border-dashed border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-800">Notes</h2>
          <p className="mt-1 text-xs text-slate-500">Saved locally in this session (cloud notes in Phase 2).</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="mt-3 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            placeholder="Your lesson notes…"
          />
        </section>

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-sm font-semibold text-slate-800">Resources & downloads</h2>
          <p className="mt-2 text-sm text-slate-600">
            Worksheet and template downloads — available in a future release. Use your document room for investor
            materials in the meantime.
          </p>
        </section>

        <FounderClassAssistant courseSlug={course.slug} lessonSlug={lesson.slug} />

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            disabled={saving || completed || !canComplete}
            onClick={() => void markComplete()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {completed ? "Lesson complete" : "Mark lesson complete"}
          </button>
          {prevHref ? (
            <Link href={prevHref} className="text-sm font-medium text-slate-600 hover:text-slate-900">
              ← Previous
            </Link>
          ) : null}
          {nextHref ? (
            <Link href={nextHref} className="text-sm font-medium text-indigo-600">
              Next →
            </Link>
          ) : null}
        </div>

        <p className="text-xs text-slate-500">
          Educational course only — not legal, tax, securities, or investment advice. No funding guarantees or investor
          approval claims.
        </p>
      </div>

      <aside className="mt-6 lg:mt-0">
        <div className="sticky top-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Course content</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{course.title}</p>
          <div className="mt-4 max-h-[70vh] space-y-4 overflow-y-auto text-sm">
            {curriculum.map(({ section, lessons }) => (
              <div key={section.slug}>
                <p className="font-medium text-slate-800">{section.title}</p>
                <ul className="mt-2 space-y-1">
                  {lessons.map(({ lesson: item, completed: done }) => {
                    const active = item.slug === lesson.slug;
                    return (
                      <li key={item.slug}>
                        <Link
                          href={`/founder/learning/${course.slug}/${item.slug}`}
                          className={`block rounded-md px-2 py-1.5 ${
                            active
                              ? "bg-indigo-50 font-medium text-indigo-900"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <span className="line-clamp-2">{item.title}</span>
                          <span className="text-[10px] text-slate-400">
                            {item.durationMinutes}m{done ? " · ✓" : ""}
                            {item.type === "quiz" ? " · Quiz" : ""}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
