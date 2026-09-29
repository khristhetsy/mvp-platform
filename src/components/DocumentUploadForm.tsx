"use client";

/**
 * Founder document upload — many files per category.
 *   Each category is a folder: count, "+ Add", and its active files (View · Replace · Archive).
 *   The drop zone takes several PDFs at once; a dialog then asks which category they join
 *   (pre-filled when opened from a category's "+ Add" or a file's "Replace").
 *   Uploads ADD — nothing is archived unless you choose Replace or Archive on a file.
 *   N/A stays on the two optional categories and only while they are empty.
 */
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PDF_ONLY, validateFile } from "@/lib/uploads/policy";
import { DocumentViewButton } from "@/components/founder/DocumentViewButton";

export type CategoryFile = { id: string; fileName: string; label: string | null; createdAt: string; summarized: boolean };

type Props = {
  companyId: string;
  companyName: string;
  documentTypes: { label: string; value: string }[];
  /** Active (non-archived) files per UI type value, newest first. */
  filesByType?: Record<string, CategoryFile[] | undefined>;
  /** Canonical document-type codes currently flagged "Not applicable". */
  notApplicableTypes?: string[];
  maxUploadBytes: number;
  /** Max PDF page count allowed (0 = no page limit). */
  maxPages?: number;
};

// Types a founder may flag "Not applicable" (must match the API allow-list).
const NA_ALLOWED_UI = new Set(["CUSTOMER_CONTRACTS", "LEGAL_DOCUMENT", "OTHER"]);
const normalizeNa = (value: string) => { const v = value.toUpperCase(); return v === "LEGAL_DOCUMENT" ? "LEGAL_DOCUMENTS" : v; };
const ALLOWED_ACCEPT = PDF_ONLY.ext.join(",");

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, idx)).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}
function fmtDay(iso: string) { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }

/** Guess a category from the filename so the dialog opens on the likely answer. */
function guessType(name: string, types: { value: string }[]): string | null {
  const n = name.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/deck|pitch/, "PITCH_DECK"], [/business\s*plan|bplan/, "BUSINESS_PLAN"], [/cap\s*table|captable/, "CAP_TABLE"],
    [/p&l|pnl|balance|cash|financ|budget|forecast|statement|bank/, "FINANCIALS"], [/team|bio|resume|cv\b/, "TEAM_BIOS"],
    [/contract|msa|agreement|loi|po\b|purchase order|sow/, "CUSTOMER_CONTRACTS"], [/incorporat|bylaw|board|minutes|resolution|consent/, "CORPORATE_DOCUMENTS"],
    [/legal|ip\b|patent|trademark|nda|license|assignment/, "LEGAL_DOCUMENT"], [/market|research|tam|survey|competit/, "MARKET_RESEARCH"],
  ];
  for (const [re, v] of rules) if (re.test(n) && types.some((t) => t.value === v)) return v;
  return null;
}

async function countPdfPages(file: File): Promise<number | null> {
  if (file.type !== "application/pdf") return null;
  try { const { PDFDocument } = await import("pdf-lib"); const doc = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false }); return doc.getPageCount(); } catch { return null; }
}
function toMessage(status: number, body: unknown) {
  if (body && typeof body === "object" && "error" in body && typeof (body as { error?: unknown }).error === "string") return (body as { error: string }).error;
  return status >= 500 ? "Upload failed. Please try again." : "Upload failed.";
}

type Pending = { files: File[]; type: string; label: string; replaceId: string | null; replaceName: string | null };

export function DocumentUploadForm({ companyId, companyName, documentTypes, filesByType = {}, notApplicableTypes = [], maxUploadBytes, maxPages = 0 }: Props) {
  const t = useTranslations("sharedCmp");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [wantType, setWantType] = useState<{ type: string; replaceId: string | null; replaceName: string | null } | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set(documentTypes.filter((d) => (filesByType[d.value.toUpperCase()] ?? []).length > 0).slice(0, 1).map((d) => d.value)));
  const [progress, setProgress] = useState<{ done: number; total: number; pct: number } | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [naSet, setNaSet] = useState<Set<string>>(() => new Set(notApplicableTypes.map((v) => v.toUpperCase())));
  const [dragging, setDragging] = useState(false);
  const debugEnabled = process.env.NODE_ENV !== "production";

  function toggleOpen(v: string) { setOpen((s) => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n; }); }

  /** Open the file picker with a category already chosen (from "+ Add" or "Replace"). */
  function pickFor(type: string, replaceId: string | null = null, replaceName: string | null = null) {
    setWantType({ type, replaceId, replaceName });
    if (fileRef.current) { fileRef.current.multiple = !replaceId; fileRef.current.value = ""; fileRef.current.click(); }
  }
  function onFiles(list: FileList | File[] | null) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    const want = wantType; setWantType(null);
    for (const f of files) { const e = validateClientSide(f); if (e) { setNotice({ ok: false, text: `${f.name}: ${e}` }); return; } }
    const type = want?.type ?? guessType(files[0].name, documentTypes) ?? documentTypes[0]?.value ?? "OTHER";
    setPending({ files: want?.replaceId ? files.slice(0, 1) : files, type, label: "", replaceId: want?.replaceId ?? null, replaceName: want?.replaceName ?? null });
    setNotice(null);
  }
  function validateClientSide(file: File): string | null {
    if (file.size > maxUploadBytes) return `too large (${formatBytes(file.size)}); max is ${formatBytes(maxUploadBytes)}.`;
    const check = validateFile({ name: file.name, type: file.type, size: file.size }, PDF_ONLY);
    return check.ok ? null : check.message;
  }

  async function uploadOne(file: File, type: string, label: string, replaceId: string | null): Promise<string | null> {
    if (maxPages > 0) { const pages = await countPdfPages(file); if (pages !== null && pages > maxPages) return `${file.name}: ${pages} pages — the limit is ${maxPages}.`; }
    const signRes = await fetch("/api/documents/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, documentType: type, fileName: file.name, contentType: file.type, fileSize: file.size }) });
    const sign = (await signRes.json().catch(() => ({}))) as { bucket?: string; path?: string; token?: string; error?: string };
    if (!signRes.ok || !sign.bucket || !sign.path || !sign.token) return `${file.name}: ${sign.error ?? toMessage(signRes.status, sign)}`;
    const { error: storageError } = await createClient().storage.from(sign.bucket).uploadToSignedUrl(sign.path, sign.token, file, { contentType: file.type });
    if (storageError) return `${file.name}: ${storageError.message || "upload failed."}`;
    const fd = new FormData();
    fd.set("companyId", companyId); fd.set("documentType", type); fd.set("storagePath", sign.path); fd.set("fileName", file.name); fd.set("contentType", file.type); fd.set("fileSize", String(file.size));
    if (label) fd.set("label", label);
    if (replaceId) fd.set("replaceDocumentId", replaceId);
    let res = await fetch(debugEnabled ? "/api/documents/upload?debug=1" : "/api/documents/upload", { method: "POST", body: fd });
    if (!res.ok && (res.status === 429 || res.status >= 500)) { await new Promise((r) => setTimeout(r, 650)); res = await fetch("/api/documents/upload", { method: "POST", body: fd }); }
    if (!res.ok) return `${file.name}: ${toMessage(res.status, await res.json().catch(() => null))}`;
    return null;
  }

  async function runPending() {
    if (!pending) return;
    const { files, type, label, replaceId } = pending;
    setPending(null); setProgress({ done: 0, total: files.length, pct: 0 });
    const errors: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const err = await uploadOne(files[i], type, label, i === 0 ? replaceId : null);
      if (err) errors.push(err);
      setProgress({ done: i + 1, total: files.length, pct: Math.round(((i + 1) / files.length) * 100) });
    }
    setProgress(null);
    const typeLabel = documentTypes.find((d) => d.value === type)?.label ?? type;
    setNotice(errors.length ? { ok: false, text: errors.join(" ") } : { ok: true, text: `${files.length} file${files.length === 1 ? "" : "s"} added to ${typeLabel}. ${t("upload_complete")}` });
    setOpen((s) => new Set(s).add(type));
    router.refresh();
  }

  async function setStatus(f: CategoryFile, status: "archived" | "uploaded") {
    if (status === "archived" && !window.confirm(`Archive "${f.label ?? f.fileName}"? It leaves the category, the report and the data room; nothing is deleted.`)) return;
    setBusyId(f.id);
    try {
      const res = await fetch(`/api/documents/${f.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!res.ok) { const j = (await res.json().catch(() => ({}))) as { error?: string }; setNotice({ ok: false, text: j.error ?? "Couldn't update the file." }); return; }
      router.refresh();
    } finally { setBusyId(null); }
  }
  async function toggleNotApplicable(uiValue: string, next: boolean) {
    const canonical = normalizeNa(uiValue);
    setBusyId(`na:${canonical}`);
    try {
      const res = await fetch("/api/documents/not-applicable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, documentType: uiValue, notApplicable: next }) });
      if (!res.ok) { const j = (await res.json().catch(() => ({}))) as { error?: string }; setNotice({ ok: false, text: j.error ?? "Unable to update." }); return; }
      setNaSet((prev) => { const c = new Set(prev); if (next) c.add(canonical); else c.delete(canonical); return c; });
      router.refresh();
    } finally { setBusyId(null); }
  }

  const uploading = progress !== null;
  return (
    <div className="mt-8 grid gap-4">
      <input ref={fileRef} type="file" accept={ALLOWED_ACCEPT} multiple className="hidden" aria-label="Choose files to upload" onChange={(e) => onFiles(e.target.files)} disabled={uploading} />

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (!uploading) onFiles(e.dataTransfer.files); }}
        className={`rounded-2xl border-2 border-dashed px-6 py-7 text-center ${dragging ? "border-[var(--blue)] bg-[var(--blue-muted)]" : "border-slate-300 bg-slate-50"}`}
      >
        <p className="text-sm font-semibold text-slate-900">Drop PDFs here, or</p>
        <p className="mt-1 text-xs text-slate-500">several at once is fine · {formatBytes(maxUploadBytes)} each · PDF only{maxPages > 0 ? ` · up to ${maxPages} pages` : ""}</p>
        <button type="button" disabled={uploading} onClick={() => pickFor("")} className="cap-btn-primary mt-3 inline-flex rounded-lg px-5 py-2.5 text-sm font-semibold disabled:opacity-60">Choose files</button>
      </div>
      <p className="text-sm text-slate-600">Uploading for <span className="font-semibold text-slate-950">{companyName}</span></p>

      {progress ? (
        <div className="grid gap-2"><div className="h-2 w-full rounded-full bg-slate-100"><div className="h-2 rounded-full bg-slate-950" style={{ width: `${progress.pct}%` }} /></div><p className="text-xs text-slate-600">Uploading {progress.done} of {progress.total}…</p></div>
      ) : null}
      {notice ? <p className={`rounded-xl p-3 text-sm ${notice.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{notice.text}</p> : null}

      {/* Categories */}
      <div className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t("document_type")}</p>
        {documentTypes.map((type) => {
          const files = filesByType[type.value.toUpperCase()] ?? [];
          const canBeNa = NA_ALLOWED_UI.has(type.value.toUpperCase());
          const isNa = naSet.has(normalizeNa(type.value));
          const isOpen = open.has(type.value);
          return (
            <div key={type.value} className={`rounded-xl border ${isNa ? "border-slate-200 bg-slate-50" : "border-slate-300 bg-white"}`}>
              <div className="flex items-center gap-3 px-4 py-3 text-sm">
                <button type="button" onClick={() => toggleOpen(type.value)} className="flex flex-1 items-center gap-2 text-left font-medium text-slate-900" aria-expanded={isOpen}>
                  <span className={`text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
                  <span className={isNa ? "text-slate-400 line-through" : ""}>{type.label}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{isNa ? "Not applicable" : `${files.length} file${files.length === 1 ? "" : "s"}`}</span>
                </button>
                {canBeNa && (isNa || files.length === 0) ? (
                  <button type="button" onClick={() => void toggleNotApplicable(type.value, !isNa)} disabled={busyId === `na:${normalizeNa(type.value)}` || uploading} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200">{isNa ? "Mark applicable" : "N/A"}</button>
                ) : null}
                {!isNa ? <button type="button" disabled={uploading} onClick={() => pickFor(type.value)} className="text-sm font-semibold text-[var(--blue)] hover:underline disabled:opacity-60">+ Add</button> : null}
              </div>
              {isOpen && !isNa ? (
                <div className="border-t border-slate-100 px-4 py-2 pl-9">
                  {files.length === 0 ? <p className="py-2 text-xs text-slate-400">No files yet.</p> : files.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 border-b border-slate-50 py-2 text-sm last:border-b-0">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-red-50 text-[9px] font-bold text-red-700">PDF</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-800">{f.label ?? f.fileName}</p>
                        <p className="truncate text-[11px] text-slate-500">{f.label ? `${f.fileName} · ` : ""}{fmtDay(f.createdAt)} · {f.summarized ? <span className="text-emerald-700">summarised</span> : <span>reading…</span>}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-xs">
                        <DocumentViewButton documentId={f.id} className="text-slate-600 hover:text-slate-900" />
                        <button type="button" disabled={uploading || busyId === f.id} onClick={() => pickFor(type.value, f.id, f.label ?? f.fileName)} className="text-[var(--blue)] hover:underline">Replace</button>
                        <button type="button" disabled={uploading || busyId === f.id} onClick={() => void setStatus(f, "archived")} className="text-slate-500 hover:text-red-700">Archive</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Category dialog */}
      {pending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="Choose a category">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-950">{pending.replaceId ? `Replace “${pending.replaceName}”` : `Add ${pending.files.length} file${pending.files.length === 1 ? "" : "s"}`}</h3>
            <p className="mt-1 text-xs text-slate-500">{pending.replaceId ? "The old file is archived; the new one takes its place in the category." : "They join whatever is already in the category — nothing is replaced."}</p>
            <div className="mt-3 max-h-40 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200 text-sm">
              {pending.files.map((f) => <div key={f.name + f.size} className="flex items-center gap-2 px-3 py-1.5"><span className="grid h-6 w-6 place-items-center rounded bg-red-50 text-[8px] font-bold text-red-700">PDF</span><span className="min-w-0 flex-1 truncate">{f.name}</span><span className="text-xs text-slate-400">{formatBytes(f.size)}</span></div>)}
            </div>
            <label className="mt-3 block text-xs font-medium text-slate-600">Category
              <select value={pending.type} disabled={Boolean(pending.replaceId)} onChange={(e) => setPending({ ...pending, type: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {documentTypes.map((d) => <option key={d.value} value={d.value} disabled={naSet.has(normalizeNa(d.value))}>{d.label}{naSet.has(normalizeNa(d.value)) ? " (N/A)" : ""}</option>)}
              </select>
            </label>
            <label className="mt-3 block text-xs font-medium text-slate-600">Label <span className="font-normal text-slate-400">(optional — shown to investors and in the report)</span>
              <input value={pending.label} onChange={(e) => setPending({ ...pending, label: e.target.value })} placeholder={pending.files.length > 1 ? "e.g. FY2025 financials" : "e.g. Acme Corp master services agreement"} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setPending(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
              <button type="button" onClick={() => void runPending()} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">{pending.replaceId ? "Replace" : `Upload ${pending.files.length === 1 ? "" : `${pending.files.length} `}as ${documentTypes.find((d) => d.value === pending.type)?.label ?? pending.type}`}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
