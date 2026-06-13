"use client";

import { useCallback, useRef, useState } from "react";
import { FounderVideoCaptionsPanel } from "@/components/FounderVideoCaptionsPanel";
import { FounderVideoScriptPanel } from "@/components/FounderVideoScriptPanel";
import { FounderVideoSlidesPanel } from "@/components/FounderVideoSlidesPanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { FounderLessonVideoAssetRecord, VideoRenderStatus } from "@/lib/learning/video/video-types";
import { VIDEO_LESSON_DISCLAIMER } from "@/lib/learning/video/video-types";

type VideoTab = "video" | "script" | "captions" | "slides";

const ACCEPTED_VIDEO = "video/mp4,video/webm";

function statusLabel(status: FounderLessonVideoAssetRecord["render_status"]) {
  switch (status) {
    case "script_ready":
      return "Script ready";
    case "rendering":
      return "Metadata queued";
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
  companyId,
  initialAsset,
  initialPlaybackUrl,
  viewOnly = false,
}: Readonly<{
  courseSlug: string;
  lessonSlug: string;
  lessonTitle: string;
  durationMinutes: number;
  companyId: string;
  initialAsset: FounderLessonVideoAssetRecord | null;
  initialPlaybackUrl: string | null;
  viewOnly?: boolean;
}>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [asset, setAsset] = useState<FounderLessonVideoAssetRecord | null>(initialAsset);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(initialPlaybackUrl);
  const [tab, setTab] = useState<VideoTab>("video");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const renderStatus = asset?.render_status ?? "draft";
  const hasScript = Boolean(asset?.script);
  const hasUploadedVideo = renderStatus === "ready" && Boolean(playbackUrl);
  const canPlayVideo = hasUploadedVideo;
  const showPhase1Panel = !canPlayVideo;

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
      claudeConfigured?: boolean;
    } | null;
    if (!response.ok || !body?.asset) {
      setError(body?.error ?? "Script generation failed.");
      return;
    }
    setAsset(body.asset);
    setTab("script");
    if (body.warning) setNotice(body.warning);
    else if (!body.claudeConfigured) {
      setNotice("Guided script mode — Claude not configured. Rule-based script generated.");
    }
  }, [courseSlug, lessonSlug]);

  const prepareVideoMetadata = useCallback(async () => {
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
      setError(body?.error ?? "Could not update video metadata.");
      return;
    }
    setAsset(body.asset);
    setTab("video");
    setNotice(
      body.message ??
        "Phase 2 metadata only — does not render MP4. Upload a video manually or connect Remotion/HeyGen later.",
    );
  }, [courseSlug, lessonSlug]);

  const uploadVideo = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      setNotice(null);

      const formData = new FormData();
      formData.append("courseSlug", courseSlug);
      formData.append("lessonSlug", lessonSlug);
      formData.append("companyId", companyId);
      formData.append("file", file);

      const response = await fetch("/api/founder/learning/video-upload", {
        method: "POST",
        body: formData,
      });

      setUploading(false);

      const body = (await response.json().catch(() => null)) as {
        asset?: FounderLessonVideoAssetRecord;
        playbackUrl?: string | null;
        error?: string;
      } | null;

      if (!response.ok || !body?.asset) {
        setError(body?.error ?? "Video upload failed.");
        return;
      }

      setAsset(body.asset);
      setPlaybackUrl(body.playbackUrl ?? null);
      setTab("video");
      setNotice("Video uploaded. Playback uses a signed URL from private storage.");
    },
    [companyId, courseSlug, lessonSlug],
  );

  const removeVideo = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    const response = await fetch("/api/founder/learning/video-upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug, lessonSlug, companyId }),
    });
    setLoading(false);
    const body = (await response.json().catch(() => null)) as {
      asset?: FounderLessonVideoAssetRecord | null;
      error?: string;
    } | null;
    if (!response.ok) {
      setError(body?.error ?? "Could not remove video.");
      return;
    }
    setAsset(body?.asset ?? null);
    setPlaybackUrl(null);
    setNotice("Video removed.");
  }, [companyId, courseSlug, lessonSlug]);

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void uploadVideo(file);
    event.target.value = "";
  };

  const tabs: { id: VideoTab; label: string }[] = [
    { id: "video", label: "Video" },
    { id: "script", label: "Script" },
    { id: "captions", label: "Captions" },
    { id: "slides", label: "Slides" },
  ];

  const busy = loading || uploading;

  // ── Founder / view-only mode ──────────────────────────────────────────────
  if (viewOnly) {
    return (
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-panel)]">
        <div className="relative aspect-video bg-slate-950">
          {canPlayVideo && playbackUrl ? (
            <video
              key={playbackUrl}
              className="h-full w-full bg-black"
              controls
              src={playbackUrl}
              title={lessonTitle}
            >
              <track kind="captions" />
            </video>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              {/* Play icon placeholder */}
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 translate-x-0.5 text-white/80">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <p className="mt-4 text-sm font-medium text-white/90">
                {lessonTitle}
              </p>
              <p className="mt-1 text-xs text-white/50">
                {durationMinutes} min · Video coming soon
              </p>
            </div>
          )}
        </div>

        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">Video Lesson</p>
              <p className="mt-0.5 text-[11px] leading-5 text-slate-500">{VIDEO_LESSON_DISCLAIMER}</p>
            </div>
            {canPlayVideo ? (
              <StatusBadge label="Video ready" status="success" dot />
            ) : (
              <StatusBadge label="Coming soon" status="neutral" dot />
            )}
          </div>
        </div>
      </section>
    );
  }

  // ── Admin / full management mode ───────────────────────────────────────────
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-panel)]">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_VIDEO}
        className="hidden"
        onChange={onFileChange}
      />

      <div className="relative aspect-video bg-slate-100">
        {canPlayVideo && playbackUrl ? (
          <video key={playbackUrl} className="h-full w-full bg-black" controls src={playbackUrl} title={lessonTitle}>
            <track kind="captions" />
          </video>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center border border-dashed border-slate-300 bg-gradient-to-b from-slate-50 to-slate-100 px-6 text-center">
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-800">
              {uploading ? "Uploading…" : showPhase1Panel && hasScript ? "Script ready" : "No video yet"}
            </span>
            <p className="mt-4 max-w-lg text-sm font-medium text-slate-800">
              {uploading
                ? "Uploading lesson video…"
                : showPhase1Panel && hasScript
                  ? "Video rendering is not enabled yet. Script, captions, and slides are ready for review — or upload an MP4/WebM below."
                  : showPhase1Panel
                    ? "Upload an MP4 or WebM lesson video, or generate a script first."
                    : "Video playback will appear when a manual upload is ready."}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {lessonTitle} · {durationMinutes} min · Max 250MB · MP4 or WebM
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
          <StatusBadge label={statusLabel(renderStatus)} status={statusVariant(renderStatus)} dot />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void generateScript()}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {hasScript ? "Regenerate Script" : "Generate Script"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {canPlayVideo ? "Replace Video" : "Upload Video"}
          </button>
          {canPlayVideo ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void removeVideo()}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Remove Video
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy || !hasScript}
            title="Phase 2 AI render metadata only — does not produce an MP4"
            onClick={() => void prepareVideoMetadata()}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            Prepare Video Metadata (Phase 2)
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
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              {canPlayVideo
                ? "Manual lesson video is active. Replace or remove via the buttons above."
                : showPhase1Panel && hasScript
                  ? "Video rendering is not enabled yet. Script, captions, and slides are ready for review."
                  : "Upload MP4/WebM for immediate playback, or generate script assets first."}
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void generateScript()}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                Generate Script
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-900 hover:bg-indigo-100 disabled:opacity-60"
              >
                Upload Video
              </button>
              <button
                type="button"
                disabled={!hasScript}
                onClick={() => setTab("script")}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              >
                View Script
              </button>
              <button
                type="button"
                disabled={!hasScript}
                onClick={() => setTab("slides")}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              >
                View Slides
              </button>
              <button
                type="button"
                disabled={!hasScript}
                onClick={() => setTab("captions")}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              >
                View Captions
              </button>
            </div>

            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Real AI-rendered video (Phase 2) requires Remotion, HeyGen, or another provider. Manual uploads use the
              private <span className="font-mono">learning-videos</span> bucket with signed playback URLs.
            </p>
          </div>
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
