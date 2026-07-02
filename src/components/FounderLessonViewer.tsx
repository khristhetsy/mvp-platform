"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FloatingFounderAICoach } from "@/components/FloatingFounderAICoach";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { FounderLessonProgressRecord, LearningLesson } from "@/lib/learning/types";
import { encodeLessonKey } from "@/lib/learning/lesson-keys";

export function FounderLessonViewer({
  programSlug,
  programTitle,
  moduleSlug,
  moduleTitle,
  lesson,
  lessonIndex,
  lessonCount,
  lessonKey,
  initialProgress,
  prevHref,
  nextHref,
}: Readonly<{
  programSlug: string;
  programTitle: string;
  moduleSlug: string;
  moduleTitle: string;
  lesson: LearningLesson;
  lessonIndex: number;
  lessonCount: number;
  lessonKey: string;
  initialProgress: FounderLessonProgressRecord | null;
  prevHref: string | null;
  nextHref: string | null;
}>) {
  const t = useTranslations("sharedCmp");
  const router = useRouter();
  const [completed, setCompleted] = useState(initialProgress?.status === "completed");
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean } | null>(
    initialProgress?.quiz_score != null
      ? {
          score: initialProgress.quiz_score,
          passed: Boolean(initialProgress.quiz_passed),
        }
      : null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  const quizRequired = Boolean(lesson.quiz?.questions.length);
  const quizPassed = quizResult?.passed ?? false;
  const canComplete = !quizRequired || quizPassed;

  const durationLabel = useMemo(() => {
    const mins = lesson.estimatedMinutes ?? 12;
    return `${mins} min`;
  }, [lesson.estimatedMinutes]);

  async function submitQuiz() {
    setSaving(true);
    setError(null);
    const response = await fetch("/api/founder/learning/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "quiz", lessonKey, answers: quizAnswers }),
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
      setCelebrating(true);
      router.refresh();
    }
  }

  async function markComplete() {
    if (!canComplete) {
      setError("Pass the readiness check quiz before marking this lesson complete.");
      return;
    }
    setSaving(true);
    setError(null);
    const response = await fetch("/api/founder/learning/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        lessonKey,
        quizPassed: quizResult?.passed ?? null,
        quizScore: quizResult?.score ?? null,
      }),
    });
    setSaving(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Unable to save completion.");
      return;
    }
    setCompleted(true);
    setCelebrating(true);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <nav className="text-xs text-slate-500">
        <Link href="/founder/learning" className="font-medium text-indigo-600 hover:text-indigo-500">
          Learning
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/founder/learning/${programSlug}`} className="font-medium text-indigo-600 hover:text-indigo-500">
          {programTitle}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700">{moduleTitle}</span>
      </nav>

      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-[var(--shadow-panel)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Lesson {lessonIndex + 1} of {lessonCount}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">{lesson.title}</h1>
            <p className="mt-2 text-sm text-slate-600">{durationLabel} estimated · Investor preparation lesson</p>
          </div>
          <StatusBadge
            label={completed ? "Readiness milestone" : "In progress"}
            status={completed ? "success" : "neutral"}
            dot
          />
        </div>
      </header>

      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      {celebrating || completed ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">{t("readiness_milestone_reached")}</p>
          <h2 className="mt-1 text-lg font-semibold text-emerald-950">{t("lesson_complete_nice_work")}</h2>
          <p className="mt-2 text-sm text-emerald-900">
            Your progress is saved. Badges and module completion update automatically.
          </p>
          {nextHref ? (
            <Link
              href={nextHref}
              className="mt-4 inline-flex rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
            >
              Continue to next lesson →
            </Link>
          ) : (
            <Link
              href={`/founder/learning/${programSlug}`}
              className="mt-4 inline-flex rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
            >
              Back to program
            </Link>
          )}
        </section>
      ) : null}

      <WorkspacePanel title={t("learning_objective")} subtitle={t("institutional_readiness_focus")}>
        <p className="text-sm leading-6 text-slate-700">{lesson.learningObjective}</p>
      </WorkspacePanel>

      <WorkspacePanel title={t("lesson_content")} subtitle={t("core_material")}>
        <p className="text-sm leading-7 text-slate-700">{lesson.summary}</p>
        <ul className="mt-4 space-y-2">
          {lesson.keyPoints.map((point) => (
            <li key={point} className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-800">
              {point}
            </li>
          ))}
        </ul>
      </WorkspacePanel>

      {lesson.takeaways && lesson.takeaways.length > 0 ? (
        <WorkspacePanel title={t("key_takeaways")} subtitle={t("apply_on_the_platform")}>
          <ul className="space-y-1 text-sm text-slate-700">
            {lesson.takeaways.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </WorkspacePanel>
      ) : null}

      {lesson.readinessImpact ? (
        <section className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800">{t("readiness_score_impact")}</p>
          <p className="mt-2 text-sm text-indigo-950">{lesson.readinessImpact.description}</p>
          <p className="mt-2 text-xs text-indigo-800">
            Categories: {lesson.readinessImpact.categories.join(" · ")} · Platform signal +{lesson.readinessImpact.points}
          </p>
        </section>
      ) : null}

      {lesson.founderAction ? (
        <WorkspacePanel title={t("founder_action")} subtitle={t("operational_task")}>
          <p className="text-sm font-medium text-slate-900">{lesson.founderAction.label}</p>
          <p className="mt-1 text-sm text-slate-600">{lesson.founderAction.description}</p>
          {lesson.founderAction.href ? (
            <Link
              href={lesson.founderAction.href}
              className="mt-3 inline-flex rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Open workspace task
            </Link>
          ) : null}
        </WorkspacePanel>
      ) : null}

      {lesson.relatedChecklist ? (
        <WorkspacePanel title={t("related_checklist")} subtitle={t("diligence_preparation")}>
          <p className="text-sm text-slate-700">{lesson.relatedChecklist}</p>
        </WorkspacePanel>
      ) : null}

      {lesson.resourcePlaceholder ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-500">
          {lesson.resourcePlaceholder}
        </p>
      ) : null}

      {lesson.quiz && lesson.quiz.questions.length > 0 ? (
        <WorkspacePanel title={t("readiness_check")} subtitle={`Passing score ${lesson.quiz.passingScore}%`}>
          <div className="space-y-4">
            {lesson.quiz.questions.map((question) => (
              <fieldset key={question.id} className="rounded-lg border border-slate-100 p-4">
                <legend className="text-sm font-medium text-slate-900">{question.prompt}</legend>
                <div className="mt-3 space-y-2">
                  {question.choices.map((choice) => (
                    <label key={choice.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name={question.id}
                        value={choice.id}
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
              <p
                className={`text-sm font-medium ${quizResult.passed ? "text-emerald-700" : "text-amber-800"}`}
              >
                Score: {quizResult.score}% — {quizResult.passed ? "Passed" : "Review material and retry"}
              </p>
            ) : null}
          </div>
        </WorkspacePanel>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving || completed || !canComplete}
          onClick={() => void markComplete()}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {completed ? "Lesson completed" : "Mark readiness milestone"}
        </button>
        {prevHref ? (
          <Link href={prevHref} className="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← Previous lesson
          </Link>
        ) : null}
        {nextHref ? (
          <Link href={nextHref} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            Next lesson →
          </Link>
        ) : null}
      </div>

      <p className="text-xs text-slate-500">
        Platform readiness progress only — not legal, investment, or compliance certification. Lesson key:{" "}
        {encodeLessonKey(moduleSlug, lesson.id)}
      </p>
      <FloatingFounderAICoach courseSlug={moduleSlug} lessonSlug={lesson.id} />
    </div>
  );
}
