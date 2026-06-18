"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getCapitalModuleBySlug,
  CAPITAL_STAGE_META,
  type CapitalLesson,
  type CapitalModule,
} from "@/lib/learning/capital-stages";
import { use } from "react";

type DbLesson = {
  id: string;
  lesson_key: string;
  title: string;
  body_markdown: string;
  video_url: string | null;
  estimated_time_minutes: number;
};

type DbModule = {
  id: string;
  slug: string;
  title: string;
  description: string;
  lessons: DbLesson[];
};

type DbCourse = {
  id: string;
  title: string;
  video_url: string | null;
  banner_image_url: string | null;
};

function getEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

export function LessonPageClient({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = use(params);

  const mod: CapitalModule | null = getCapitalModuleBySlug(courseId);
  const lesson: CapitalLesson | undefined = mod?.lessons.find((l) => l.id === lessonId);

  const [done, setDone] = useState(false);
  const [marking, setMarking] = useState(false);
  const [activeSection, setActiveSection] = useState<"lesson" | "worksheet" | "modules">("lesson");

  // DB-synced content
  const [dbCourse, setDbCourse] = useState<DbCourse | null>(null);
  const [dbModules, setDbModules] = useState<DbModule[]>([]);
  const [dbLesson, setDbLesson] = useState<DbLesson | null>(null);

  useEffect(() => {
    fetch(`/api/learning/lessons/progress?moduleSlug=${courseId}&lessonId=${lessonId}`)
      .then((r) => r.json())
      .then((d) => { if (d.completed) setDone(true); })
      .catch(() => {});
  }, [courseId, lessonId]);

  useEffect(() => {
    fetch(`/api/learning/courses/by-slug?slug=${encodeURIComponent(courseId)}`)
      .then((r) => r.json())
      .then((d: { course: DbCourse | null; modules?: DbModule[] }) => {
        if (d.course) {
          setDbCourse(d.course);
          const mods = d.modules ?? [];
          setDbModules(mods);
          // Find lesson matching current lessonId by lesson_key
          for (const m of mods) {
            const found = m.lessons.find((l) => l.lesson_key === lessonId);
            if (found) { setDbLesson(found); break; }
          }
        }
      })
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

  // Video: prefer lesson-level, fall back to course-level
  const videoUrl = dbLesson?.video_url ?? dbCourse?.video_url ?? null;
  const embedUrl = videoUrl ? getEmbedUrl(videoUrl) : null;

  const hasModules = dbModules.length > 0;
  const tabs = [
    { key: "lesson" as const, label: "📖 Lesson" },
    { key: "worksheet" as const, label: "✏️ Worksheet" },
    ...(hasModules ? [{ key: "modules" as const, label: "🗂️ Modules" }] : []),
  ];

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

        {/* Video section — shown when admin has linked a video */}
        {embedUrl && (
          <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-sm">
            <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
              <iframe
                src={embedUrl}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={lesson.title}
              />
            </div>
            {dbCourse && (
              <div className="border-t border-slate-800 bg-slate-900 px-5 py-3 flex items-center justify-between">
                <span className="text-xs text-slate-400">From: {dbCourse.title}</span>
                {dbLesson?.video_url ? (
                  <span className="rounded-full bg-indigo-900 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                    Lesson video
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                    Course video
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Direct MP4 video */}
        {videoUrl && !embedUrl && (
          <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={videoUrl}
              controls
              className="w-full"
              style={{ maxHeight: "480px" }}
            />
          </div>
        )}

        {/* Tab toggle */}
        <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                activeSection === tab.key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Lesson tab */}
        {activeSection === "lesson" && (
          <div className="space-y-6">
            {/* DB lesson body if available */}
            {dbLesson?.body_markdown && (
              <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-white">
                <div className="border-b border-slate-100 bg-indigo-50 px-6 py-4 flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-600">
                    Course content
                  </span>
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] text-indigo-700">
                    from admin course
                  </span>
                </div>
                <div className="prose prose-sm max-w-none px-6 py-5 text-slate-700 whitespace-pre-wrap leading-relaxed text-sm">
                  {dbLesson.body_markdown}
                </div>
              </div>
            )}

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
        )}

        {/* Worksheet tab */}
        {activeSection === "worksheet" && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Worksheet prompt</h2>
              <p className="mt-0.5 text-xs text-slate-500">Write your answer below — it&apos;s saved only for you.</p>
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

        {/* Modules tab — DB admin content */}
        {activeSection === "modules" && hasModules && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Additional course modules linked by your CapitalOS team for{" "}
              <span className="font-semibold">{dbCourse?.title ?? mod.title}</span>.
            </p>
            {dbModules.map((dbMod) => (
              <div key={dbMod.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                  <h3 className="text-sm font-semibold text-slate-900">{dbMod.title}</h3>
                  {dbMod.description && (
                    <p className="mt-0.5 text-xs text-slate-500">{dbMod.description}</p>
                  )}
                </div>
                <div className="divide-y divide-slate-100">
                  {dbMod.lessons.length === 0 ? (
                    <p className="px-6 py-3 text-sm text-slate-400">No lessons yet.</p>
                  ) : (
                    dbMod.lessons.map((dl, idx) => (
                      <div key={dl.id} className="flex items-center gap-4 px-6 py-3">
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-500">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800">{dl.title}</p>
                          {dl.video_url && (
                            <span className="text-[10px] text-indigo-500">📹 Video included</span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">{dl.estimated_time_minutes}m</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
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
