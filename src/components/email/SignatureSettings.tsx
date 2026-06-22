"use client";

import { useEffect, useRef, useState } from "react";
import { PenLine, Check, Bold, Italic, Underline, Link2, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Eraser, Loader2 } from "lucide-react";

function escapeText(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function textToHtml(t: string): string {
  return escapeText(t).replace(/\n/g, "<br/>");
}
function looksHtml(s: string): boolean {
  return /<[a-z!/][\s\S]*>/i.test(s);
}

const SWATCHES = ["#0F2147", "#185FA5", "#0D9488", "#475569", "#A32D2D", "#000000"];

/**
 * Rich email-signature editor (contentEditable). Produces HTML that's sanitized
 * server-side and appended to outgoing CapitalOS mail.
 */
export function SignatureSettings() {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/preferences/signature");
        if (!res.ok) return;
        const data = await res.json();
        const sig: string = data.signature ?? "";
        // The editor div is always mounted now, so ref.current is available here.
        if (active && ref.current) ref.current.innerHTML = sig ? (looksHtml(sig) ? sig : textToHtml(sig)) : "";
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // execCommand is deprecated but remains the simplest cross-browser rich-text path here.
  const cmd = (c: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(c, false, val);
  };

  const addLink = () => {
    const url = window.prompt("Link URL (https://…)");
    if (url) cmd("createLink", url);
  };

  const onImage = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/preferences/signature/image", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        ref.current?.focus();
        document.execCommand("insertHTML", false, `<img src="${data.url}" alt="" style="max-width:220px;height:auto;" />`);
      } else {
        setMsg({ text: typeof data.error === "string" ? data.error : "Image upload failed.", ok: false });
      }
    } catch {
      setMsg({ text: "Image upload failed.", ok: false });
    } finally {
      setUploading(false);
    }
  };

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const html = ref.current?.innerHTML ?? "";
      const res = await fetch("/api/preferences/signature", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: html }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Save failed.");
      }
      setMsg({ text: "Signature saved.", ok: true });
      setTimeout(() => setMsg(null), 2500);
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Save failed.", ok: false });
    } finally {
      setSaving(false);
    }
  }

  const TB = "rounded p-1.5 text-slate-600 hover:bg-slate-100";

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
      <div className="mb-3 flex items-center gap-2">
        <PenLine className="h-5 w-5 text-[var(--gold)]" strokeWidth={1.75} aria-hidden />
        <div>
          <p className="text-sm font-semibold text-slate-950">Email signature</p>
          <p className="text-xs text-slate-500">Appended to messages you send from the inbox. Formatting and images supported.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 bg-slate-50 px-2 py-1.5">
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
              <button type="button" aria-label="Bold" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("bold")} className={TB}><Bold className="h-4 w-4" /></button>
              <button type="button" aria-label="Italic" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("italic")} className={TB}><Italic className="h-4 w-4" /></button>
              <button type="button" aria-label="Underline" title="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("underline")} className={TB}><Underline className="h-4 w-4" /></button>
              <span className="mx-1 h-4 w-px bg-slate-200" />
              <span className="flex items-center gap-1 px-1">
                {SWATCHES.map((c) => (
                  <button key={c} type="button" aria-label={`Text color ${c}`} title="Text color"
                    onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("foreColor", c)}
                    className="h-4 w-4 rounded-full border border-slate-300" style={{ backgroundColor: c }} />
                ))}
              </span>
              <span className="mx-1 h-4 w-px bg-slate-200" />
              <button type="button" aria-label="Insert link" title="Insert link" onMouseDown={(e) => e.preventDefault()} onClick={addLink} className={TB}><Link2 className="h-4 w-4" /></button>
              <button type="button" aria-label="Insert image" title="Insert image" onMouseDown={(e) => e.preventDefault()} onClick={() => fileRef.current?.click()} className={TB}>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}</button>
              <span className="mx-1 h-4 w-px bg-slate-200" />
              <button type="button" aria-label="Align left" title="Align left" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("justifyLeft")} className={TB}><AlignLeft className="h-4 w-4" /></button>
              <button type="button" aria-label="Align center" title="Align center" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("justifyCenter")} className={TB}><AlignCenter className="h-4 w-4" /></button>
              <button type="button" aria-label="Align right" title="Align right" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("justifyRight")} className={TB}><AlignRight className="h-4 w-4" /></button>
              <span className="mx-1 h-4 w-px bg-slate-200" />
              <button type="button" aria-label="Bullet list" title="Bullet list" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("insertUnorderedList")} className={TB}><List className="h-4 w-4" /></button>
              <button type="button" aria-label="Numbered list" title="Numbered list" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("insertOrderedList")} className={TB}><ListOrdered className="h-4 w-4" /></button>
              <button type="button" aria-label="Clear formatting" title="Clear formatting" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("removeFormat")} className={TB}><Eraser className="h-4 w-4" /></button>
            </div>
            <div
              ref={ref}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-label="Email signature editor"
              aria-multiline="true"
              className="min-h-[150px] w-full px-4 py-3 text-sm leading-relaxed text-slate-800 focus:outline-none [&_a]:text-[#185FA5] [&_a]:underline [&_img]:my-1 [&_img]:inline-block"
            />
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(e) => { void onImage(e.target.files); e.target.value = ""; }} />
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button type="button" onClick={() => void save()} disabled={saving || loading} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
              <Check className="h-4 w-4" /> {saving ? "Saving…" : "Save signature"}
            </button>
            {loading ? <span className="text-xs text-slate-400">Loading…</span> : null}
            {msg ? <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span> : null}
          </div>
    </div>
  );
}
