"use client";

// F3 — wide centered compose modal. Reusable shell driven by a ComposePrefill;
// all triggers (Compose button, contact card Email, Reply/Reply all/Forward)
// open it through the parent's openCompose() seam. Reuses existing field markup
// and the existing send/draft pipelines via callbacks — no new send logic.

import { useEffect, useMemo, useRef, useState } from "react";
import { Send, X, Paperclip, FileText, Minus, Maximize2 } from "lucide-react";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import type { EmailAttachment } from "@/lib/email/inbox";
import type { ComposeDraft, ComposePrefill } from "./types";
import { useFocusTrap, useOnEscape } from "./a11y";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ComposeModalProps {
  open: boolean;
  prefill?: ComposePrefill;
  title?: string;
  sending?: boolean;
  error?: string | null;
  /** When provided, a "Save draft" button appears and dirty-close auto-saves. */
  onSaveDraft?: (draft: ComposeDraft) => void;
  onSend: (draft: ComposeDraft) => void;
  onClose: () => void;
  /** Optional attachment support (CapitalOS inbox). Returns the stored attachments. */
  uploadFiles?: (files: FileList) => Promise<EmailAttachment[]>;
  uploading?: boolean;
  initialAttachments?: EmailAttachment[];
}

export function ComposeModal({
  open,
  prefill,
  title = "New message",
  sending = false,
  error,
  onSaveDraft,
  onSend,
  onClose,
  uploadFiles,
  uploading = false,
  initialAttachments,
}: ComposeModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [minimized, setMinimized] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Seed fields when the modal opens or the prefill changes.
  const prefillKey = useMemo(
    () => (prefill ? JSON.stringify(prefill) : "") + (initialAttachments ? initialAttachments.length : 0),
    [prefill, initialAttachments],
  );
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTo((prefill?.to ?? []).join(", "));
    setCc((prefill?.cc ?? []).join(", "));
    setBcc("");
    setSubject(prefill?.subject ?? "");
    setBody(prefill?.body ?? "");
    setShowCc(Boolean(prefill?.cc && prefill.cc.length > 0));
    setAttachments(initialAttachments ?? []);
    setMinimized(false);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefillKey]);

  const draft = (): ComposeDraft => ({ to, cc, bcc, subject, body, attachments });

  const requestClose = async () => {
    if (dirty) {
      if (onSaveDraft) {
        onSaveDraft(draft()); // never discard silently — persist first
        onClose();
        return;
      }
      if (!(await confirmDialog({ message: "Discard this draft?", danger: true, confirmLabel: "Discard" }))) return;
    }
    onClose();
  };

  // Esc closes (with dirty guard). Focus trap + restore while open and not minimized.
  useOnEscape(open && !minimized, requestClose);
  useFocusTrap(open && !minimized, dialogRef);

  if (!open) return null;

  const onField =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setDirty(true);
      setter(v);
    };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !uploadFiles) return;
    const added = await uploadFiles(files);
    setDirty(true);
    setAttachments((prev) => [...prev, ...added]);
  };

  // Minimized: a slim restorable bar pinned bottom-right.
  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2 rounded-t-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-lg hover:bg-slate-50"
        >
          <Maximize2 className="h-4 w-4 text-slate-500" />
          {subject.trim() || title}
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center"
      onMouseDown={(e) => {
        // Backdrop click → minimize (never silently discard a dirty draft).
        if (e.target === e.currentTarget) setMinimized(true);
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="flex max-h-[80vh] w-full max-w-[900px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl outline-none"
      >
        {/* Header (fixed) */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setMinimized(true)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Minimize"><Minus className="h-4 w-4" /></button>
            <button type="button" onClick={requestClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Body (scrolls internally) */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p> : null}

          <div className="flex items-center gap-2">
            <input
              value={to}
              onChange={(e) => onField(setTo)(e.target.value)}
              placeholder="To"
              aria-label="To"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline-none"
            />
            {!showCc ? (
              <button type="button" onClick={() => setShowCc(true)} className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">Cc/Bcc</button>
            ) : null}
          </div>

          {showCc ? (
            <>
              <input value={cc} onChange={(e) => onField(setCc)(e.target.value)} placeholder="Cc" aria-label="Cc" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline-none" />
              <input value={bcc} onChange={(e) => onField(setBcc)(e.target.value)} placeholder="Bcc" aria-label="Bcc" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline-none" />
            </>
          ) : null}

          <input value={subject} onChange={(e) => onField(setSubject)(e.target.value)} placeholder="Subject" aria-label="Subject" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline-none" />

          <textarea
            value={body}
            onChange={(e) => onField(setBody)(e.target.value)}
            placeholder="Write your message…"
            aria-label="Message body"
            className="min-h-[260px] w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed focus:border-[var(--blue)] focus:outline-none"
          />

          {uploadFiles ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                <Paperclip className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Attach files"}
                <input type="file" multiple className="hidden" onChange={(e) => { void handleUpload(e.target.files); e.target.value = ""; }} />
              </label>
              {attachments.map((a) => (
                <span key={a.path} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
                  <Paperclip className="h-3.5 w-3.5 text-slate-400" /> {a.name} <span className="text-slate-400">{formatSize(a.size)}</span>
                  <button type="button" aria-label={`Remove ${a.name}`} onClick={() => { setDirty(true); setAttachments((p) => p.filter((x) => x.path !== a.path)); }} className="text-slate-400 hover:text-slate-700"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Footer (fixed) */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
          <button type="button" onClick={requestClose} className="mr-auto rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Discard</button>
          {onSaveDraft ? (
            <button type="button" onClick={() => onSaveDraft(draft())} disabled={sending} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><FileText className="h-4 w-4" /> Save draft</button>
          ) : null}
          <button type="button" onClick={() => onSend(draft())} disabled={sending} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"><Send className="h-4 w-4" /> {sending ? "Sending…" : "Send"}</button>
        </div>
      </div>
    </div>
  );
}
