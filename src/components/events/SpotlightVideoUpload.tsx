"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Upload, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { checkSpotlightFile, type FileCheck } from "@/lib/icfo-events/spotlight/rules";

export type UploadedSpotlightVideo = {
  path: string;
  type: string;
  bytes: number;
  seconds: number;
  width: number;
  height: number;
  name: string;
};

/** Reads length and size from the file on the founder's device (free, no upload). */
function probe(file: File): Promise<{ seconds: number | null; width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    const finish = (r: { seconds: number | null; width: number | null; height: number | null }) => {
      URL.revokeObjectURL(url);
      resolve(r);
    };
    v.onloadedmetadata = () =>
      finish({
        seconds: Number.isFinite(v.duration) ? v.duration : null,
        width: v.videoWidth || null,
        height: v.videoHeight || null,
      });
    v.onerror = () => finish({ seconds: null, width: null, height: null });
    v.src = url;
  });
}

export function SpotlightVideoUpload({
  eventId,
  onUploaded,
}: {
  eventId: string;
  onUploaded: (v: UploadedSpotlightVideo | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [checks, setChecks] = useState<FileCheck[] | null>(null);
  const [state, setState] = useState<"idle" | "checking" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  async function pick(file: File) {
    onUploaded(null);
    setName(file.name);
    setMessage(null);
    setState("checking");
    const meta = await probe(file);
    const result = checkSpotlightFile({ type: file.type, bytes: file.size, ...meta });
    setChecks(result);
    if (result.some((c) => !c.ok)) {
      setState("error");
      setMessage("Fix the items marked above and choose the file again.");
      return;
    }
    setState("uploading");
    try {
      const res = await fetch("/api/founder/events/spotlight/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, fileName: file.name, type: file.type, bytes: file.size }),
      });
      const sign = (await res.json().catch(() => ({}))) as { bucket?: string; path?: string; token?: string; error?: string };
      if (!res.ok || !sign.bucket || !sign.path || !sign.token) throw new Error(sign.error ?? "Could not start the upload.");
      const { error } = await createClient().storage.from(sign.bucket).uploadToSignedUrl(sign.path, sign.token, file, { contentType: file.type });
      if (error) throw new Error("The upload didn't finish. Check your connection and try again.");
      setState("done");
      onUploaded({
        path: sign.path,
        type: file.type,
        bytes: file.size,
        seconds: Math.round(meta.seconds ?? 0),
        width: meta.width ?? 0,
        height: meta.height ?? 0,
        name: file.name,
      });
    } catch (e) {
      setState("error");
      setMessage(e instanceof Error ? e.message : "Upload failed.");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={state === "checking" || state === "uploading"}
        className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-slate-300 px-4 py-5 text-center hover:bg-slate-50 disabled:opacity-60"
      >
        <Upload className="h-5 w-5 text-[#1A6CE4]" />
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {state === "uploading" ? "Uploading…" : state === "checking" ? "Checking…" : name ? "Choose a different video" : "Upload pitch video"}
        </span>
        <span className="text-xs text-[var(--text-muted)]">MP4, MOV or WebM · landscape · 3:00 max · 500 MB max</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pick(f);
          e.target.value = "";
        }}
      />
      {checks ? (
        <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
          {checks.map((c) => (
            <li key={c.id} className="flex items-center gap-1.5">
              {c.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <XCircle className="h-3.5 w-3.5 text-rose-600" />}
              <span className="text-[var(--text-primary)]">{c.label}</span>
              <span className="text-[var(--text-muted)]">{c.id === "length" && c.ok ? c.detail : c.ok ? "" : c.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {state === "done" && name ? <p className="mt-2 text-xs text-emerald-700">Uploaded {name}.</p> : null}
      {message ? <p className="mt-2 text-xs text-rose-700">{message}</p> : null}
    </div>
  );
}
