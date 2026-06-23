"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_BYTES = 5 * 1024 * 1024;

type UploadState = "empty" | "uploading" | "preview" | "error";

type Props = {
  value: string | null;
  onUpload: (url: string) => void;
  onRemove: () => void;
};

function uploadBanner(file: File, onProgress: (percent: number) => void) {
  return new Promise<{ url: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    });

    xhr.addEventListener("load", () => {
      let json: Record<string, unknown> = {};
      try {
        json = JSON.parse(xhr.responseText) as Record<string, unknown>;
      } catch {
        json = {};
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(typeof json.error === "string" ? json.error : "Upload failed."));
        return;
      }

      if (typeof json.url !== "string" || !json.url) {
        reject(new Error("Upload succeeded but no URL was returned."));
        return;
      }

      resolve({ url: json.url });
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed.")));
    xhr.open("POST", "/api/admin/learning/courses/banner-upload");
    xhr.send(formData);
  });
}

export function CourseBannerUpload({ value, onUpload, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>(value ? "preview" : "empty");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (state === "uploading" || state === "error") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(value ? "preview" : "empty");
  }, [value, state]);

  useEffect(() => {
    if (state !== "error") return;
    const timer = window.setTimeout(() => {
      setErrorMessage(null);
      setState(value ? "preview" : "empty");
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [state, value]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])) {
        setErrorMessage("Only JPG, PNG, and WebP images are allowed.");
        setState("error");
        return;
      }

      if (file.size > MAX_BYTES) {
        setErrorMessage("Image must be 5MB or smaller.");
        setState("error");
        return;
      }

      setState("uploading");
      setProgress(0);
      setErrorMessage(null);

      try {
        const result = await uploadBanner(file, setProgress);
        onUpload(result.url);
        setState("preview");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Upload failed.");
        setState("error");
      }
    },
    [onUpload],
  );

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
    event.target.value = "";
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  if (state === "uploading") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-slate-800">Uploading banner…</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-500">{progress}%</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-xl border border-rose-300 bg-rose-50 p-4">
        <p className="text-sm font-medium text-rose-900">Banner upload failed</p>
        <p className="mt-1 text-xs text-rose-800">{errorMessage ?? "Please try again."}</p>
      </div>
    );
  }

  if (state === "preview" && value) {
    return (
      <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="Course banner preview" className="h-40 w-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-950/50 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100"
          >
            Change
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg border border-white/30 bg-transparent px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
          >
            Remove
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={onInputChange}
        />
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
      }}
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={onDrop}
      className={`rounded-xl border-2 border-dashed p-6 text-center transition ${
        dragActive ? "border-indigo-400 bg-indigo-50/50" : "border-slate-300 bg-slate-50"
      }`}
    >
      <p className="text-sm font-medium text-slate-800">Drag & drop course banner</p>
      <p className="mt-1 text-xs text-slate-500">JPG, PNG, or WebP · max 5MB</p>
      <p className="mt-3 text-xs font-medium text-indigo-700">or click to browse</p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  );
}
