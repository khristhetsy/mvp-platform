"use client";

/**
 * Drag and drop contact import for Outreach → Manual (and anywhere a founder
 * imports investors). Drop a CSV, an Excel .xlsx or LinkedIn's Connections.csv,
 * or paste rows from a spreadsheet. Columns are matched to contact fields
 * (contact details and the investor profile), the founder can change any match,
 * and counts (new / existing / no email / no name) show before anything is
 * saved. An email that is already a contact either has its empty fields filled
 * in or is skipped, the founder's choice. Rows go to
 * /api/founder/investor-contacts/import in batches, and a result screen shows
 * what was saved for every field.
 */

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { HoldStatus } from "@/lib/investor-directory/limits";
import { parseCsvCells } from "@/lib/contacts/field-mapping";
import {
  IMPORT_TARGETS,
  TEMPLATE_CSV,
  applyImportMapping,
  autoMap,
  findHeader,
  importGroup,
  type AttentionRow,
  type DuplicateMode,
  type ImportGroup,
  type ImportTarget,
} from "@/lib/founder-crm/import-mapping";

const MAX_ROWS = 5000;
const BATCH = 200;

type Parsed = { fileName: string; columns: string[]; rows: string[][]; linkedin: boolean };

/** What the import saved, shown on the result screen. */
type Summary = {
  imported: number;
  updated: number;
  unchanged: number;
  failed: number;
  overLimit: number;
  fieldCounts: Record<string, number>;
  attention: AttentionRow[];
  columns: string[];
  leftOut: string[];
  fields: string[];
};

type ImportResponse = {
  imported?: number;
  updated?: number;
  unchanged?: number;
  failed?: number;
  overLimit?: number;
  fieldCounts?: Record<string, number>;
  error?: string;
};

/** The saved field each import target ends up in, for the result screen. */
const SAVED_FIELD: Partial<Record<ImportTarget, string>> = {
  full_name: "name",
  first_name: "name",
  last_name: "name",
  email: "email",
  phone: "phone",
  firm_name: "firm_name",
  investor_type: "investor_type",
  sector: "preferred_sectors",
  stage: "preferred_stages",
  check_size: "check_size",
  geography: "geography",
  website: "website",
  linkedin_url: "linkedin_url",
  twitter_url: "twitter_url",
  crunchbase_url: "crunchbase_url",
  position: "notes",
  connected_on: "notes",
  notes: "notes",
};

const FIELD_ORDER: Array<{ key: string; label: string }> = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "firm_name", label: "Firm" },
  { key: "investor_type", label: "Investor type" },
  { key: "preferred_sectors", label: "Sectors" },
  { key: "preferred_stages", label: "Stages" },
  { key: "check_size", label: "Check size" },
  { key: "geography", label: "Geography" },
  { key: "website", label: "Website" },
  { key: "linkedin_url", label: "LinkedIn URL" },
  { key: "twitter_url", label: "Twitter URL" },
  { key: "crunchbase_url", label: "Crunchbase URL" },
  { key: "notes", label: "Notes (title, connected on)" },
];

const GROUP_LABEL: Record<ImportGroup, string> = {
  contact: "Contact",
  profile: "Investor profile",
  skip: "Not imported",
};

function downloadAttentionCsv(columns: string[], rows: AttentionRow[]) {
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [[...columns, "Reason"].map(q).join(",")];
  for (const r of rows) {
    lines.push([...columns.map((_, i) => r.cells[i] ?? ""), r.reason].map(q).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "icapos-import-rows-to-review.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadTemplateCsv() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "icapos-investor-contacts-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ContactImportDialog({
  mode = "file",
  existingEmails,
  hold = null,
  onClose,
  onImported,
}: {
  /** The founder's investor limit. When set, only what fits is imported. */
  hold?: HoldStatus | null;
  /** "linkedin" opens with the LinkedIn steps first. */
  mode?: "file" | "linkedin";
  existingEmails: string[];
  onClose: () => void;
  onImported: (count: number) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<ImportTarget[]>([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("fill");
  const [summary, setSummary] = useState<Summary | null>(null);

  const result = useMemo(
    () => (parsed ? applyImportMapping(parsed.rows, mapping, existingEmails, { duplicateMode }) : null),
    [parsed, mapping, existingEmails, duplicateMode],
  );
  // One investor limit for every source: the first rows that fit are imported.
  const enforced = Boolean(hold?.enforced);
  const room = hold && enforced ? hold.left : Number.MAX_SAFE_INTEGER;
  const full = Boolean(hold && enforced && hold.left <= 0);
  // Filling an existing contact adds no investor, so only brand new rows count against the limit.
  const updateSet = useMemo(() => new Set(result?.updateRows ?? []), [result]);
  const newRows = useMemo(() => (result ? result.rows.filter((r) => !updateSet.has(r)) : []), [result, updateSet]);
  const keptNew = newRows.slice(0, room);
  const toImport = result ? [...result.updateRows, ...keptNew] : [];
  const overBy = newRows.length - keptNew.length;
  const n = (v: number) => v.toLocaleString("en-US");
  const nextPlanLine = hold?.nextPlan ? `move to ${hold.nextPlan.label} for up to ${n(hold.nextPlan.contacts)}` : "";
  const hasName = mapping.includes("full_name") || mapping.includes("first_name") || mapping.includes("last_name");

  function load(fileName: string, cells: string[][]) {
    const h = findHeader(cells);
    if (h.rows.length === 0) {
      setError("No data rows found under the header row.");
      return;
    }
    if (h.rows.length > MAX_ROWS) {
      setError(`Up to ${MAX_ROWS.toLocaleString()} rows per import. Split the file and import it in parts.`);
      return;
    }
    setError(null);
    setParsed({ fileName, columns: h.columns, rows: h.rows, linkedin: h.linkedin });
    setMapping(autoMap(h.columns));
  }

  async function readFile(file: File) {
    setError(null);
    const name = file.name.toLowerCase();
    if (file.size > 10 * 1024 * 1024) {
      setError("That file is over 10 MB.");
      return;
    }
    setReading(true);
    try {
      if (name.endsWith(".xlsx")) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/founder/investor-contacts/parse-file", { method: "POST", body: form });
        const data = (await res.json().catch(() => null)) as { cells?: string[][]; error?: string } | null;
        if (!res.ok || !data?.cells) {
          setError(data?.error ?? "Couldn't read that Excel file.");
          return;
        }
        load(file.name, data.cells);
      } else if (name.endsWith(".csv") || name.endsWith(".txt") || file.type === "text/csv") {
        load(file.name, parseCsvCells(await file.text()));
      } else if (name.endsWith(".xls")) {
        setError("Older .xls files can't be read. In Excel, choose File, Save as, and pick .xlsx or .csv.");
      } else {
        setError("Drop a .csv or .xlsx file.");
      }
    } finally {
      setReading(false);
    }
  }

  function readPasted() {
    const text = pasteText.trim();
    if (!text) {
      setError("Paste at least a header row and one contact.");
      return;
    }
    // Spreadsheet copies arrive tab separated; CSV text keeps its commas.
    const cells = text.includes("\t") ? text.split(/\r?\n/).map((l) => l.split("\t")) : parseCsvCells(text);
    load("Pasted rows", cells);
  }

  async function runImport() {
    if (!result || toImport.length === 0 || !parsed) return;
    setImporting(true);
    setError(null);
    setProgress(0);
    const total = { imported: 0, updated: 0, unchanged: 0, failed: 0, overLimit: 0 };
    const fieldCounts: Record<string, number> = {};
    let stopped = false;
    try {
      for (let i = 0; i < toImport.length; i += BATCH) {
        const batch = toImport.slice(i, i + BATCH);
        const res = await fetch("/api/founder/investor-contacts/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: batch,
            confirm: true,
            duplicateMode,
            source: parsed.linkedin ? "linkedin" : "csv_import",
          }),
        });
        const data = (await res.json().catch(() => null)) as ImportResponse | null;
        if (!res.ok) {
          setError(data?.error ?? "Import stopped partway. Contacts imported so far are saved.");
          stopped = true;
          break;
        }
        total.imported += data?.imported ?? 0;
        total.updated += data?.updated ?? 0;
        total.unchanged += data?.unchanged ?? 0;
        total.failed += data?.failed ?? 0;
        total.overLimit += data?.overLimit ?? 0;
        for (const [field, n] of Object.entries(data?.fieldCounts ?? {})) {
          fieldCounts[field] = (fieldCounts[field] ?? 0) + n;
        }
        setProgress(Math.min(toImport.length, i + batch.length));
      }
    } catch {
      setError("Network error. Contacts imported so far are saved.");
      stopped = true;
    } finally {
      setImporting(false);
    }
    // Show what was saved. If nothing was saved and the import stopped, stay here with the error.
    if (!stopped || total.imported + total.updated > 0) {
      const fields = [...new Set(mapping.map((t) => SAVED_FIELD[t]).filter((f): f is string => Boolean(f)))];
      setSummary({
        ...total,
        fieldCounts,
        attention: result.attention,
        columns: parsed.columns,
        leftOut: parsed.columns.filter((_, i) => (mapping[i] ?? "skip") === "skip"),
        fields,
      });
    }
  }

  /** Close, and tell the page how many contacts were saved so it can refresh. */
  function finish() {
    if (summary) void onImported(summary.imported + summary.updated);
    else onClose();
  }

  const steps =
    mode === "linkedin"
      ? [
          <>On LinkedIn, open <b>Settings and Privacy</b>, then <b>Data privacy</b>, then <b>Get a copy of your data</b>.</>,
          <>Choose <b>Connections</b> and request the archive. LinkedIn emails you a link, usually within minutes.</>,
          <>Download the archive, open it, and drop <b>Connections.csv</b> here.</>,
          <>Check the column matches and counts, then import. LinkedIn only includes an email when the connection allows it.</>,
        ]
      : [
          <>Download the <button type="button" onClick={downloadTemplateCsv} className="font-medium text-[#1A6CE4] hover:underline">CSV template</button>, or use your own file.</>,
          <>Include at least a <b>name</b>. Add an <b>email</b> for anyone you want to contact. Phone, firm, title, industry and stage are optional.</>,
          <>From LinkedIn: Settings and Privacy, Data privacy, Get a copy of your data, Connections. Drop the <b>Connections.csv</b> here.</>,
          <>Check the column matches and counts, then import.</>,
        ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label="Import contacts">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-[15px] font-semibold text-slate-900">
            {summary
              ? mode === "linkedin" ? "LinkedIn import finished" : "Import finished"
              : mode === "linkedin" ? "Import LinkedIn connections" : "Import contacts"}
          </h2>
          <button type="button" onClick={finish} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5">
          {summary ? (
            <ResultView summary={summary} />
          ) : null}
          {!summary && full && hold ? (
            <p className="mb-4 rounded-lg bg-[#FCEBEB] px-3 py-2 text-[12.5px] text-[#791F1F]" role="status">
              You hold {n(hold.held)} of {n(hold.max)} investors on {hold.planLabel}, the most your plan allows. Archive investors you no
              longer need{nextPlanLine ? <>, or <Link href="/upgrade" className="font-semibold underline">{nextPlanLine}</Link></> : null}.
            </p>
          ) : !summary && hold && enforced ? (
            <p className="mb-4 text-[12px] text-slate-500">
              {hold.planLabel} holds up to {n(hold.max)} investors from every source. You can add {n(hold.left)} more.
            </p>
          ) : null}
          {summary ? null : !parsed ? (
            <div className="grid gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <div>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) void readFile(f);
                  }}
                  onClick={() => inputRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
                  role="button"
                  tabIndex={0}
                  className={`flex min-h-[210px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 px-4 py-6 text-center transition-colors ${
                    dragging ? "border-solid border-[#1A6CE4] bg-blue-50" : "border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50"
                  }`}
                >
                  <i className="ti ti-cloud-upload text-[28px] text-[#1A6CE4]" aria-hidden="true" />
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {reading ? "Reading the file…" : dragging ? "Drop to read the file" : "Drag and drop your file here"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">CSV, Excel .xlsx or LinkedIn Connections.csv, up to 5,000 rows</p>
                  <span className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">Browse files</span>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void readFile(f);
                      e.target.value = "";
                    }}
                  />
                </div>
                <button type="button" onClick={() => setPasteOpen((v) => !v)} className="mt-2 text-xs font-medium text-[#1A6CE4] hover:underline">
                  {pasteOpen ? "Hide paste box" : "Or paste rows from a spreadsheet"}
                </button>
                {pasteOpen ? (
                  <div className="mt-2">
                    <textarea
                      value={pasteText}
                      onChange={(e) => { setPasteText(e.target.value); setError(null); }}
                      rows={4}
                      placeholder={"full_name,email,firm\nAda Lovelace,ada@av.com,Analytical Ventures"}
                      className="w-full rounded-md border border-slate-200 px-2.5 py-2 font-mono text-[11.5px]"
                    />
                    <button type="button" onClick={readPasted} className="mt-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      Read pasted rows
                    </button>
                  </div>
                ) : null}
              </div>

              <ol className="space-y-3">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-slate-700">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold text-[#1A6CE4]">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
                {mode === "linkedin" ? (
                  <li className="pl-7 text-xs text-slate-500">
                    Have a different file? <button type="button" onClick={downloadTemplateCsv} className="font-medium text-[#1A6CE4] hover:underline">Download the CSV template</button>.
                  </li>
                ) : null}
              </ol>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <i className="ti ti-file-spreadsheet text-slate-400" aria-hidden="true" />
                <span className="font-medium text-slate-900">{parsed.fileName}</span>
                <span className="text-slate-500">· {parsed.rows.length.toLocaleString()} rows</span>
                {parsed.linkedin ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-[#185FA5]">LinkedIn export</span> : null}
                <button type="button" onClick={() => { setParsed(null); setMapping([]); }} className="ml-auto text-xs font-medium text-[#1A6CE4] hover:underline">
                  Choose another file
                </button>
              </div>

              {parsed.linkedin ? (
                <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] leading-relaxed text-amber-900">
                  LinkedIn withholds most email addresses, so many connections import as names only and cannot be emailed until you add one.
                  LinkedIn also does not export phone numbers or investor profile details. Those stay empty until you import a file that has them.
                </p>
              ) : null}

              <fieldset className="mt-4">
                <legend className="text-[12.5px] font-semibold text-slate-700">If an email is already in your contacts</legend>
                <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                  {([
                    { key: "fill", title: "Fill empty fields only", body: "Adds a missing phone, firm or profile detail. Never overwrites what you already have." },
                    { key: "skip", title: "Skip duplicates", body: "Leaves existing contacts exactly as they are." },
                  ] as const).map((o) => (
                    <label
                      key={o.key}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
                        duplicateMode === o.key ? "border-[#1A6CE4] bg-blue-50/60" : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="duplicate-mode"
                        checked={duplicateMode === o.key}
                        onChange={() => setDuplicateMode(o.key)}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-[13px] font-semibold text-slate-900">{o.title}</span>
                        <span className="block text-[12px] leading-snug text-slate-500">{o.body}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {result ? (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { n: newRows.length, label: "New contacts", tone: "text-emerald-700" },
                    duplicateMode === "fill"
                      ? { n: result.existing, label: "Existing, will be filled in", tone: "text-[#185FA5]" }
                      : { n: result.duplicates, label: "Duplicates, skipped", tone: "text-slate-600" },
                    { n: result.noEmail, label: "No email, saved but cannot be emailed", tone: "text-amber-700" },
                    { n: result.missingName, label: "No name, cannot import", tone: "text-red-700" },
                  ].map((c) => (
                    <div key={c.label} className="rounded-lg border border-slate-200 px-3 py-2">
                      <div className={`text-xl font-bold ${c.tone}`}>{n(c.n)}</div>
                      <div className="text-[11.5px] leading-snug text-slate-500">{c.label}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              {result && duplicateMode === "fill" && result.duplicates > 0 ? (
                <p className="mt-1.5 text-[11.5px] text-slate-500">
                  {n(result.duplicates)} repeated email{result.duplicates === 1 ? "" : "s"} inside the file {result.duplicates === 1 ? "is" : "are"} skipped.
                </p>
              ) : null}

              <div className="mt-4">
                <div className="grid grid-cols-[1fr_1fr_1.1fr] gap-3 border-b border-slate-200 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <span>Your column</span>
                  <span>First row sample</span>
                  <span>Saves to</span>
                </div>
                {(["contact", "profile", "skip"] as const).map((group) => {
                  const cols = parsed.columns
                    .map((col, i) => ({ col, i, t: mapping[i] ?? ("skip" as ImportTarget) }))
                    .filter((c) => importGroup(c.t) === group);
                  if (cols.length === 0) return null;
                  return (
                    <div key={group}>
                      <p className="pb-1 pt-3 text-[12.5px] font-bold text-slate-800">{GROUP_LABEL[group]}</p>
                      {cols.map(({ col, i, t }) => {
                        const sample = parsed.rows.find((r) => (r[i] ?? "").trim())?.[i] ?? "";
                        return (
                          <div key={`${col}-${i}`} className="grid grid-cols-[1fr_1fr_1.1fr] items-center gap-3 border-b border-slate-100 py-1.5">
                            <span className={`truncate text-[13px] font-medium ${t === "skip" ? "text-slate-500" : "text-slate-900"}`}>{col}</span>
                            <span className="truncate text-[12px] text-slate-500">{sample || "empty"}</span>
                            <select
                              value={t}
                              onChange={(e) => {
                                const next = [...mapping];
                                next[i] = e.target.value as ImportTarget;
                                setMapping(next);
                              }}
                              className={`w-full rounded-md border px-2 py-1.5 text-[13px] ${t === "skip" ? "border-amber-200 bg-amber-50/60 text-slate-600" : "border-slate-200 bg-white text-slate-900"}`}
                              aria-label={`Field for ${col}`}
                            >
                              {IMPORT_TARGETS.map((o) => (
                                <option key={o.key} value={o.key}>{o.label}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {!hasName ? (
                <p className="mt-3 text-xs text-red-600">Match a column to Full name, or to First name and Last name, before importing.</p>
              ) : null}
              {hold && overBy > 0 && !full ? (
                <p className="mt-3 rounded-lg bg-[#FFF8EC] px-3 py-2 text-[12.5px] text-[#633806]">
                  {hold.planLabel} holds up to {n(hold.max)} investors and you can add {n(hold.left)} more. The first {n(toImport.length)} rows
                  will be imported{nextPlanLine ? <>, or <Link href="/upgrade" className="font-semibold underline">{nextPlanLine}</Link></> : null}.
                </p>
              ) : null}
            </div>
          )}

          {error ? <p className="mt-3 text-xs text-red-600" role="alert">{error}</p> : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          {importing ? (
            <span className="mr-auto text-xs text-slate-500">Importing {progress.toLocaleString()} of {toImport.length.toLocaleString()}…</span>
          ) : summary ? null : (
            <span className="mr-auto text-xs text-slate-500">Nothing is saved until you press Import.</span>
          )}
          {summary ? (
            <button type="button" onClick={finish} className="cap-btn-primary rounded-md px-4 py-1.5 text-[13px] font-semibold">
              View my contacts
            </button>
          ) : (
            <>
              <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-3.5 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              {parsed ? (
                <button
                  type="button"
                  onClick={() => void runImport()}
                  disabled={importing || !hasName || !result || toImport.length === 0}
                  className="cap-btn-primary rounded-md px-4 py-1.5 text-[13px] font-semibold disabled:opacity-50"
                >
                  {importing ? "Importing…" : `Import ${n(toImport.length)} contact${toImport.length === 1 ? "" : "s"}`}
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const FIELD_LABEL = new Map(FIELD_ORDER.map((f) => [f.key, f.label]));

function ResultView({ summary }: Readonly<{ summary: Summary }>) {
  const n = (v: number) => v.toLocaleString("en-US");
  const saved = summary.imported + summary.updated;
  const rows = FIELD_ORDER.filter((f) => summary.fields.includes(f.key));
  const needLook = summary.attention.length;
  const noName = summary.attention.filter((a) => a.reason === "No name").length;
  const dupes = summary.attention.filter((a) => a.reason === "Duplicate email").length;
  const noEmail = summary.attention.filter((a) => a.reason === "No email").length;
  return (
    <div>
      <p className="text-xl font-bold text-slate-900">{n(saved)} contact{saved === 1 ? "" : "s"} saved</p>
      <p className="mt-1 text-[13px] text-slate-600">
        {n(summary.imported)} new{summary.updated > 0 ? `, ${n(summary.updated)} existing contact${summary.updated === 1 ? "" : "s"} filled in` : ""}
        {summary.unchanged > 0 ? `, ${n(summary.unchanged)} already had everything in the file` : ""}. Here is what was stored for each field.
      </p>

      {saved > 0 ? (
        <div className="mt-3">
          <div className="grid grid-cols-[1.2fr_2fr_1fr] gap-3 border-b border-slate-200 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <span>Field</span>
            <span>Rows with a value saved</span>
            <span className="text-right">Count</span>
          </div>
          {rows.map((f) => {
            const count = summary.fieldCounts[f.key] ?? 0;
            return (
              <div key={f.key} className="grid grid-cols-[1.2fr_2fr_1fr] items-center gap-3 border-b border-slate-100 py-1.5">
                <span className="text-[13px] font-medium text-slate-900">{FIELD_LABEL.get(f.key)}</span>
                <span className="block h-2 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-2 rounded-full bg-[#1A6CE4]" style={{ width: `${Math.min(100, Math.round((count / saved) * 100))}%` }} />
                </span>
                <span className="text-right text-[12.5px] text-slate-600">{n(count)} of {n(saved)}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      {needLook > 0 || summary.failed > 0 || summary.overLimit > 0 || summary.leftOut.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-amber-900">
          <p className="font-semibold">Needs a look</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {noName > 0 ? <li>{n(noName)} row{noName === 1 ? "" : "s"} had no name and {noName === 1 ? "was" : "were"} not imported.</li> : null}
            {dupes > 0 ? <li>{n(dupes)} row{dupes === 1 ? "" : "s"} repeated an email and {dupes === 1 ? "was" : "were"} skipped.</li> : null}
            {noEmail > 0 ? <li>{n(noEmail)} row{noEmail === 1 ? "" : "s"} had no email, so {noEmail === 1 ? "it is" : "they are"} saved but cannot be emailed yet.</li> : null}
            {summary.failed > 0 ? <li>{n(summary.failed)} row{summary.failed === 1 ? "" : "s"} could not be saved. Try importing them again.</li> : null}
            {summary.overLimit > 0 ? <li>{n(summary.overLimit)} row{summary.overLimit === 1 ? "" : "s"} did not fit your plan&apos;s investor limit.</li> : null}
            {summary.leftOut.length > 0 ? <li>Columns left out: {summary.leftOut.join(", ")}.</li> : null}
          </ul>
          {needLook > 0 ? (
            <button
              type="button"
              onClick={() => downloadAttentionCsv(summary.columns, summary.attention)}
              className="mt-2.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-amber-900 hover:bg-amber-100"
            >
              Download the {n(needLook)} row{needLook === 1 ? "" : "s"} as CSV
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
