"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatApiError } from "@/lib/api/errors";
import type { VideoSlide } from "@/lib/learning/video/video-types";
import { LessonNotes } from "@/components/founder/learning/LessonNotes";
import { LessonVideoPlayer } from "@/components/founder/learning/LessonVideoPlayer";

type Tab = "video" | "slides" | "transcript" | "notes";

export function FounderAdminLessonClient({
  courseId,
  lessonId,
  moduleSlug,
  lessonKey,
  courseSlug,
  lessonSlug,
  lessonContent,
  videoUrl,
  slideDeckUrl,
  initialPositionSeconds,
  slides,
}: {
  courseId: string;
  lessonId: string;
  moduleSlug: string;
  lessonKey: string;
  courseSlug: string;
  lessonSlug: string;
  lessonContent?: string;
  videoUrl?: string;
  slideDeckUrl?: string;
  initialPositionSeconds?: number;
  slides?: VideoSlide[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const defaultTab: Tab = videoUrl ? "video" : slideDeckUrl ? "slides" : "transcript";
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  const tabs = useMemo(() => {
    const items: Tab[] = [];
    if (videoUrl) items.push("video");
    if (slideDeckUrl) items.push("slides");
    items.push("transcript", "notes");
    return items;
  }, [videoUrl, slideDeckUrl]);

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
    <div className="space-y-4">
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
      ) : null}

      {tabs.length > 1 ? (
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
                activeTab === tab ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      ) : null}

      {activeTab === "video" && videoUrl ? null : null}
      {activeTab === "slides" && slideDeckUrl ? (
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
      {activeTab === "transcript" ? (
        <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
          <pre className="whitespace-pre-wrap text-sm text-slate-800">{lessonContent ?? ""}</pre>
        </div>
      ) : null}
      {activeTab === "notes" ? <LessonNotes moduleSlug={moduleSlug} lessonId={lessonKey} /> : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        {error ? (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</div>
        ) : null}
        {success ? (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {success}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void markComplete()}
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Mark lesson complete"}
        </button>
      </div>
    </div>
  );
}
