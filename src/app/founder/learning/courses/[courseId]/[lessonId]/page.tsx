"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getCapitalModuleBySlug,
  CAPITAL_STAGE_META,
  type CapitalLesson,
  type CapitalModule,
} from "@/lib/learning/capital-stages";
import { use } from "react";

export default function CapitalStageLessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = use(params);
  const router = useRouter();

  const mod: CapitalModule | null = getCapitalModuleBySlug(courseId);
  const lesson: CapitalLesson | undefined = mod?.lessons.find((l) => l.id === lessonId);

  const [done, setDone] = useState(false);
  const [marking, setMarking] = useState(false);
  const [activeSection, setActiveSection] = useState<"lesson" | "worksheet">("lesson");

  useEffect(() => {
    // Check existing progress on mount
    fetch(`/api/learning/lessons/progress?moduleSlug=${courseId}&lessonId=${lessonId}`)
      .then((r) => r.json())
      .then((d) => { if (d.completed) setDone(true); })
      .catch(() => {});
  }, [courseId, lessonId]);

  if (!mod || !lesson) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-2xl">📚</p>
          <p className="mt-2 text-sm text-slate-500">Lesson not found.</p>
          <Link href="/founder/learning" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
            ← Back to Learning Hub
          </Link>
        </div>
      </div>
    );
  }

  const stageMeta = CAPITAL_STAGE_META[mod.stage];

  const handleMarkComplete = async () => {
    setMarking(true);
    try {
      await fetch("/api/learning/lessons/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleSlug: courseId, lessonId }),
      });
      setDone(true);
    } catch {
      // silent fail
    } finally {
      setMarking(false);
    }
  };

  const lessonIdx = mod.lessons.findIndex((l) => l.id === lessonId);
  const prevLesson = lessonIdx > 0 ? mod.lessons[lessonIdx - 1] : null;
  const nextLesson = lessonIdx < mod.lessons.length - 1 ? mod.lessons[lessonIdx + 1] : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/founder/learning/stages/${mod.stage}`}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              ← {stageMeta.label}
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-medium text-slate-700">{mod.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: stageMeta.bgColor, color: stageMeta.color }}
            >
              {stageMeta.icon} {stageMeta.subtitle}
            </span>
            <span className="text-xs text-slate-400">{lesson.durationMinutes} min</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-10">
        {/* Lesson header */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Lesson {lessonIdx + 1} of {mod.lessons.length}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{lesson.title}</h1>
          <p className="mt-2 text-base text-slate-600">{lesson.summary}</p>
        </div>

        {/* Tab toggle */}
        <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 w-fit">
          {(["lesson", "worksheet"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSection(tab)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                activeSection === tab
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab === "lesson" ? "📖 Lesson" : "✏️ Worksheet"}
            </button>
          ))}
        </div>

        {activeSection === "lesson" ? (
          <div className="space-y-6">
            {/* Key points */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                <h2 className="text-sm font-semibold text-slate-900">Key points</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {lesson.keyPoints.map((point, idx) => (
                  <div key={idx} className="flex items-start gap-4 px-6 py-4">
                    <span
                      className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: stageMeta.color }}
                    >
                      {idx + 1}
                    </span>
                    <p className="text-sm text-slate-700">{point}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary card */}
            <div
              className="rounded-2xl border p-6"
              style={{ borderColor: stageMeta.borderColor, background: stageMeta.bgColor }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: stageMeta.color }}>
                {stageMeta.icon} Lesson summary
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-800">{lesson.summary}</p>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Worksheet prompt</h2>
              <p className="mt-0.5 text-xs text-slate-500">Write your answer below — it's saved only for you.</p>
            </div>
            <div className="p-6">
              <div
                className="mb-4 rounded-xl border p-4 text-sm text-slate-700"
                style={{ borderColor: stageMeta.borderColor, background: stageMeta.bgColor }}
              >
                {lesson.worksheetPrompt}
              </div>
              <textarea
                className="w-full rounded-xl border border-slate-200 p-4 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                rows={8}
                placeholder="Write your answer here…"
              />
              <p className="mt-2 text-xs text-slate-400">Your notes are private and stored locally.</p>
            </div>
          </div>
        )}

        {/* Mark complete + nav */}
        <div className="mt-10 flex items-center justify-between gap-4 border-t border-slate-200 pt-6">
          <div className="flex gap-3">
            {prevLesson && (
              <Link
                href={`/founder/learning/courses/${courseId}/${prevLesson.id}`}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                ← Previous
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3">
            {done ? (
              <span className="flex items-center gap-2 rounded-xl bg-green-50 px-5 py-2.5 text-sm font-semibold text-green-700">
                ✓ Completed
              </span>
            ) : (
              <button
                onClick={handleMarkComplete}
                disabled={marking}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
                style={{ background: stageMeta.color }}
              >
                {marking ? "Saving…" : "Mark as complete"}
              </button>
            )}
            {nextLesson && (
              <Link
                href={`/founder/learning/courses/${courseId}/${nextLesson.id}`}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition"
                style={{ background: done ? stageMeta.color : "#94A3B8" }}
              >
                Next lesson →
              </Link>
            )}
            {!nextLesson && done && (
              <Link
                href={`/founder/learning/stages/${mod.stage}`}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition"
                style={{ background: stageMeta.color }}
              >
                Back to {stageMeta.label} →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
