"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FileText, Download, Eye, Trash2, X, Loader2 } from "lucide-react";
import type { AdminTaskAttachment } from "@/lib/admin-tasks/types";

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentList({
  taskId,
  attachments,
  onRemoved,
}: {
  taskId: string;
  attachments: AdminTaskAttachment[];
  onRemoved?: (id: string) => void;
}) {
  const t = useTranslations("adminCmp");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const signedUrl = async (attId: string, disposition: "inline" | "attachment") => {
    const res = await fetch(`/api/admin/tasks/${taskId}/attachments/${attId}/url?disposition=${disposition}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not get file URL.");
    return data.url as string;
  };

  const preview = async (a: AdminTaskAttachment) => {
    setBusyId(a.id);
    try {
      const url = await signedUrl(a.id, "inline");
      const previewable = a.mime_type === "application/pdf";
      if (previewable) { setPreviewName(a.file_name); setPreviewUrl(url); }
      else window.open(url, "_blank", "noopener");
    } catch { /* surfaced by download fallback */ } finally { setBusyId(null); }
  };

  const download = async (a: AdminTaskAttachment) => {
    setBusyId(a.id);
    try { window.open(await signedUrl(a.id, "attachment"), "_blank", "noopener"); } catch { /* ignore */ } finally { setBusyId(null); }
  };

  const remove = async (a: AdminTaskAttachment) => {
    if (!onRemoved) return;
    setBusyId(a.id);
    try {
      const res = await fetch(`/api/admin/tasks/${taskId}/attachments/${a.id}`, { method: "DELETE" });
      if (res.ok) onRemoved(a.id);
    } finally { setBusyId(null); }
  };

  if (attachments.length === 0) {
    return <p className="text-xs text-slate-400">{t("no_attachments_yet")}</p>;
  }

  return (
    <>
      <ul className="space-y-1.5">
        {attachments.map((a) => (
          <li key={a.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <FileText className="h-4 w-4 shrink-0 text-[#0D9488]" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-slate-800" title={a.file_name}>{a.file_name}</span>
              <span className="text-[10px] uppercase tracking-wide text-slate-400">{a.source_format} · {fmtSize(a.size_bytes)}{a.converted_to_pdf ? " · PDF preview" : ""}</span>
            </span>
            {busyId === a.id ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
            <button type="button" onClick={() => void preview(a)} aria-label={`Preview ${a.file_name}`} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-[#0F2147]"><Eye className="h-4 w-4" /></button>
            <button type="button" onClick={() => void download(a)} aria-label={`Download ${a.file_name}`} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-[#0F2147]"><Download className="h-4 w-4" /></button>
            {onRemoved ? <button type="button" onClick={() => void remove(a)} aria-label={`Remove ${a.file_name}`} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button> : null}
          </li>
        ))}
      </ul>

      {previewUrl ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setPreviewUrl(null)}>
          <div className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <p className="truncate text-sm font-semibold text-slate-900">{previewName}</p>
              <button type="button" onClick={() => setPreviewUrl(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close preview"><X className="h-4 w-4" /></button>
            </div>
            <iframe src={previewUrl} title={previewName} className="min-h-0 flex-1 border-0" />
          </div>
        </div>
      ) : null}
    </>
  );
}
