"use client";

// F3 — wide centered compose modal. Reusable shell driven by a ComposePrefill;
// all triggers (Compose button, contact card Email, Reply/Reply all/Forward)
// open it through the parent's openCompose() seam. Reuses existing field markup
// and the existing send/draft pipelines via callbacks.
//
// The body is a rich-text editor (contentEditable + formatting toolbar) and the
// sender's saved signature is inserted automatically (toggleable). draft() emits
// both a plain-text `body` (backward compatible) and a rich `html` rendering.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Send, X, Paperclip, FileText, Minus, Maximize2, PenLine,
  Bold, Italic, Underline, Link2, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Eraser, Undo2, Redo2, Sparkles,
} from "lucide-react";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import type { EmailAttachment } from "@/lib/email/inbox";
import type { ComposeDraft, ComposePrefill } from "./types";
import { useFocusTrap, useOnEscape } from "./a11y";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeText(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// The recipient the user is currently typing (text after the last comma).
function currentRecipientToken(value: string): string {
  const parts = value.split(",");
  return (parts[parts.length - 1] ?? "").trim();
}
// Replace that in-progress token with a chosen email, ready for the next recipient.
function replaceLastRecipient(value: string, email: string): string {
  const parts = value.split(",");
  parts[parts.length - 1] = ` ${email}`;
  return `${parts.join(",").trim()}, `;
}
function textToHtml(t: string): string {
  return escapeText(t).replace(/\n/g, "<br/>");
}

const SIG_ATTR = "data-icapos-signature";
const SWATCHES = ["#0F2147", "#185FA5", "#2E78F5", "#475569", "#A32D2D", "#000000"];
const AI_ACTIONS: [string, string][] = [
  ["formal", "Formal"], ["friendly", "Friendly"], ["persuasive", "Persuasive"],
  ["shorten", "Shorten"], ["expand", "Expand"], ["polish", "Polish"],
];

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
  /** Optional attachment support (iCapOS inbox). Returns the stored attachments. */
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
  const t = useTranslations("sharedCmp");
  const dialogRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [minimized, setMinimized] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [signatureHtml, setSignatureHtml] = useState<string | null>(null);
  const [signatureOn, setSignatureOn] = useState(true);

  // Marketing templates for the quick-insert picker.
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; subject: string; html_body: string }>>([]);
  const [tplMenuOpen, setTplMenuOpen] = useState(false);
  const [tplQuery, setTplQuery] = useState("");

  // Recipient autocomplete (To field) over shared CRM contacts.
  const [toSug, setToSug] = useState<Array<{ name: string; email: string }>>([]);
  const [toMenuOpen, setToMenuOpen] = useState(false);
  const [toActive, setToActive] = useState(0);
  const toTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI writing assistant
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState<null | string>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Fetch the sender's saved signature (falls back to the iCFO default) once.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/preferences/signature");
        if (!res.ok) return;
        const data = await res.json();
        const sig: string = data.effective ?? data.signature ?? "";
        if (active) setSignatureHtml(sig || null);
      } catch {
        /* signature is best-effort */
      }
    })();
    return () => { active = false; };
  }, []);

  // Load marketing templates for the picker (best-effort; admins only will get results).
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/marketing/templates");
        if (!res.ok) return;
        const data = await res.json();
        if (active && Array.isArray(data.templates)) setTemplates(data.templates);
      } catch { /* templates are optional */ }
    })();
    return () => { active = false; };
  }, []);

  // Keep/remove the signature block at the end of the editor to match `signatureOn`.
  const ensureSignature = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const existing = el.querySelector(`[${SIG_ATTR}]`);
    // A reopened draft may already carry the signature text in its body — don't
    // append a second copy in that case.
    const snippet = signatureHtml ? signatureHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 40) : "";
    const alreadyPresent = snippet.length > 8 && (el.innerText ?? "").includes(snippet);
    if (signatureOn && signatureHtml && !existing && !alreadyPresent) {
      el.insertAdjacentHTML("beforeend", `<div ${SIG_ATTR}="1"><br/><br/>${signatureHtml}</div>`);
    } else if ((!signatureOn || !signatureHtml) && existing) {
      existing.remove();
    }
  }, [signatureOn, signatureHtml]);

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
    setShowCc(Boolean(prefill?.cc && prefill.cc.length > 0));
    setAttachments(initialAttachments ?? []);
    setMinimized(false);
    setDirty(false);
    if (editorRef.current) {
      editorRef.current.innerHTML = prefill?.body ? textToHtml(prefill.body) : "";
      ensureSignature();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefillKey]);

  // Late-arriving signature, or a toggle, reconciles the editor.
  useEffect(() => {
    if (open && !minimized) ensureSignature();
  }, [open, minimized, ensureSignature]);

  const draft = (): ComposeDraft => {
    const el = editorRef.current;
    const html = el ? el.innerHTML.trim() : "";
    const text = el ? (el.innerText ?? "").trim() : "";
    return { to, cc, bcc, subject, body: text, html: html || undefined, attachments };
  };

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

  // execCommand is deprecated but remains the simplest cross-browser rich-text path.
  const cmd = (c: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(c, false, val);
    setDirty(true);
  };
  const addLink = () => {
    const url = window.prompt("Link URL (https://…)");
    if (url) cmd("createLink", url);
  };
  const toggleSignature = () => {
    setSignatureOn((v) => !v);
    setDirty(true);
  };

  // ── AI writing assistant ──────────────────────────────────────────────────
  const bodyTextWithoutSig = useCallback((): string => {
    const el = editorRef.current;
    if (!el) return "";
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelector(`[${SIG_ATTR}]`)?.remove();
    return (clone.innerText ?? "").trim();
  }, []);

  const applyAiBody = useCallback((text: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = textToHtml(text);
    ensureSignature();
    setDirty(true);
  }, [ensureSignature]);

  const applyTemplate = useCallback((id: string) => {
    const tpl = templates.find((x) => x.id === id);
    const el = editorRef.current;
    if (!tpl || !el) return;
    if (tpl.subject) setSubject(tpl.subject);
    el.innerHTML = tpl.html_body || "";
    ensureSignature();
    setDirty(true);
    setTplMenuOpen(false);
    setTplQuery("");
  }, [templates, ensureSignature]);

  const visibleTemplates = useMemo(() => {
    const q = tplQuery.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(q) || (t.subject ?? "").toLowerCase().includes(q));
  }, [templates, tplQuery]);

  // Recipient autocomplete: fetch matches for the token being typed (debounced).
  const handleToChange = useCallback((value: string) => {
    setDirty(true);
    setTo(value);
    const token = currentRecipientToken(value);
    if (toTimer.current) clearTimeout(toTimer.current);
    if (token.length < 1) { setToMenuOpen(false); setToSug([]); return; }
    toTimer.current = setTimeout(() => {
      void fetch(`/api/admin/contacts/search?q=${encodeURIComponent(token)}`)
        .then((r) => (r.ok ? r.json() : { contacts: [] }))
        .then((d) => {
          const list = Array.isArray(d.contacts) ? d.contacts : [];
          setToSug(list);
          setToActive(0);
          setToMenuOpen(list.length > 0);
        })
        .catch(() => { setToMenuOpen(false); });
    }, 160);
  }, []);

  const pickRecipient = useCallback((email: string) => {
    setTo((prev) => replaceLastRecipient(prev, email));
    setToMenuOpen(false);
    setToSug([]);
    setDirty(true);
  }, []);

  const runAi = useCallback(async (mode: "draft" | "rewrite", action?: string) => {
    setAiBusy(action ?? mode);
    setAiError(null);
    try {
      const res = await fetch("/api/email/ai-compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, action, instruction: aiPrompt, currentText: bodyTextWithoutSig(), subject, to }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setAiError(typeof data.error === "string" ? data.error : "AI is unavailable right now."); return; }
      if (typeof data.body === "string" && data.body) applyAiBody(data.body);
      if (mode === "draft" && typeof data.subject === "string" && data.subject && !subject.trim()) setSubject(data.subject);
    } catch {
      setAiError("AI is unavailable right now.");
    } finally {
      setAiBusy(null);
    }
  }, [aiPrompt, subject, to, bodyTextWithoutSig, applyAiBody]);

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

  const TB = "rounded p-1.5 text-slate-600 hover:bg-slate-100";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setMinimized(true);
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="flex max-h-[85vh] w-full max-w-[900px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl outline-none"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setMinimized(true)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Minimize"><Minus className="h-4 w-4" /></button>
            <button type="button" onClick={requestClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p> : null}

          <div className="flex items-center gap-2">
            <div className="relative w-full">
              <input
                value={to}
                onChange={(e) => handleToChange(e.target.value)}
                onKeyDown={(e) => {
                  if (!toMenuOpen || toSug.length === 0) return;
                  if (e.key === "ArrowDown") { e.preventDefault(); setToActive((i) => (i + 1) % toSug.length); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setToActive((i) => (i - 1 + toSug.length) % toSug.length); }
                  else if (e.key === "Enter") { e.preventDefault(); pickRecipient(toSug[toActive].email); }
                  else if (e.key === "Escape") { setToMenuOpen(false); }
                }}
                onBlur={() => setTimeout(() => setToMenuOpen(false), 120)}
                placeholder={t("to")}
                aria-label="To"
                autoComplete="off"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline-none"
              />
              {toMenuOpen && toSug.length > 0 ? (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                  {toSug.map((c, i) => (
                    <button
                      key={c.email}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); pickRecipient(c.email); }}
                      onMouseEnter={() => setToActive(i)}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left ${i === toActive ? "bg-blue-50" : "hover:bg-slate-50"}`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--blue)] text-xs font-medium text-white">{(c.name || c.email).charAt(0).toUpperCase()}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-800">{c.name}</span>
                        <span className="block truncate text-xs text-slate-500">{c.email}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {!showCc ? (
              <button type="button" onClick={() => setShowCc(true)} className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">{t("cc_bcc")}</button>
            ) : null}
          </div>

          {showCc ? (
            <>
              <input value={cc} onChange={(e) => onField(setCc)(e.target.value)} placeholder={t("cc")} aria-label="Cc" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline-none" />
              <input value={bcc} onChange={(e) => onField(setBcc)(e.target.value)} placeholder={t("bcc")} aria-label="Bcc" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline-none" />
            </>
          ) : null}

          <input value={subject} onChange={(e) => onField(setSubject)(e.target.value)} placeholder={t("subject")} aria-label="Subject" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline-none" />

          {/* Rich-text body */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label="Message body"
            aria-multiline="true"
            onInput={() => setDirty(true)}
            data-placeholder="Write your message…"
            className="min-h-[280px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed text-slate-800 focus:border-[var(--blue)] focus:outline-none [&_a]:text-[#185FA5] [&_a]:underline [&_img]:my-1 [&_img]:inline-block empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]"
          />

          {aiOpen ? (
            <div className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                <span className="text-xs font-semibold text-indigo-900">AI assistant</span>
                <button type="button" onClick={() => setAiOpen(false)} className="ml-auto text-indigo-400 hover:text-indigo-700" aria-label="Close AI assistant"><X className="h-3.5 w-3.5" /></button>
              </div>
              <div className="flex gap-2">
                <input
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (aiPrompt.trim() && !aiBusy) void runAi("draft"); } }}
                  placeholder="Describe the email… e.g. follow up on our call and propose a time to meet"
                  className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                />
                <button type="button" disabled={!aiPrompt.trim() || !!aiBusy} onClick={() => void runAi("draft")} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{aiBusy === "draft" ? "Writing…" : "Draft"}</button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] font-medium text-indigo-700">Rewrite:</span>
                {AI_ACTIONS.map(([key, label]) => (
                  <button key={key} type="button" disabled={!!aiBusy} onClick={() => void runAi("rewrite", key)} className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">{aiBusy === key ? "…" : label}</button>
                ))}
              </div>
              {aiError ? <p className="text-xs text-red-700">{aiError}</p> : null}
              <p className="text-[10.5px] text-indigo-500">AI replaces the message body; your signature stays. Always review before sending.</p>
            </div>
          ) : null}

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

        {/* Formatting toolbar */}
        <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-t border-slate-100 bg-slate-50/70 px-3 py-1.5">
          <button type="button" aria-label="Undo" title={t("undo")} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("undo")} className={TB}><Undo2 className="h-4 w-4" /></button>
          <button type="button" aria-label="Redo" title={t("redo")} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("redo")} className={TB}><Redo2 className="h-4 w-4" /></button>
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <select
            aria-label="Text size"
            defaultValue=""
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => { if (e.target.value) { cmd("fontSize", e.target.value); e.target.value = ""; } }}
            className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600 focus:outline-none"
          >
            <option value="">Size</option>
            <option value="2">Small</option>
            <option value="3">Normal</option>
            <option value="5">Large</option>
          </select>
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <button type="button" aria-label="Bold" title={t("bold")} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("bold")} className={TB}><Bold className="h-4 w-4" /></button>
          <button type="button" aria-label="Italic" title={t("italic")} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("italic")} className={TB}><Italic className="h-4 w-4" /></button>
          <button type="button" aria-label="Underline" title={t("underline")} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("underline")} className={TB}><Underline className="h-4 w-4" /></button>
          <span className="flex items-center gap-1 px-1">
            {SWATCHES.map((c) => (
              <button key={c} type="button" aria-label={`Text color ${c}`} title={t("text_color")}
                onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("foreColor", c)}
                className="h-4 w-4 rounded-full border border-slate-300" style={{ backgroundColor: c }} />
            ))}
          </span>
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <button type="button" aria-label="Align left" title={t("align_left")} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("justifyLeft")} className={TB}><AlignLeft className="h-4 w-4" /></button>
          <button type="button" aria-label="Align center" title={t("align_center")} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("justifyCenter")} className={TB}><AlignCenter className="h-4 w-4" /></button>
          <button type="button" aria-label="Align right" title={t("align_right")} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("justifyRight")} className={TB}><AlignRight className="h-4 w-4" /></button>
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <button type="button" aria-label="Bullet list" title={t("bullet_list")} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("insertUnorderedList")} className={TB}><List className="h-4 w-4" /></button>
          <button type="button" aria-label="Numbered list" title={t("numbered_list")} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("insertOrderedList")} className={TB}><ListOrdered className="h-4 w-4" /></button>
          <button type="button" aria-label="Insert link" title={t("insert_link")} onMouseDown={(e) => e.preventDefault()} onClick={addLink} className={TB}><Link2 className="h-4 w-4" /></button>
          <button type="button" aria-label="Clear formatting" title={t("clear_formatting")} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("removeFormat")} className={TB}><Eraser className="h-4 w-4" /></button>
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <button
            type="button"
            aria-pressed={aiOpen}
            title="AI writing assistant"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setAiOpen((v) => !v)}
            className={`inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium ${aiOpen ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <Sparkles className="h-4 w-4" /> AI
          </button>
          <button
            type="button"
            aria-pressed={signatureOn}
            title={signatureOn ? "Remove signature" : "Insert signature"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggleSignature}
            className={`inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium ${signatureOn ? "bg-blue-50 text-[var(--blue)]" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <PenLine className="h-4 w-4" /> Signature
          </button>
          {templates.length > 0 ? (
            <div className="relative">
              <button
                type="button"
                aria-pressed={tplMenuOpen}
                title="Insert a marketing template"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setTplMenuOpen((v) => !v)}
                className={`inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium ${tplMenuOpen ? "bg-blue-50 text-[var(--blue)]" : "text-slate-600 hover:bg-slate-100"}`}
              >
                <FileText className="h-4 w-4" /> Template
              </button>
              {tplMenuOpen ? (
                <div className="absolute bottom-full left-0 z-20 mb-2 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                  <div className="border-b border-slate-100 p-2">
                    <input
                      value={tplQuery}
                      onChange={(e) => setTplQuery(e.target.value)}
                      placeholder="Search templates…"
                      autoFocus
                      className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs focus:border-[var(--blue)] focus:outline-none"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {visibleTemplates.length === 0 ? (
                      <div className="px-3 py-4 text-center text-xs text-slate-400">No templates match.</div>
                    ) : visibleTemplates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyTemplate(tpl.id)}
                        className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-slate-800">{tpl.name}</span>
                          {tpl.subject ? <span className="block truncate text-[11px] text-slate-500">{tpl.subject}</span> : null}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
          <button type="button" onClick={requestClose} className="mr-auto rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">{t("discard")}</button>
          {onSaveDraft ? (
            <button type="button" onClick={() => onSaveDraft(draft())} disabled={sending} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><FileText className="h-4 w-4" /> Save draft</button>
          ) : null}
          <button type="button" onClick={() => onSend(draft())} disabled={sending} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"><Send className="h-4 w-4" /> {sending ? "Sending…" : "Send"}</button>
        </div>
      </div>
    </div>
  );
}
