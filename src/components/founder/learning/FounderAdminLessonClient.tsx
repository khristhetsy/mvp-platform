"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
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
  const t = useTranslations("founderCmp");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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
    if (loading) return; // prevent double-call from video progress events
    setLoading(true);
    try {
      const res = await fetch(
        `/api/founder/learning/admin-courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moduleSlug, lessonKey }),
        },
      );
      if (res.ok) router.refresh();
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
            title={t("lesson_slides")}
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
    </div>
  );
}
