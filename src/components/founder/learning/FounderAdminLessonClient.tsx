"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatApiError } from "@/lib/api/errors";
import type { VideoSlide } from "@/lib/learning/video/video-types";
import { LessonNotes } from "@/components/founder/learning/LessonNotes";
import { LessonVideoPlayer } from "@/components/founder/learning/LessonVideoPlayer";

type SidebarLesson = { id: string; title: string; estimatedMinutes: number };
type SidebarModule = { title: string; lessons: SidebarLesson[] };

export function FounderAdminLessonClient({
  courseId,
  lessonId,
  moduleSlug,
  lessonKey,
  courseSlug,
  lessonSlug,
  lessonTitle,
  estimatedMinutes,
  lessonContent,
  videoUrl,
  slideDeckUrl,
  initialPositionSeconds,
  slides,
  courseTitle,
  sidebarModules,
  currentLessonId,
}: {
  courseId: string;
  lessonId: string;
  moduleSlug: string;
  lessonKey: string;
  courseSlug: string;
  lessonSlug: string;
  lessonTitle: string;
  estimatedMinutes: number;
  lessonContent?: string;
  videoUrl?: string;
  slideDeckUrl?: string;
  initialPositionSeconds?: number;
  slides?: VideoSlide[];
  courseTitle: string;
  sidebarModules: SidebarModule[];
  currentLessonId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function markComplete() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(
        `/api/founder/learning/admin-courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moduleSlug, lessonKey }),
        },
      );
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw json;
      setSuccess(json?.certificateIssued ? "Lesson completed. Certificate issued." : "Lesson completed.");
      router.refresh();
    } catch (e) {
      setError(formatApiError(e, "Unable to mark lesson complete."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-6">
      <div className="min-w-0 space-y-6">
        {videoUrl ? (
          <LessonVideoPlayer
            videoUrl={videoUrl}
            initialPositionSeconds={initialPositionSeconds}
            slides={slides}
            courseSlug={courseSlug}
            lessonSlug={lessonSlug}
            onProgress={(percent) => {
              if (percent >= 90) void markComplete();
            }}
          />
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl bg-slate-900">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/10">
              <svg className="ml-0.5 h-4 w-4 text-white/80" fill="currentColor" viewBox="0 0 16 16">
                <path d="M6 3.5l8 4.5-8 4.5V3.5z" />
              </svg>
            </div>
            <p className="text-sm text-white/70">{lessonTitle}</p>
            <p className="text-xs text-white/40">{estimatedMinutes} min · Video coming soon</p>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 flex items-center justify-between text-sm text-slate-600">
          <span>CapitalOS video lessons are educational only and do not constitute legal, tax, investment, securities, or fundraising advice.</span>
          <span className="ml-4 shrink-0 text-xs font-medium text-slate-400">» Coming soon</span>
        </div>

        <header>
          <p className="text-xs font-medium text-slate-500">
            {lessonTitle}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">{lessonTitle}</h1>
        </header>

        {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        {success ? <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p> : null}

        {slideDeckUrl ? (
          <div>
            <iframe
              src={slideDeckUrl}
              className="w-full rounded-xl border border-slate-200"
              style={{ height: "480px" }}
              title="Lesson slides"
            />
            <a href={slideDeckUrl} download className="mt-2 inline-block text-xs font-semibold text-indigo-600">
              Download slides
            </a>
          </div>
        ) : null}

        <article className="prose prose-slate max-w-none">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Lesson Transcript</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700">{lessonContent ?? ""}</p>
        </article>

        <LessonNotes moduleSlug={moduleSlug} lessonId={lessonKey} />

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => void markComplete()}
            disabled={loading}
            className="rounded-md bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-60"
          >
            {loading ? "Saving…" : "Mark lesson complete"}
          </button>
          <Link
            href={`/founder/learning/courses/${courseId}`}
            className="text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            ← Back to course
          </Link>
        </div>

        <p className="text-xs text-slate-500">
          Educational course only — not legal, tax, securities, or investment advice. No funding guarantees or investor
          approval claims.
        </p>
      </div>

      <aside className="mt-6 lg:mt-0">
        <div className="sticky top-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Course content</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{courseTitle}</p>
          <div className="mt-4 max-h-[70vh] space-y-4 overflow-y-auto text-sm">
            {sidebarModules.map(({ title, lessons }) => (
              <div key={title}>
                <p className="font-medium text-slate-800">{title}</p>
                <ul className="mt-2 space-y-1">
                  {lessons.map((item) => {
                    const active = item.id === currentLessonId;
                    return (
                      <li key={item.id}>
                        <Link
                          href={`/founder/learning/courses/${courseId}/lessons/${item.id}`}
                          className={`block rounded-md px-2 py-1.5 ${
                            active
                              ? "bg-[var(--blue-muted)] font-medium text-[var(--blue)]"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <span className="line-clamp-2">{item.title}</span>
                          <span className="text-[10px] text-slate-400">{item.estimatedMinutes}m</span>
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
