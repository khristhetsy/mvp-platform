"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clausesFor, fieldsFor, fieldsInClause, TERM_SHEET_FORMS } from "@/lib/term-sheet/fields";
import { isFilled, missingRequired, normalizeInput, previewHtml, progress } from "@/lib/term-sheet/render";
import { applyStale, hasStaleLinks, linkStatuses, notPlaced, pullFromRoundStructure, suggestFormType } from "@/lib/term-sheet/round-structure";
import type { LinkedField, RoundStructureInputs, TermSheet, TermSheetFormType, TermSheetValues } from "@/lib/term-sheet/types";
import { TERM_SHEET_FORM_TYPES } from "@/lib/term-sheet/types";
import { formatPt } from "@/lib/documents/na-shared";
import { FounderModulePreview, PreviewButton } from "./FounderModulePreview";

interface Flags {
  roundStructure: boolean;
  documentsUpload: boolean;
  wordExport: boolean;
}
interface SavedRS {
  inputs: RoundStructureInputs;
  updatedAt: string | null;
}

/** The founder notice. Shown outside the term sheet text so the template stays exactly as written. */
export const FOUNDER_NOTICE =
  "iCFO Capital Global, Inc. and iCapOS are not law firms, broker dealers, investment advisers or funding portals. This tool fills in a template. It does not give legal, tax, investment or compliance advice, does not review whether the terms suit your deal, and does not offer or solicit securities for you. You choose the terms, and you are responsible for compliance with all securities laws, including the exemption you rely on, investor eligibility, state filings and disclosure rules. Have your own securities counsel review the term sheet before you send it or sign it. Using this tool does not create an advisory or attorney client relationship.";

const DOC_CSS = `
.ts-page{background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:28px 34px;font-family:"Times New Roman",Times,serif;font-size:13px;line-height:1.5;color:#111}
.ts-lh{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px}
.ts-lh img{height:40px}
.ts-lh div{font:9px/1.35 system-ui,sans-serif;color:#222}
.ts-doc p{margin:0 0 9px}
.ts-doc table{width:100%;border-collapse:collapse;margin:6px 0}
.ts-doc td,.ts-doc th{vertical-align:top;padding:5px 8px 5px 0;text-align:left;font-weight:normal}
.ts-doc blockquote{margin:0 0 9px 26px}
.ts-doc .fld{border-radius:2px;cursor:pointer}
.ts-doc .fld.blank{background:#fff176}
.ts-doc .fld.tv{background:#dbeafe}
.ts-doc .fld.filled{background:#dcfce7}
.ts-doc .fld.act{outline:2px solid #2E78F5}
.ts-foot{display:flex;justify-content:space-between;border-top:1px solid #ccc;margin-top:16px;padding-top:6px;font-size:10px;color:#444}
`;

function authedJson(res: Response): Promise<Record<string, unknown>> {
  return res.json().catch(() => ({}));
}

export function TermSheetCreatorClient({ companyName }: Readonly<{ companyName: string }>) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flags, setFlags] = useState<Flags>({ roundStructure: true, documentsUpload: true, wordExport: true });
  const [rs, setRs] = useState<SavedRS | null>(null);
  const [sheets, setSheets] = useState<TermSheet[]>([]);

  // Start screen
  const [ack1, setAck1] = useState(false);
  const [source, setSource] = useState<"round_structure" | "scratch">("scratch");
  const [pickForm, setPickForm] = useState<TermSheetFormType>("safe");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);

  // Editor
  const [sheet, setSheet] = useState<TermSheet | null>(null);
  const [values, setValues] = useState<TermSheetValues>({});
  const [linked, setLinked] = useState<Record<string, LinkedField>>({});
  const [active, setActive] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [preview, setPreview] = useState<null | "pdf" | "live">(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [ack2, setAck2] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const docRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const applyList = useCallback((j: Record<string, unknown>) => {
    setSheets((j.termSheets as TermSheet[]) ?? []);
    setRs((j.roundStructure as SavedRS | null) ?? null);
    if (j.flags) setFlags(j.flags as Flags);
    const saved = j.roundStructure as SavedRS | null;
    if (saved && (j.flags as Flags | undefined)?.roundStructure !== false) {
      setSource("round_structure");
      setPickForm(suggestFormType(saved.inputs.roundType));
    }
  }, []);

  /** Reload the list (used when the founder goes back to All term sheets). */
  function reload() {
    fetch("/api/founder/term-sheet")
      .then((r) => r.json())
      .then((j) => { if (!j.error) applyList(j); })
      .catch(() => {});
  }

  useEffect(() => {
    let on = true;
    fetch("/api/founder/term-sheet")
      .then(async (r) => ({ ok: r.ok, j: await authedJson(r) }))
      .then(({ ok, j }) => {
        if (!on) return;
        if (!ok) { setError(typeof j.error === "string" ? j.error : "Could not load."); return; }
        applyList(j);
      })
      .catch(() => on && setError("Could not load your term sheets."))
      .finally(() => on && setLoading(false));
    return () => { on = false; };
  }, [applyList]);

  const form = sheet?.formType ?? null;
  const clauses = useMemo(() => (form ? clausesFor(form) : []), [form]);
  const activeClause = clauses.includes(active) ? active : (clauses[0] ?? "");
  const statuses = useMemo(() => (form ? linkStatuses(form, values, linked, rs?.inputs ?? null) : []), [form, values, linked, rs]);
  const statusOf = useMemo(() => Object.fromEntries(statuses.map((s) => [s.id, s])), [statuses]);
  const html = useMemo(() => (form ? previewHtml(form, values) : ""), [form, values]);
  const prog = form ? progress(form, values) : { done: 0, total: 0 };
  const missing = form ? missingRequired(form, values) : [];

  // Highlight the blanks of the open clause and scroll the first into view.
  useEffect(() => {
    const root = docRef.current;
    if (!root || !form) return;
    const ids = new Set(fieldsInClause(form, activeClause).map((f) => f.id));
    let first: HTMLElement | null = null;
    root.querySelectorAll<HTMLElement>(".fld").forEach((el) => {
      const on = ids.has(el.dataset.f ?? "");
      el.classList.toggle("act", on);
      if (on && !first) first = el;
    });
    (first as HTMLElement | null)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeClause, form, html]);

  function openSheet(s: TermSheet) {
    setSheet(s);
    setValues(s.values);
    setLinked(s.linkedFields);
    setDirty(false);
    setFinalized(false);
    setActive("");
    setSavedAt(s.updatedAt ? formatPt(s.updatedAt) : null);
  }

  async function create(opts: { values?: TermSheetValues; src?: "uploaded"; form?: TermSheetFormType }) {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/founder/term-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType: opts.form ?? pickForm,
          fromRoundStructure: !opts.src && source === "round_structure" && flags.roundStructure && Boolean(rs),
          values: opts.values,
          source: opts.src,
          ackNotice: ack1,
        }),
      });
      const j = await authedJson(res);
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not create the term sheet.");
      const created = j.termSheet as TermSheet;
      setSheets((prev) => [created, ...prev]);
      openSheet(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the term sheet.");
    } finally {
      setCreating(false);
    }
  }

  async function importFile(file: File) {
    setImporting(true);
    setImportNote(null);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/founder/term-sheet/import", { method: "POST", body: fd });
      const j = await authedJson(res);
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not read that file.");
      const f = j.formType as TermSheetFormType;
      const found = Number(j.found ?? 0);
      setPickForm(f);
      setImportNote(`Read ${found} blank${found === 1 ? "" : "s"} from your file. Review them in the creator. Anything we could not match stays empty.`);
      await create({ values: j.values as TermSheetValues, src: "uploaded", form: f });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file.");
    } finally {
      setImporting(false);
    }
  }

  function setV(id: string, v: string) {
    setValues((prev) => ({ ...prev, [id]: v }));
    setDirty(true);
  }

  function tidy(id: string) {
    if (!form) return;
    const def = fieldsFor(form).find((f) => f.id === id);
    if (!def) return;
    setValues((prev) => ({ ...prev, [id]: normalizeInput(def, prev[id] ?? "") }));
  }

  function pull(id: string, to: string) {
    const link = pullFromRoundStructure(form as TermSheetFormType, rs!.inputs).linked[id];
    setValues((prev) => ({ ...prev, [id]: to }));
    if (link) setLinked((prev) => ({ ...prev, [id]: link }));
    setDirty(true);
  }

  function updateLinked() {
    const next = applyStale(values, linked, statuses);
    setValues(next.values);
    setLinked(next.linked);
    setDirty(true);
  }

  function keepMine() {
    const stale = new Set(statuses.filter((s) => s.state === "stale").map((s) => s.id));
    setLinked((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !stale.has(id))));
    setDirty(true);
  }

  async function save(): Promise<boolean> {
    if (!sheet) return false;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/founder/term-sheet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sheet.id, values, linkedFields: linked }),
      });
      const j = await authedJson(res);
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not save.");
      const next = j.termSheet as TermSheet;
      setSheet(next);
      setSavedAt(formatPt(next.updatedAt ?? new Date().toISOString()));
      setDirty(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function fetchFile(kind: "pdf" | "docx"): Promise<Blob | null> {
    if (!form) return null;
    const res = await fetch(`/api/founder/term-sheet/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formType: form, values, download: kind === "pdf" }),
    });
    if (!res.ok) {
      const j = await authedJson(res);
      setError(typeof j.error === "string" ? j.error : `Could not build the ${kind.toUpperCase()}.`);
      return null;
    }
    return res.blob();
  }

  async function download(kind: "pdf" | "docx") {
    setBusyFile(kind);
    setError(null);
    const blob = await fetchFile(kind);
    setBusyFile(null);
    if (!blob || !form) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${companyName} ${TERM_SHEET_FORMS[form].label} term sheet.${kind}`.replace(/[^a-zA-Z0-9._ -]/g, "");
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function openPreview() {
    setPreview("live");
  }

  async function showPdf() {
    setPreview("pdf");
    setPdfUrl(null);
    const blob = await fetchFile("pdf");
    if (blob) setPdfUrl(URL.createObjectURL(blob));
  }

  function closePreview() {
    setPreview(null);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
  }

  async function finalize() {
    if (!sheet) return;
    setFinalizing(true);
    setError(null);
    try {
      if (!(await save())) return;
      const res = await fetch("/api/founder/term-sheet/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sheet.id, ackNotice: ack2 }),
      });
      const j = await authedJson(res);
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not upload.");
      setFinalizeOpen(false);
      setFinalized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload.");
    } finally {
      setFinalizing(false);
    }
  }

  if (loading) return <p className="mt-6 text-sm text-[var(--text-muted)]">Loading your term sheets…</p>;

  const noticeCard = (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">Important notice for founders</p>
      <p className="mt-1 text-[13px] leading-relaxed text-amber-900">{FOUNDER_NOTICE}</p>
    </div>
  );

  // ── Start screen ──────────────────────────────────────────────────────────
  if (!sheet) {
    const rsForm = rs ? suggestFormType(rs.inputs.roundType) : null;
    const pulled = rs ? pullFromRoundStructure(pickForm, rs.inputs) : null;
    const notIn = rs ? notPlaced(pickForm, rs.inputs) : [];
    return (
      <div className="mt-4 space-y-4">
        {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
        {noticeCard}
        <label className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-white p-3 text-sm text-[var(--text-primary)]">
          <input id="ts-ack1" type="checkbox" checked={ack1} onChange={(e) => setAck1(e.target.checked)} className="mt-0.5" />
          <span>I have read this notice. I understand iCFO and iCapOS are not advising me and I am responsible for my own compliance.</span>
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            disabled={!rs || !flags.roundStructure}
            onClick={() => { setSource("round_structure"); if (rsForm) setPickForm(rsForm); }}
            className={`rounded-xl border p-4 text-left ${source === "round_structure" ? "border-[var(--indigo)] bg-[var(--indigo-soft)]" : "border-[var(--border-subtle)] bg-white"} disabled:opacity-50`}
          >
            <p className="text-sm font-semibold text-[var(--navy)]">Generate from my Round structure</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {!flags.roundStructure
                ? "Not available right now."
                : rs
                  ? `Uses your saved Round structure (updated ${rs.updatedAt ? formatPt(rs.updatedAt) : "earlier"}). Only blanks the template has are filled.`
                  : "Open the Round structure page and run the analysis or tap Save first. Then it shows here."}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setSource("scratch")}
            className={`rounded-xl border p-4 text-left ${source === "scratch" ? "border-[var(--indigo)] bg-[var(--indigo-soft)]" : "border-[var(--border-subtle)] bg-white"}`}
          >
            <p className="text-sm font-semibold text-[var(--navy)]">Build from scratch</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Start with every blank empty and fill them in yourself.</p>
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {TERM_SHEET_FORM_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setPickForm(t)}
              className={`rounded-xl border p-4 text-left ${pickForm === t ? "border-[var(--indigo)] bg-[var(--indigo-soft)]" : "border-[var(--border-subtle)] bg-white"}`}
            >
              <p className="text-sm font-semibold text-[var(--navy)]">{TERM_SHEET_FORMS[t].label}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{TERM_SHEET_FORMS[t].blurb}</p>
              {rsForm === t && <p className="mt-2 text-[11px] font-semibold text-emerald-700">Matches your Round structure</p>}
            </button>
          ))}
        </div>

        {source === "round_structure" && rs && pulled && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-4 text-sm">
            <p className="font-semibold text-[var(--navy)]">What your Round structure fills in the {TERM_SHEET_FORMS[pickForm].label} template</p>
            <ul className="mt-2 space-y-1 text-[13px] text-[var(--text-secondary)]">
              {Object.entries(pulled.values).map(([id, v]) => (
                <li key={id}>
                  <span className="font-semibold">{fieldsFor(pickForm).find((f) => f.id === id)?.label}:</span> {v}
                  {pulled.linked[id]?.key === "derived" ? " (pre money plus raise)" : ""}
                </li>
              ))}
              {notIn.map((n) => (
                <li key={n.label} className="text-[var(--text-muted)]">
                  <span className="font-semibold">Not placed, {n.label} ({n.value}):</span> {n.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            id="ts-go"
            type="button"
            disabled={!ack1 || creating || (source === "round_structure" && !rs)}
            onClick={() => void create({})}
            className="cap-btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create term sheet"}
          </button>
          <input ref={fileRef} type="file" accept=".pdf,.docx,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ""; }} />
          <button type="button" disabled={!ack1 || importing} onClick={() => fileRef.current?.click()} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] disabled:opacity-50">
            {importing ? "Reading…" : "Upload an existing term sheet to pre fill"}
          </button>
          {!ack1 && <span className="text-xs text-[var(--text-muted)]">Tick the notice to continue.</span>}
        </div>
        {importNote && <p className="text-xs text-emerald-700">{importNote}</p>}
        <p className="text-xs text-[var(--text-muted)]">Upload reads text from a text based PDF or Word file. Scanned PDFs are not read.</p>

        {sheets.length > 0 && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
            <p className="text-sm font-semibold text-[var(--navy)]">Your term sheets</p>
            <ul className="mt-2 divide-y divide-slate-100">
              {sheets.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>
                    {s.title || TERM_SHEET_FORMS[s.formType].label}
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{s.status === "finalized" ? "Uploaded" : "Draft"}</span>
                    <span className="ml-2 text-xs text-[var(--text-muted)]">{s.updatedAt ? formatPt(s.updatedAt) : ""}</span>
                  </span>
                  <button type="button" onClick={() => openSheet(s)} className="rounded-md border border-[var(--border-subtle)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">Open</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // ── Finalized card ────────────────────────────────────────────────────────
  if (finalized && form) {
    return (
      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-base font-semibold text-emerald-800">Term sheet saved to Documents</p>
        <p className="mt-1 text-sm text-emerald-700">
          Your {TERM_SHEET_FORMS[form].label} term sheet {flags.wordExport ? "(PDF and Word)" : "(PDF)"} is in your Documents under Term Sheet.
        </p>
        <button type="button" onClick={() => setFinalized(false)} className="mt-4 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700">
          Keep editing
        </button>
      </div>
    );
  }

  // ── Editor ────────────────────────────────────────────────────────────────
  const meta = TERM_SHEET_FORMS[sheet.formType];
  const clauseFields = fieldsInClause(sheet.formType, activeClause);
  const clauseDone = (c: string) => fieldsInClause(sheet.formType, c).filter((f) => f.req).every((f) => isFilled(f, values));
  const clauseHasReq = (c: string) => fieldsInClause(sheet.formType, c).some((f) => f.req);
  const stale = hasStaleLinks(statuses);
  const staleCount = statuses.filter((s) => s.state === "stale").length;

  return (
    <div className="mt-4">
      <style>{DOC_CSS}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-white px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            {meta.label} · {prog.done} / {prog.total} required blanks filled
          </div>
          <div className="mt-1 h-1.5 w-44 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[var(--indigo)]" style={{ width: `${Math.round((prog.done / Math.max(1, prog.total)) * 100)}%` }} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {savedAt && !dirty && <span className="text-xs text-emerald-700">Saved {savedAt}</span>}
          {dirty && <span className="text-xs text-amber-700">Unsaved changes</span>}
          <PreviewButton onClick={() => void openPreview()} />
          <button type="button" onClick={() => void save()} disabled={saving} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
          {flags.wordExport && (
            <button type="button" onClick={() => void download("docx")} disabled={busyFile === "docx"} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] disabled:opacity-50">Word</button>
          )}
          <button type="button" onClick={() => void download("pdf")} disabled={busyFile === "pdf"} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] disabled:opacity-50">PDF</button>
          {flags.documentsUpload && (
            <button type="button" onClick={() => { setAck2(false); setFinalizeOpen(true); }} className="cap-btn-primary rounded-md px-3 py-2 text-sm font-medium">Finalize and upload to Documents</button>
          )}
          <button type="button" onClick={() => { setSheet(null); reload(); }} className="rounded-md px-2 py-2 text-xs font-medium text-[var(--text-muted)] underline">All term sheets</button>
        </div>
      </div>

      <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
        Not legal, tax, investment or compliance advice. You choose the terms and you are responsible for compliance. Have your own securities counsel review this term sheet.
      </p>

      {error && <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {stale && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <span>Your Round structure changed since you pulled {staleCount} blank{staleCount === 1 ? "" : "s"}. Blanks you edited yourself are left alone.</span>
          <span className="flex gap-2">
            <button type="button" onClick={updateLinked} className="rounded-md bg-sky-700 px-3 py-1 text-xs font-medium text-white">Update linked blanks</button>
            <button type="button" onClick={keepMine} className="rounded-md border border-sky-300 bg-white px-3 py-1 text-xs font-medium text-sky-800">Keep my term sheet</button>
          </span>
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-[210px_1fr] lg:grid-cols-[210px_1fr_380px]">
        <aside className="rounded-xl border border-[var(--border-subtle)] bg-white p-3">
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Clauses with blanks</p>
          {clauses.map((c) => (
            <button type="button" key={c} onClick={() => setActive(c)} className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition ${activeClause === c ? "bg-[var(--indigo-soft)] font-semibold text-[var(--navy)]" : "text-[var(--text-secondary)] hover:bg-slate-50"}`}>
              <span className={`inline-block h-1.5 w-1.5 flex-none rounded-full ${clauseHasReq(c) ? (clauseDone(c) ? "bg-emerald-500" : "bg-slate-300") : "bg-sky-300"}`} />
              <span className="flex-1">{c}</span>
            </button>
          ))}
        </aside>

        <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
          <h2 className="text-base font-semibold text-[var(--navy)]">{activeClause}</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Only the highlighted blanks in this clause are editable. The rest of the clause stays as written in your template. To change clause wording, download the Word file and edit it there.</p>
          <div className="mt-4 space-y-4">
            {clauseFields.map((f) => {
              const st = statusOf[f.id];
              const filled = isFilled(f, values);
              const tag = st?.state === "synced" && linked[f.id]
                ? <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">From Round structure</span>
                : st?.state === "stale"
                  ? <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">Round structure changed, now {st.current}</span>
                  : st?.state === "edited"
                    ? <button type="button" onClick={() => pull(f.id, st.current ?? "")} className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Edited, Round structure has {st.current}. Reset</button>
                    : st?.state === "none"
                      ? <button type="button" onClick={() => pull(f.id, st.current ?? "")} className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">Pull from Round structure</button>
                      : !f.req
                        ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Template value</span>
                        : null;
              return (
                <div key={f.id}>
                  <label className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]" htmlFor={`ts-${f.id}`}>
                    <span>{f.label}</span>
                    {tag}
                  </label>
                  <div className="flex items-center gap-1.5">
                    {f.kind === "num" && f.prefix ? <span className="text-sm text-slate-500">{f.prefix}</span> : f.kind === "text" && f.prefix ? <span className="text-sm text-slate-500">{f.prefix}</span> : null}
                    <input
                      id={`ts-${f.id}`}
                      value={values[f.id] ?? ""}
                      onChange={(e) => setV(f.id, e.target.value)}
                      onBlur={() => tidy(f.id)}
                      placeholder={f.req ? (f.core ?? f.ph) : (f.core ?? f.ph)}
                      className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                    />
                    {f.kind === "num" && f.suffix ? <span className="text-sm text-slate-500">{f.suffix.trim()}</span> : f.kind === "words" ? <span className="text-sm text-slate-500">months</span> : null}
                  </div>
                  {!f.req && !filled && <p className="mt-1 text-[11px] text-[var(--text-muted)]">Printed as in the template ({f.ph}). Type a value to confirm or change it.</p>}
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex justify-between">
            <button type="button" disabled={clauses.indexOf(activeClause) <= 0} onClick={() => setActive(clauses[clauses.indexOf(activeClause) - 1])} className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-[var(--text-secondary)] disabled:opacity-40">Back</button>
            <button type="button" disabled={clauses.indexOf(activeClause) >= clauses.length - 1} onClick={() => setActive(clauses[clauses.indexOf(activeClause) + 1])} className="cap-btn-primary rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40">Next clause</button>
          </div>
        </section>

        <aside className="hidden max-h-[80vh] overflow-y-auto lg:block">
          <TermSheetPage html={html} footer={meta.footer} docRef={docRef} onBlank={(id) => { const d = fieldsFor(sheet.formType).find((x) => x.id === id); if (d) setActive(d.sec); }} />
        </aside>
      </div>

      {preview && (
        <FounderModulePreview title={`${meta.label} term sheet`} subtitle={companyName} onClose={closePreview}>
          <div className="mb-3 flex gap-2 text-sm">
            <button type="button" onClick={() => setPreview("live")} className={`rounded-md px-3 py-1.5 font-medium ${preview === "live" ? "bg-[var(--indigo-soft)] text-[var(--navy)]" : "border border-[var(--border-subtle)] text-[var(--text-secondary)]"}`}>Live fill</button>
            <button type="button" onClick={() => void showPdf()} className={`rounded-md px-3 py-1.5 font-medium ${preview === "pdf" ? "bg-[var(--indigo-soft)] text-[var(--navy)]" : "border border-[var(--border-subtle)] text-[var(--text-secondary)]"}`}>PDF pages</button>
          </div>
          {preview === "live" ? (
            <TermSheetPage html={html} footer={meta.footer} />
          ) : pdfUrl ? (
            <iframe title="Term sheet PDF" src={pdfUrl} className="h-[70vh] w-full rounded-md border border-slate-200" />
          ) : (
            <p className="py-10 text-center text-sm text-[var(--text-muted)]">Building the PDF…</p>
          )}
          <p className="mt-3 text-xs text-[var(--text-muted)]">The Word file is the exact template format. The PDF follows it. Both hold the same text.</p>
        </FounderModulePreview>
      )}

      {finalizeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-[var(--navy)]">Finalize and upload to Documents</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Saves your {meta.label} term sheet to Documents as {flags.wordExport ? "a PDF and a Word file" : "a PDF"} under Term Sheet.
            </p>
            {missing.length > 0 && (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Still empty: {missing.map((m) => m.label).join(", ")}. Empty blanks print as in the template, highlighted in the Word file.
              </p>
            )}
            <div className="mt-3">{noticeCard}</div>
            <label className="mt-3 flex items-start gap-2 text-sm text-[var(--text-primary)]">
              <input id="ts-ack2" type="checkbox" checked={ack2} onChange={(e) => setAck2(e.target.checked)} className="mt-0.5" />
              <span>I understand this term sheet is not reviewed or approved by iCFO or iCapOS and I will have my own counsel review it.</span>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setFinalizeOpen(false)} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)]">Cancel</button>
              <button id="ts-upload" type="button" disabled={!ack2 || finalizing} onClick={() => void finalize()} className="cap-btn-primary rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50">{finalizing ? "Uploading…" : "Upload to Documents"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TermSheetPage({
  html,
  footer,
  docRef,
  onBlank,
}: Readonly<{ html: string; footer: string; docRef?: React.RefObject<HTMLDivElement | null>; onBlank?: (id: string) => void }>) {
  return (
    <div className="ts-page">
      <style>{DOC_CSS}</style>
      <div className="ts-lh">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/term-sheet-letterhead.png" alt="iCFO Venture Group" />
        <div>La Jolla Executive Center<br />4225 Executive Square, Suite 600-#690<br />La Jolla, CA 92037<br />Main Office: (619) 956-9114<br />service@myicfos.com</div>
      </div>
      <div
        ref={docRef}
        className="ts-doc"
        onClick={(e) => { const el = (e.target as HTMLElement).closest<HTMLElement>(".fld"); if (el?.dataset.f && onBlank) onBlank(el.dataset.f); }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <div className="ts-foot"><span>{footer}</span><span>1</span></div>
    </div>
  );
}
