"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { LearningModuleContent } from "@/lib/learning/types";
import type { LearningProgressRecord } from "@/lib/learning/types";

export function FounderLearningModuleViewer({
  moduleId,
  moduleSlug,
  title,
  content,
  initialProgress,
}: Readonly<{
  moduleId: string;
  moduleSlug: string;
  title: string;
  content: LearningModuleContent;
  initialProgress: LearningProgressRecord | null;
}>) {
  const router = useRouter();
  const storageKey = `learning:${moduleSlug}:lessons`;
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate lesson progress from localStorage */
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setCompletedLessonIds(JSON.parse(stored) as string[]);
      }
    } catch {
      // ignore local storage errors
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [storageKey]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const percent = useMemo(() => {
    if (content.lessons.length === 0) return 0;
    return Math.round((completedLessonIds.length / content.lessons.length) * 100);
  }, [completedLessonIds.length, content.lessons.length]);

  async function persistLessonState(nextCompleted: string[]) {
    setSaving(true);
    setError(null);

    try {
      localStorage.setItem(storageKey, JSON.stringify(nextCompleted));
    } catch {
      // localStorage is best-effort for lesson checklist UX
    }

    const response = await fetch(`/api/founder/learning/progress/${moduleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        moduleSlug,
        completedLessonIds: nextCompleted,
      }),
    });

    setSaving(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Unable to save progress.");
      return;
    }

    router.refresh();
  }

  function toggleLesson(lessonId: string) {
    const next = completedLessonIds.includes(lessonId)
      ? completedLessonIds.filter((id) => id !== lessonId)
      : [...completedLessonIds, lessonId];

    setCompletedLessonIds(next);
    void persistLessonState(next);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/founder/learning" className="text-xs font-semibold text-indigo-600 hover:text-indigo-500">
            ← Back to learning
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {percent}% complete
            {initialProgress?.status ? ` · ${initialProgress.status.replaceAll("_", " ")}` : ""}
          </p>
        </div>
        <div className="h-2 w-48 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-indigo-600" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Module objectives</p>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {content.objectives.map((objective) => (
            <li key={objective}>• {objective}</li>
          ))}
        </ul>
      </section>

      <div className="space-y-4">
        {content.lessons.map((lesson, index) => {
          const done = completedLessonIds.includes(lesson.id);

          return (
            <article key={lesson.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                    Lesson {index + 1}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">{lesson.title}</h2>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => toggleLesson(lesson.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    done
                      ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                      : "bg-slate-950 text-white hover:bg-slate-800"
                  }`}
                >
                  {done ? "Completed" : "Mark complete"}
                </button>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{lesson.summary}</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {lesson.keyPoints.map((point) => (
                  <li key={point} className="rounded-lg bg-slate-50 px-3 py-2">
                    {point}
                  </li>
                ))}
              </ul>
              {lesson.worksheetPrompt ? (
                <p className="mt-4 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 px-4 py-3 text-xs text-indigo-900">
                  <span className="font-semibold">Worksheet (future):</span> {lesson.worksheetPrompt}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>

      <p className="text-xs text-slate-500">
        Structured for future AI scripts, quizzes, worksheets, and video modules — lesson completion syncs to your
        readiness progression.
      </p>
    </div>
  );
}
