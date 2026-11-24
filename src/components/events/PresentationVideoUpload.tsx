"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Upload, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { checkPresentationFile, type FileCheck } from "@/lib/icfo-events/spotlight/rules";

export type UploadedPresentationVideo = {
  path: string;
  type: string;
  bytes: number;
  name: string;
};

/** Full presentation video upload: checks type and size on the founder's
 *  device, then sends the file straight to the private bucket. */
export function PresentationVideoUpload({
  eventId,
  onUploaded,
}: {
  eventId: string;
  onUploaded: (v: UploadedPresentationVideo | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [checks, setChecks] = useState<FileCheck[] | null>(null);
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  async function pick(file: File) {
    onUploaded(null);
    setName(file.name);
    setMessage(null);
    const result = checkPresentationFile({ type: file.type, bytes: file.size });
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
      onUploaded({ path: sign.path, type: file.type, bytes: file.size, name: file.name });
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
        disabled={state === "uploading"}
        className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-slate-300 px-4 py-5 text-center hover:bg-slate-50 disabled:opacity-60"
      >
        <Upload className="h-5 w-5 text-[#1A6CE4]" />
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {state === "uploading" ? "Uploading…" : name ? "Choose a different video" : "Upload presentation video"}
        </span>
        <span className="text-xs text-[var(--text-muted)]">MP4, MOV or WebM · 500 MB max</span>
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
              {c.ok ? null : <span className="text-[var(--text-muted)]">{c.detail}</span>}
            </li>
          ))}
        </ul>
      ) : null}
      {state === "done" && name ? <p className="mt-2 text-xs text-emerald-700">Uploaded {name}.</p> : null}
      {message ? <p className="mt-2 text-xs text-rose-700">{message}</p> : null}
    </div>
  );
}
