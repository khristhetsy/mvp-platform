"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

type UploadType = "video" | "slides";
type UploadState = "idle" | "uploading" | "done" | "error";
type RenderStatus = "idle" | "queued" | "rendering" | "ready" | "failed";

type Props = {
  courseId: string;
  moduleSlug: string;
  lessonKey: string;
  lessonId: string;
  existingVideoUrl?: string | null;
  existingSlideDeckUrl?: string | null;
  initialRenderStatus?: string | null;
  onUploaded: (type: UploadType, url: string) => void;
};

const VIDEO_MIMES = ["video/mp4", "video/webm"];
const SLIDE_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export function AdminLessonMediaUpload({
  courseId,
  moduleSlug,
  lessonKey,
  lessonId,
  existingVideoUrl,
  existingSlideDeckUrl,
  initialRenderStatus,
  onUploaded,
}: Props) {
  const t = useTranslations("adminCmp");
  const [videoState, setVideoState] = useState<UploadState>(existingVideoUrl ? "done" : "idle");
  const [slidesState, setSlidesState] = useState<UploadState>(existingSlideDeckUrl ? "done" : "idle");
  const [videoProgress, setVideoProgress] = useState(0);
  const [slidesProgress, setSlidesProgress] = useState(0);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [slidesFileName, setSlidesFileName] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [slidesError, setSlidesError] = useState<string | null>(null);
  const [renderStatus, setRenderStatus] = useState<RenderStatus>(() => {
    if (initialRenderStatus === "rendering") return "rendering";
    if (initialRenderStatus === "ready" || existingVideoUrl) return "ready";
    if (initialRenderStatus === "failed") return "failed";
    return "idle";
  });
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollParams = new URLSearchParams({ courseId, moduleSlug, lessonKey });

  const stopPolling = useCallback(() => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
  }, []);

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/learning/media-upload?${pollParams.toString()}`);
      if (!res.ok) return;
      const json = (await res.json()) as { renderStatus?: string; videoUrl?: string | null };
      if (json.renderStatus === "ready") {
        setRenderStatus("ready");
        if (json.videoUrl) {
          onUploaded("video", json.videoUrl);
          setVideoState("done");
        }
        stopPolling();
      } else if (json.renderStatus === "failed") {
        setRenderStatus("failed");
        stopPolling();
      } else if (json.renderStatus === "rendering") {
        setRenderStatus("rendering");
      }
    } catch {
      // ignore poll errors
    }
  }, [onUploaded, pollParams, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    void pollStatus();
    pollInterval.current = setInterval(() => void pollStatus(), 5000);
  }, [pollStatus, stopPolling]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialRenderStatus === "rendering") startPolling();
    return () => stopPolling();
  }, [initialRenderStatus, startPolling, stopPolling]);

  function resetError(type: UploadType) {
    setTimeout(() => {
      if (type === "video") {
        setVideoState(existingVideoUrl ? "done" : "idle");
        setVideoError(null);
      } else {
        setSlidesState(existingSlideDeckUrl ? "done" : "idle");
        setSlidesError(null);
      }
    }, 4000);
  }

  function uploadFile(file: File, type: UploadType) {
    if (type === "video") {
      if (!VIDEO_MIMES.includes(file.type)) {
        setVideoError("MP4 or WebM only.");
        setVideoState("error");
        resetError("video");
        return;
      }
      if (file.size > 250 * 1024 * 1024) {
        setVideoError("File exceeds 250MB.");
        setVideoState("error");
        resetError("video");
        return;
      }
      setVideoState("uploading");
      setVideoProgress(0);
      setVideoFileName(file.name);
    } else {
      if (!SLIDE_MIMES.includes(file.type)) {
        setSlidesError("PDF or PPTX only.");
        setSlidesState("error");
        resetError("slides");
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        setSlidesError("File exceeds 50MB.");
        setSlidesState("error");
        resetError("slides");
        return;
      }
      setSlidesState("uploading");
      setSlidesProgress(0);
      setSlidesFileName(file.name);
    }

    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    form.append("courseId", courseId);
    form.append("moduleSlug", moduleSlug);
    form.append("lessonKey", lessonKey);

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      if (type === "video") setVideoProgress(pct);
      else setSlidesProgress(pct);
    });
    xhr.addEventListener("load", () => {
      try {
        const json = JSON.parse(xhr.responseText) as { url?: string; error?: string };
        if (xhr.status >= 400) throw new Error(json.error ?? "Upload failed");
        if (!json.url) throw new Error("No URL returned");
        if (type === "video") {
          setVideoState("done");
          setRenderStatus("ready");
        } else {
          setSlidesState("done");
        }
        onUploaded(type, json.url);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        if (type === "video") {
          setVideoError(msg);
          setVideoState("error");
          resetError("video");
        } else {
          setSlidesError(msg);
          setSlidesState("error");
          resetError("slides");
        }
      }
    });
    xhr.addEventListener("error", () => {
      if (type === "video") {
        setVideoError("Network error");
        setVideoState("error");
        resetError("video");
      } else {
        setSlidesError("Network error");
        setSlidesState("error");
        resetError("slides");
      }
    });
    xhr.open("POST", "/api/admin/learning/media-upload");
    xhr.send(form);
  }

  async function removeMedia(type: UploadType) {
    const params = new URLSearchParams({ type, courseId, moduleSlug, lessonKey });
    await fetch(`/api/admin/learning/media-upload?${params.toString()}`, { method: "DELETE" });
    if (type === "video") {
      setVideoState("idle");
      setVideoFileName(null);
      setRenderStatus("idle");
    } else {
      setSlidesState("idle");
      setSlidesFileName(null);
    }
  }

  async function generateVideo() {
    setRenderStatus("queued");
    const res = await fetch("/api/admin/learning/content/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: "lesson", contentId: lessonId, action: "generate_video" }),
    });
    if (!res.ok) {
      setRenderStatus("failed");
      return;
    }
    setRenderStatus("rendering");
    startPolling();
  }

  function pickFile(type: UploadType) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = type === "video" ? VIDEO_MIMES.join(",") : SLIDE_MIMES.join(",");
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) uploadFile(file, type);
    };
    input.click();
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <MediaColumn
        label={t("video_lesson")}
        hint="MP4 or WebM · 250MB max"
        state={videoState}
        progress={videoProgress}
        fileName={videoFileName}
        error={videoError}
        onBrowse={() => pickFile("video")}
        onReplace={() => pickFile("video")}
        onRemove={() => void removeMedia("video")}
      />
      <MediaColumn
        label={t("slide_deck")}
        hint="PDF or PPTX · 50MB max"
        state={slidesState}
        progress={slidesProgress}
        fileName={slidesFileName}
        error={slidesError}
        onBrowse={() => pickFile("slides")}
        onReplace={() => pickFile("slides")}
        onRemove={() => void removeMedia("slides")}
      />
      <div className="rounded-lg border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-900">{t("generate_with_ai")}</p>
        <p className="mt-1 text-xs text-slate-500">{t("heygen_elevenlabs_remotion")}</p>
        <button
          type="button"
          onClick={() => void generateVideo()}
          className="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          Generate video
        </button>
        <div className="mt-3 text-xs">
          {renderStatus === "queued" ? (
            <p className="flex items-center gap-2 text-slate-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
              Queued for rendering
            </p>
          ) : null}
          {renderStatus === "rendering" ? (
            <p className="flex items-center gap-2 text-indigo-700">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              Rendering… this may take a few minutes
            </p>
          ) : null}
          {renderStatus === "ready" ? (
            <p className="text-emerald-700">✓ Video ready</p>
          ) : null}
          {renderStatus === "failed" ? (
            <p className="text-red-700">× Rendering failed — try again</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MediaColumn({
  label,
  hint,
  state,
  progress,
  fileName,
  error,
  onBrowse,
  onReplace,
  onRemove,
}: {
  label: string;
  hint: string;
  state: UploadState;
  progress: number;
  fileName: string | null;
  error: string | null;
  onBrowse: () => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations("adminCmp");
  if (state === "uploading") {
    return (
      <div className="rounded-lg border border-slate-200 p-4">
        <p className="text-sm text-slate-700">Uploading… {progress}%</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-semibold text-emerald-800">✓ {fileName ?? "Uploaded"}</p>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={onReplace} className="text-xs text-indigo-600">
            Replace
          </button>
          <button type="button" onClick={onRemove} className="text-xs text-red-600">
            Remove
          </button>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4">
        <p className="text-sm text-red-800">{error ?? "Upload failed"}</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onBrowse}
      className="rounded-lg border border-dashed border-slate-300 p-4 text-left hover:border-indigo-300 hover:bg-indigo-50/30"
    >
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
      <p className="mt-2 text-xs text-indigo-600">{t("drop_here_or_click_to_browse")}</p>
    </button>
  );
}
