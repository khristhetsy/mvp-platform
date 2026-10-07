"use client";

/**
 * Drag and drop contact import for Outreach → Manual (and anywhere a founder
 * imports investors). Drop a CSV, an Excel .xlsx or LinkedIn's Connections.csv,
 * or paste rows from a spreadsheet. Columns are matched to contact fields, the
 * founder can change any match, and counts (ready / no email / duplicates) show
 * before anything is saved. Rows go to /api/founder/investor-contacts/import in
 * batches.
 */

import { useMemo, useRef, useState } from "react";
import { parseCsvCells } from "@/lib/contacts/field-mapping";
import {
  IMPORT_TARGETS,
  TEMPLATE_CSV,
  applyImportMapping,
  autoMap,
  findHeader,
  type ImportTarget,
} from "@/lib/founder-crm/import-mapping";

const MAX_ROWS = 5000;
const BATCH = 200;

type Parsed = { fileName: string; columns: string[]; rows: string[][]; linkedin: boolean };

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
  onClose,
  onImported,
}: {
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

  const result = useMemo(
    () => (parsed ? applyImportMapping(parsed.rows, mapping, existingEmails) : null),
    [parsed, mapping, existingEmails],
  );
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
    if (!result || result.rows.length === 0) return;
    setImporting(true);
    setError(null);
    setProgress(0);
    let imported = 0;
    try {
      for (let i = 0; i < result.rows.length; i += BATCH) {
        const batch = result.rows.slice(i, i + BATCH);
        const res = await fetch("/api/founder/investor-contacts/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: batch, confirm: true, source: parsed?.linkedin ? "linkedin" : "csv_import" }),
        });
        const data = (await res.json().catch(() => null)) as { imported?: number; error?: string } | null;
        if (!res.ok) {
          setError(data?.error ?? "Import stopped partway. Contacts imported so far are saved.");
          break;
        }
        imported += data?.imported ?? 0;
        setProgress(Math.min(result.rows.length, i + batch.length));
      }
      await onImported(imported);
    } catch {
      setError("Network error. Contacts imported so far are saved.");
    } finally {
      setImporting(false);
    }
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
          <>Include at least a <b>name</b>. Add an <b>email</b> for anyone you want to contact. Firm, title, industry and stage are optional.</>,
          <>From LinkedIn: Settings and Privacy, Data privacy, Get a copy of your data, Connections. Drop the <b>Connections.csv</b> here.</>,
          <>Check the column matches and counts, then import.</>,
        ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label="Import contacts">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-[15px] font-semibold text-slate-900">
            {mode === "linkedin" ? "Import LinkedIn connections" : "Import contacts"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5">
          {!parsed ? (
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

              <p className="mt-4 text-xs font-medium text-slate-500">Column matches</p>
              <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                {parsed.columns.map((col, i) => {
                  const sample = parsed.rows.find((r) => (r[i] ?? "").trim())?.[i] ?? "";
                  const t = mapping[i] ?? "skip";
                  return (
                    <label key={`${col}-${i}`} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${t === "skip" ? "border-amber-200 bg-amber-50/60" : "border-slate-200 bg-slate-50"}`}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-slate-800">{col}</span>
                        <span className="block truncate text-[11px] text-slate-400">{sample || "empty"}</span>
                      </span>
                      <i className="ti ti-arrow-right text-slate-400" aria-hidden="true" />
                      <select
                        value={t}
                        onChange={(e) => {
                          const next = [...mapping];
                          next[i] = e.target.value as ImportTarget;
                          setMapping(next);
                        }}
                        className="w-36 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[12px]"
                        aria-label={`Field for ${col}`}
                      >
                        {IMPORT_TARGETS.map((o) => (
                          <option key={o.key} value={o.key}>{o.label}</option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>

              {!hasName ? (
                <p className="mt-3 text-xs text-red-600">Match a column to Full name, or to First name and Last name, before importing.</p>
              ) : null}

              {result ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-[12.5px]">
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-medium text-[#185FA5]">{result.rows.length.toLocaleString()} ready</span>
                  {result.noEmail > 0 ? <span className="text-amber-700">{result.noEmail.toLocaleString()} without email (imported, can&apos;t be emailed)</span> : null}
                  {result.duplicates > 0 ? <span className="text-slate-500">{result.duplicates.toLocaleString()} duplicate{result.duplicates === 1 ? "" : "s"} skipped</span> : null}
                  {result.missingName > 0 ? <span className="text-slate-500">{result.missingName.toLocaleString()} row{result.missingName === 1 ? "" : "s"} with no name skipped</span> : null}
                </div>
              ) : null}
            </div>
          )}

          {error ? <p className="mt-3 text-xs text-red-600" role="alert">{error}</p> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          {importing ? (
            <span className="mr-auto text-xs text-slate-500">Importing {progress.toLocaleString()} of {result?.rows.length.toLocaleString()}…</span>
          ) : null}
          <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-3.5 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          {parsed ? (
            <button
              type="button"
              onClick={() => void runImport()}
              disabled={importing || !hasName || !result || result.rows.length === 0}
              className="cap-btn-primary rounded-md px-4 py-1.5 text-[13px] font-semibold disabled:opacity-50"
            >
              {importing ? "Importing…" : `Import ${result?.rows.length.toLocaleString() ?? 0} contacts`}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
