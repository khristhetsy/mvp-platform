"use client";

import { useCallback, useState } from "react";
import { FounderVideoCaptionsPanel } from "@/components/FounderVideoCaptionsPanel";
import { FounderVideoScriptPanel } from "@/components/FounderVideoScriptPanel";
import { FounderVideoSlidesPanel } from "@/components/FounderVideoSlidesPanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { FounderLessonVideoAssetRecord } from "@/lib/learning/video/video-types";
import { VIDEO_LESSON_DISCLAIMER } from "@/lib/learning/video/video-types";

type VideoTab = "video" | "script" | "captions" | "slides";

function statusLabel(status: FounderLessonVideoAssetRecord["render_status"]) {
  switch (status) {
    case "script_ready":
      return "Script ready";
    case "rendering":
      return "Preparing video";
    case "ready":
      return "Video ready";
    case "failed":
      return "Render failed";
    default:
      return "Draft";
  }
}

function statusVariant(status: FounderLessonVideoAssetRecord["render_status"]) {
  if (status === "ready") return "success" as const;
  if (status === "rendering") return "warning" as const;
  if (status === "failed") return "danger" as const;
  if (status === "script_ready") return "info" as const;
  return "neutral" as const;
}

export function FounderAIVideoLesson({
  courseSlug,
  lessonSlug,
  lessonTitle,
  durationMinutes,
  initialAsset,
}: Readonly<{
  courseSlug: string;
  lessonSlug: string;
  lessonTitle: string;
  durationMinutes: number;
  initialAsset: FounderLessonVideoAssetRecord | null;
}>) {
  const [asset, setAsset] = useState<FounderLessonVideoAssetRecord | null>(initialAsset);
  const [tab, setTab] = useState<VideoTab>("video");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const hasScript = Boolean(asset?.script);
  const showVideo = asset?.render_status === "ready" && asset.video_url;

  const generateScript = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    const response = await fetch("/api/founder/learning/video-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug, lessonSlug }),
    });
    setLoading(false);
    const body = (await response.json().catch(() => null)) as {
      asset?: FounderLessonVideoAssetRecord;
      error?: string;
      warning?: string;
      openAiConfigured?: boolean;
    } | null;
    if (!response.ok || !body?.asset) {
      setError(body?.error ?? "Script generation failed.");
      return;
    }
    setAsset(body.asset);
    setTab("script");
    if (body.warning) setNotice(body.warning);
    else if (!body.openAiConfigured) {
      setNotice("Guided script mode — OpenAI not configured. Rule-based script generated.");
    }
  }, [courseSlug, lessonSlug]);

  const prepareVideo = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    const response = await fetch("/api/founder/learning/video-metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug, lessonSlug, action: "prepare_video" }),
    });
    setLoading(false);
    const body = (await response.json().catch(() => null)) as {
      asset?: FounderLessonVideoAssetRecord;
      error?: string;
      message?: string;
    } | null;
    if (!response.ok || !body?.asset) {
      setError(body?.error ?? "Could not prepare video.");
      return;
    }
    setAsset(body.asset);
    setTab("video");
    setNotice(body.message ?? "AI video lesson is being prepared.");
  }, [courseSlug, lessonSlug]);

  const tabs: { id: VideoTab; label: string }[] = [
    { id: "video", label: "Video" },
    { id: "script", label: "Script" },
    { id: "captions", label: "Captions" },
    { id: "slides", label: "Slides" },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-panel)]">
      <div className="relative aspect-video bg-slate-950">
        {showVideo ? (
          <video
            className="h-full w-full"
            controls
            src={asset.video_url ?? undefined}
            title={lessonTitle}
          >
            <track kind="captions" />
          </video>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
              <span className="ml-0.5 text-xl">▶</span>
            </div>
            <p className="mt-4 text-sm font-medium">
              {asset?.render_status === "rendering"
                ? "AI video lesson is being prepared"
                : hasScript
                  ? "Script ready — video render queued for Phase 2"
                  : "AI video lesson is being prepared"}
            </p>
            <p className="mt-2 max-w-md text-xs text-slate-400">
              {lessonTitle} · {durationMinutes} min · Generate script to build narration and slides
            </p>
          </div>
        )}
      </div>

      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">AI Video Lesson</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">{VIDEO_LESSON_DISCLAIMER}</p>
          </div>
          <StatusBadge
            label={statusLabel(asset?.render_status ?? "draft")}
            status={statusVariant(asset?.render_status ?? "draft")}
            dot
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void generateScript()}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {hasScript ? "Regenerate Script" : "Generate Script"}
          </button>
          <button
            type="button"
            disabled={loading || !hasScript}
            onClick={() => void prepareVideo()}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            Prepare Video
          </button>
          {asset?.provider ? (
            <span className="self-center text-[10px] uppercase tracking-wide text-slate-400">
              Provider: {asset.provider}
            </span>
          ) : null}
        </div>

        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
        {notice ? <p className="mt-2 text-xs text-amber-800">{notice}</p> : null}
      </div>

      <div className="flex border-b border-slate-100">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-xs font-semibold ${
              tab === t.id
                ? "border-b-2 border-indigo-600 text-indigo-700"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-h-80 overflow-y-auto p-4">
        {tab === "video" ? (
          <p className="text-sm text-slate-600">
            {asset?.render_status === "rendering"
              ? "Your lesson video is queued for production. Phase 1 stores script, slides, and captions; MP4 rendering arrives in Phase 2."
              : hasScript
                ? "Use Prepare Video to queue rendering, or review Script, Captions, and Slides tabs."
                : "Generate a script to create narration, slide outline, and captions for this lesson."}
          </p>
        ) : null}
        {tab === "script" ? (
          <FounderVideoScriptPanel script={asset?.script ?? null} narrationText={asset?.narration_text ?? null} />
        ) : null}
        {tab === "captions" ? <FounderVideoCaptionsPanel captions={asset?.captions ?? null} /> : null}
        {tab === "slides" ? <FounderVideoSlidesPanel slides={asset?.slides_json ?? []} /> : null}
      </div>
    </section>
  );
}
