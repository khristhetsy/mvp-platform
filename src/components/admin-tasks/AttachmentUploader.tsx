"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import type { AdminTaskAttachment } from "@/lib/admin-tasks/types";
import { ACCEPTED_MIME, MAX_UPLOAD_BYTES } from "@/lib/admin-tasks/types";

export function AttachmentUploader({
  taskId,
  onUploaded,
}: {
  taskId: string;
  onUploaded: (attachment: AdminTaskAttachment, notice?: string | null) => void;
}) {
  const t = useTranslations("adminCmp");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setError(null);
    if (!ACCEPTED_MIME[file.type]) { setError("Unsupported type. Upload a PDF, DOCX, or PPTX."); return; }
    if (file.size > MAX_UPLOAD_BYTES) { setError("File too large (max 25 MB)."); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/tasks/${taskId}/attachments`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Upload failed.");
      onUploaded(data.attachment, data.notice ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) void upload(f);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E78F5] ${dragging ? "border-[#2E78F5] bg-[#EFF6FF]" : "border-slate-200 hover:border-slate-300"}`}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin text-[#2E78F5]" /> : <UploadCloud className="h-5 w-5 text-slate-400" aria-hidden />}
        <p className="text-xs font-medium text-slate-700">{busy ? "Uploading…" : "Drop a file or click to upload"}</p>
        <p className="text-[10px] text-slate-400">{t("pdf_docx_pptx_max_25_mb_pptx_previews_as_pdf")}</p>
        <input ref={inputRef} type="file" className="hidden" accept=".pdf,.docx,.pptx" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
      </div>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
