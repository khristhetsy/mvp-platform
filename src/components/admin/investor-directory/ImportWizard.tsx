"use client";

/**
 * New import (the approved mockup): 1 Import list, 2 Break down headers,
 * 3 Match directory fields, 4 Select fields, 5 Review and save, then a result.
 * Every stage is editable: header names and the header row, the field for any
 * column (one or more, or Skip), the values that do not fit a list, and finally
 * the cleaned records themselves. Nothing is saved until Save import.
 * The finished mapping and edits go to the upload route, which cleans and stores
 * the rows through the same pipeline as the CSV import (drafts until published).
 */
import { useMemo, useState } from "react";
import {
  EDIT_FIELDS, EDIT_LABELS, FIELDS, VOCAB_SLUGS, applyMapping, autoMatch, cellText, fieldLabel, filledCount, guessEdits, mapLabel,
  parseEdit, sampleColumns, slugLabel, valueCounts,
  type EditField, type FieldKey, type Mapping, type Suggestion, type ValueMap,
} from "@/lib/investor-directory/import-mapping";
import { normalizeEmail } from "@/lib/investor-directory/clean";
import { postJson } from "@/components/admin/investor-directory/ui";
import type { ImportRow } from "@/lib/investor-directory/db";

type SheetInfo = { name: string; rows: number; cols: number; importable: boolean };
type Sheet = { fileName: string; sheets: SheetInfo[]; sheet: string; grid: string[][] };
type Step = 1 | 2 | 3 | 4 | 5 | 6;
type Opt = { value: string; label: string };
type Filter = "all" | "noind" | "edited";

const MEMORY_KEY = "icapos.directoryImport.answers.v1";
const SKIP = "skip";
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PAGE = 25;
const normHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

function readMemory(): Record<string, FieldKey[]> {
  try { return JSON.parse(window.localStorage.getItem(MEMORY_KEY) ?? "{}") as Record<string, FieldKey[]>; } catch { return {}; }
}
function writeMemory(next: Record<string, FieldKey[]>) {
  try { window.localStorage.setItem(MEMORY_KEY, JSON.stringify(next)); } catch { /* storage can be off; answers just are not remembered */ }
}

const VOCAB: Partial<Record<FieldKey, Opt[]>> = {
  investor_types: VOCAB_SLUGS.investor_types.map((s) => ({ value: s, label: slugLabel(s) })),
  funding_stages: VOCAB_SLUGS.funding_stages.map((s) => ({ value: s, label: slugLabel(s) })),
  capital_types: VOCAB_SLUGS.capital_types.map((s) => ({ value: s, label: slugLabel(s) })),
};
const defaultValue = (f: FieldKey): string[] => (VOCAB[f]?.some((o) => o.value === "other") ? ["other"] : []);
const SKIP_OPT: Opt = { value: SKIP, label: "Skip this column" };

/** Options for a column: its best fits first, then every other field, then Skip. */
function fieldOptions(s: Suggestion): Opt[] {
  const first = s.options.filter((o) => o.field !== SKIP).map((o) => o.field as FieldKey);
  const rest = FIELDS.map((f) => f.key).filter((k) => !first.includes(k));
  return [...[...first, ...rest].map((k) => ({ value: k, label: fieldLabel(k) })), SKIP_OPT];
}

/** Pick one or more. Choosing the exclusive option clears the others, and any other choice clears it. */
function MultiSelect({ options, value, onChange, exclusive, label }: Readonly<{ options: Opt[]; value: string[]; onChange: (v: string[]) => void; exclusive?: string; label: string }>) {
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const toggle = (v: string) => {
    if (value.includes(v)) { onChange(value.filter((x) => x !== v)); return; }
    onChange(exclusive && v === exclusive ? [v] : [...value.filter((x) => x !== exclusive), v]);
  };
  return (
    <details className="rounded-lg border border-slate-300 bg-white">
      <summary aria-label={label} className="flex min-h-[34px] cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-1.5 text-[13px]">
        <span className="flex flex-wrap gap-1">
          {value.length ? value.map((v) => <span key={v} className="rounded-md bg-[#E6F1FB] px-2 py-0.5 text-[12px] text-[#0C447C]">{labelOf(v)}</span>)
            : <span className="text-slate-400">Choose one or more</span>}
        </span>
        <span aria-hidden>▾</span>
      </summary>
      <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto border-t border-slate-200 px-2.5 py-2">
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-700">
            <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} className="h-4 w-4" />
            {o.label}
          </label>
        ))}
      </div>
    </details>
  );
}

const input = "mt-1 h-9 w-full rounded-lg border border-slate-300 px-2.5 text-[13px]";
const th = "border-b border-slate-300 px-2 py-2 text-left text-[12px] font-semibold text-slate-500";
const td = "border-b border-slate-100 px-2 py-2.5 align-top";
const btn = "rounded-lg border border-slate-300 px-3.5 py-1.5 text-[13px] text-slate-800 disabled:opacity-45";
const btnPri = "rounded-lg bg-[#1A6CE4] px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-[#2E78F5] disabled:opacity-45";
const tagOk = "ml-1.5 rounded-md bg-[#E7F5EC] px-2 py-0.5 text-[11px] text-[#1d6b3a]";
const tagChanged = "ml-1.5 rounded-md bg-[#FAEEDA] px-2 py-0.5 text-[11px] text-[#633806]";

export function ImportWizard({ onClose, onDone }: Readonly<{ onClose: () => void; onDone: (message: string) => void }>) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [source, setSource] = useState("Internet search");
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<Sheet | null>(null);
  const [over, setOver] = useState(false);
  const [hrow, setHrow] = useState(1);
  const [renamed, setRenamed] = useState<Record<number, string>>({});
  const [custom, setCustom] = useState<Set<number>>(new Set());
  const [memory, setMemory] = useState<Record<string, FieldKey[]>>({});
  const [choice, setChoice] = useState<Record<number, string[]>>({});
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set());
  const [picked, setPicked] = useState<ValueMap>({});
  const [showAll, setShowAll] = useState(false);
  const [remember, setRemember] = useState(true);
  const [showErr, setShowErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowEdits, setRowEdits] = useState<Record<number, Record<string, string>>>({});
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [editSig, setEditSig] = useState("");
  const [undoGuess, setUndoGuess] = useState<Record<number, Record<string, string>> | null>(null);
  const [guessInfo, setGuessInfo] = useState<{ capital: number; industries: number } | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const [done, setDone] = useState<{ imp: ImportRow; skipped: number; invalid: number; rowCount: number } | null>(null);

  function resetAnswers() {
    setRenamed({}); setChoice({}); setConfirmed(new Set()); setPicked({}); setShowErr(false);
    setRowEdits({}); setExcluded(new Set()); setEditSig(""); setPage(0);
  }

  async function read(f: File, sheet?: string) {
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.set("file", f);
      if (sheet) fd.set("sheet", sheet);
      const res = await fetch("/api/admin/investor-directory/imports/preview", { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as Sheet & { error?: string };
      if (!res.ok) { setError(body.error ?? "Could not read that file."); setData(null); return; }
      setFile(f); setData(body); setHrow(1); setMemory(readMemory()); resetAnswers();
      if (!name.trim()) setName(f.name.replace(/\.[^.]+$/, "").replace(/_+/g, " ").trim());
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const grid = data?.grid;
  const baseHeaders = useMemo(() => (grid?.[hrow - 1] ?? []).map((h, i) => (h && h.trim()) || `Column ${i + 1}`), [grid, hrow]);
  const headers = useMemo(() => baseHeaders.map((h, i) => renamed[i]?.trim() || h), [baseHeaders, renamed]);
  const rows = useMemo(() => (grid ?? []).slice(hrow).filter((r) => r.some((c) => c && c.trim())), [grid, hrow]);
  const total = rows.length;

  const auto = useMemo(() => autoMatch(headers, rows), [headers, rows]);
  const examples = useMemo(() => sampleColumns(headers, rows, 3), [headers, rows]);

  /** Per column: what the matcher proposes, whether it needs an answer, and why. */
  const info = useMemo(() => headers.map((h, i) => {
    const s = auto.suggestions[i];
    const matched = auto.mapping[String(i)] !== undefined;
    const mem = !matched ? memory[normHeader(h)] : undefined;
    const best = s.options.find((o) => o.field !== SKIP);
    const sug: string[] = matched ? auto.mapping[String(i)] : mem ?? (best ? [best.field as string] : []);
    const why = matched ? s.reason : mem ? "Remembered from your last import." : best?.reason ?? s.reason;
    return { s, sug, ask: !matched && !mem, why, matched };
  }), [headers, auto, memory]);

  const sel = (i: number): string[] => choice[i] ?? info[i]?.sug ?? [];
  const shown = (i: number): string[] => { const v = sel(i); return v.length || info[i]?.ask ? v : [SKIP]; };
  const mapping = useMemo(() => {
    const m: Mapping = {};
    headers.forEach((_, i) => { m[String(i)] = sel(i).filter((x) => x !== SKIP) as FieldKey[]; });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers, choice, info]);
  const needs = useMemo(() => info.map((x, i) => (x.ask ? i : -1)).filter((i) => i >= 0), [info]);
  const pending = needs.filter((i) => shown(i).length === 0).length;

  /** Values of investor type, stage and capital columns that no built in label covers. */
  const loose = useMemo(() => {
    const out: { i: number; f: FieldKey; value: string; count: number }[] = [];
    for (const [k, fields] of Object.entries(mapping)) {
      const i = Number(k);
      const f = fields.find((x) => VOCAB[x]);
      if (!f) continue;
      for (const v of valueCounts(rows, i)) {
        if (!SLUG.test(v.value) && mapLabel(f, v.value).length === 0) out.push({ i, f, value: v.value, count: v.count });
      }
    }
    return out.slice(0, 60);
  }, [rows, mapping]);

  const valueMap = useMemo(() => {
    const m: ValueMap = {};
    for (const r of loose) (m[String(r.i)] ??= {})[r.value] = picked[String(r.i)]?.[r.value] ?? defaultValue(r.f);
    return m;
  }, [loose, picked]);

  const result = useMemo(() => (data ? applyMapping(headers, rows, mapping, valueMap) : null), [data, headers, rows, mapping, valueMap]);
  const sig = useMemo(() => JSON.stringify([data?.sheet, hrow, headers, mapping, valueMap]), [data?.sheet, hrow, headers, mapping, valueMap]);

  function setColumn(i: number, v: string[]) {
    setShowErr(false);
    setConfirmed((c) => new Set(c).add(i));
    setChoice((c) => ({ ...c, [i]: v }));
  }
  function acceptAll() {
    setShowErr(false);
    setChoice((c) => { const n = { ...c }; for (const i of needs) n[i] = info[i].sug; return n; });
    setConfirmed((c) => { const n = new Set(c); needs.forEach((i) => n.add(i)); return n; });
  }

  function badge(i: number): { text: string; cls: string } {
    const same = sameSet(sel(i), info[i].sug);
    if (info[i].ask && !confirmed.has(i)) return { text: "Check", cls: "bg-[#FAEEDA] text-[#633806]" };
    if (!same) return { text: "Your choice", cls: "bg-[#FAEEDA] text-[#633806]" };
    return { text: info[i].matched ? "Matched" : "Confirmed", cls: "bg-[#E7F5EC] text-[#1d6b3a]" };
  }
  function reason(i: number) {
    return sameSet(sel(i), info[i].sug)
      ? <>{info[i].why}<span className={tagOk}>Suggested</span></>
      : <>Changed from the suggestion<span className={tagChanged}>Your choice</span></>;
  }
  function picker(i: number) {
    return <MultiSelect label={`Field for ${headers[i]}`} options={fieldOptions(info[i].s)} value={shown(i)} exclusive={SKIP}
      onChange={(v) => setColumn(i, v)} />;
  }

  /* Review and save */
  function toReview() {
    if (pending > 0) { setShowErr(true); return; }
    if (editSig !== sig) { setRowEdits({}); setExcluded(new Set()); setPage(0); setFilter("all"); setUndoGuess(null); setGuessInfo(null); setEditSig(sig); }
    setStep(5);
  }
  const cleaned = result?.rows ?? [];
  const cell = (i: number, f: EditField) => rowEdits[i]?.[f] ?? cellText(cleaned[i], f);
  const editedCount = Object.entries(rowEdits).reduce((n, [, e]) => n + Object.keys(e).length, 0);
  const visible = useMemo(() => cleaned.map((_, i) => i).filter((i) => {
    if (filter === "noind") return !(rowEdits[i]?.industries ?? cellText(cleaned[i], "industries")).trim();
    if (filter === "edited") return Boolean(rowEdits[i] && Object.keys(rowEdits[i]).length);
    return true;
  }), [cleaned, filter, rowEdits]);
  const noInd = useMemo(() => cleaned.filter((_, i) => !(rowEdits[i]?.industries ?? cellText(cleaned[i], "industries")).trim()).length, [cleaned, rowEdits]);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE));
  const pageRows = visible.slice(page * PAGE, page * PAGE + PAGE);
  const preview = useMemo(() => guessEdits(cleaned, rowEdits), [cleaned, rowEdits]);
  function applyGuess() {
    const g = guessEdits(cleaned, rowEdits);
    setUndoGuess(rowEdits);
    setRowEdits((cur) => {
      const n: Record<number, Record<string, string>> = { ...cur };
      for (const [k, e] of Object.entries(g.edits)) n[Number(k)] = { ...(n[Number(k)] ?? {}), ...e };
      return n;
    });
    setGuessInfo({ capital: g.capital, industries: g.industries });
  }
  function undoGuesses() { if (undoGuess) { setRowEdits(undoGuess); setUndoGuess(null); setGuessInfo(null); } }
  function editCell(i: number, f: EditField, text: string) {
    setRowEdits((all) => {
      const next = { ...all, [i]: { ...(all[i] ?? {}) } };
      if (text === cellText(cleaned[i], f)) delete next[i][f]; else next[i][f] = text;
      if (!Object.keys(next[i]).length) delete next[i];
      return next;
    });
  }
  const badEdits = cleaned.reduce((n, _, i) => {
    if (excluded.has(i)) return n;
    const e = cell(i, "email").trim();
    const firm = cell(i, "firm").trim();
    return n + ((e && normalizeEmail(e).invalid) || !firm || (rowEdits[i]?.firm !== undefined && !parseEdit("firm", firm).firm) ? 1 : 0);
  }, 0);

  async function runImport() {
    if (!data || !result || result.missingFirm) return;
    if (badEdits > 0) { setError("Fix the highlighted email or firm cells, or exclude those records."); return; }
    setBusy(true); setError(null);
    const r = await postJson<{ import: ImportRow; skipped: number }>("/api/admin/investor-directory/imports/upload", "POST", {
      name: name.trim(), source: source.trim(), sourceUrl: sourceUrl.trim() || null, fileName: data.fileName,
      headers, rows, mapping, valueMap, edits: rowEdits, exclude: [...excluded],
    });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    if (remember) {
      const mem = readMemory();
      for (const i of needs) mem[normHeader(headers[i])] = mapping[String(i)] ?? [];
      writeMemory(mem);
    }
    setDone({ imp: r.data.import, skipped: r.data.skipped, invalid: result.invalidEmails, rowCount: result.rowCount });
    setStep(6);
  }

  function finish() {
    if (!done) { onClose(); return; }
    const c = done.imp;
    onDone(`${done.rowCount.toLocaleString("en-US")} rows read · ${c.created_count.toLocaleString("en-US")} new · ${c.merged_count.toLocaleString("en-US")} merged · ${done.invalid} bad emails · ${done.skipped} skipped (no firm). New rows are drafts until you publish.`);
  }

  const labels = ["1 Import list", "2 Break down headers", "3 Match directory fields", "4 Select fields"];
  const importableSheets = data?.sheets.filter((s) => s.importable) ?? [];
  const hidden = (data?.sheets.length ?? 0) - importableSheets.length;
  const canNext1 = Boolean(data && name.trim() && source.trim());
  const maxHeaderRow = Math.min(5, Math.max(1, (grid?.length ?? 2) - 1));

  return (
    <div role="dialog" aria-modal="true" aria-label="New import" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className={`my-6 w-full rounded-xl bg-white p-5 ${step === 5 ? "max-w-6xl" : "max-w-4xl"}`}>
        <div className="mb-2 flex items-center justify-between text-[12px] text-slate-500">
          <span>Investor Directory › {step === 6 ? "Imports" : "Records › New import"}</span>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg border border-slate-300 px-2.5 py-1 text-[12.5px] text-slate-700">Close</button>
        </div>

        {step < 6 ? (
          <div className="mb-4 flex gap-1.5">
            {labels.map((l, k) => (
              <div key={l} className={`flex-1 rounded-lg px-2.5 py-2 text-[12px] ${step === k + 1 ? "bg-[#E6F1FB] font-semibold text-[#0C447C]" : step > k + 1 ? "bg-slate-100 text-[#1d6b3a]" : "bg-slate-100 text-slate-500"}`}>{l}</div>
            ))}
          </div>
        ) : null}

        {step === 1 ? (
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900">Import a list</h2>
            <p className="mb-3 text-[12.5px] text-slate-500">Public sources only. Never scraped data from LinkedIn, Crunchbase or sites whose terms forbid it.</p>
            <label
              onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); setOver(false); }}
              onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) void read(f); }}
              className={`block cursor-pointer rounded-xl border-[1.5px] border-dashed p-5 text-center transition-colors ${over ? "border-[#1A6CE4] bg-[#E6F1FB] text-[#0C447C]" : "border-slate-300 text-slate-500"}`}
            >
              <div className="text-[26px]" aria-hidden>⬆</div>
              {file ? <span className="font-medium text-slate-800">{file.name}</span>
                : <span>Drag and drop your .xlsx or .csv here, or <b className="text-[#1A6CE4]">browse</b></span>}
              <br /><span className="text-[12px]">{file ? "Drop a different file or browse to replace it." : "One file at a time."}</span>
              <input type="file" accept=".xlsx,.csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); }} />
            </label>
            {busy && !data ? <p className="mt-2 text-[12.5px] text-slate-500">Reading the file…</p> : null}

            {data && data.sheets.length > 1 ? (
              <div className="mt-4">
                <p className="mb-1.5 text-[13px] font-semibold text-slate-800">Choose a sheet</p>
                {importableSheets.map((s) => (
                  <label key={s.name} className="mb-1.5 flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-[13px]">
                    <input type="radio" name="sheet" checked={data.sheet === s.name} disabled={busy} onChange={() => file && void read(file, s.name)} />
                    {s.name}
                    <span className="ml-auto text-[12px] text-slate-500">{s.rows.toLocaleString("en-US")} rows, {s.cols} columns</span>
                  </label>
                ))}
                {hidden > 0 ? <p className="mt-1 text-[12px] text-slate-500">{hidden} {hidden === 1 ? "summary sheet" : "summary sheets"} can&apos;t be imported.</p> : null}
              </div>
            ) : null}

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-[12px] text-slate-600">Name
                <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
              </label>
              <label className="text-[12px] text-slate-600">Source
                <input value={source} onChange={(e) => setSource(e.target.value)} className={input} />
              </label>
              <label className="text-[12px] text-slate-600">Source link (optional)
                <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://" className={input} />
              </label>
            </div>
            <p className="mt-2 text-[12px] text-slate-500">Name and a file are required. Source starts as &quot;Internet search&quot; and you can change it. Source link can stay blank. Every field on the next screens stays editable until you save.</p>
          </div>
        ) : null}

        {step === 2 && data ? (
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900">Headers found in {data.sheet === "CSV" ? data.fileName : data.sheet}</h2>
            <p className="mb-3 text-[12.5px] text-slate-500">{headers.length} columns, {total.toLocaleString("en-US")} rows. Check that the first values look right. Pick a better header name from the list if one is wrong, or choose Type a custom name. Picking a directory field name also sets that match in step 3.</p>
            <div className="mb-2.5 flex items-center gap-3 text-[12.5px] text-slate-600">
              <label className="flex items-center gap-2">Headers are in row
                <select value={hrow} onChange={(e) => { setHrow(Number(e.target.value)); resetAnswers(); }} className="h-8 w-16 rounded-lg border border-slate-300 px-1.5 text-[13px]">
                  {Array.from({ length: maxHeaderRow }, (_, k) => k + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <span className="text-slate-500">Change this if your sheet has a title above the headers.</span>
            </div>
            <table className="w-full table-fixed text-[13px]">
              <colgroup><col style={{ width: "6%" }} /><col style={{ width: "28%" }} /><col style={{ width: "42%" }} /><col style={{ width: "24%" }} /></colgroup>
              <thead><tr><th className={th}>#</th><th className={th}>Header</th><th className={th}>First value</th><th className={th}>Rows filled</th></tr></thead>
              <tbody>
                {headers.map((h, i) => (
                  <tr key={i}>
                    <td className={td}>{i + 1}</td>
                    <td className={td}>
                      {(() => {
                        const cur = renamed[i];
                        const asField = FIELDS.find((f) => f.label === cur);
                        const mode = custom.has(i) ? "__c" : cur === undefined || cur === baseHeaders[i] ? "__o" : asField ? asField.key : "__c";
                        return (
                          <>
                            <select aria-label={`Header ${i + 1}`} value={mode}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "__c") { setCustom((c) => new Set(c).add(i)); return; }
                                setCustom((c) => { const n = new Set(c); n.delete(i); return n; });
                                if (v === "__o") { setRenamed((r) => { const n = { ...r }; delete n[i]; return n; }); return; }
                                const f = FIELDS.find((x) => x.key === v);
                                if (f) { setRenamed((r) => ({ ...r, [i]: f.label })); setColumn(i, [f.key]); }
                              }}
                              className="h-8 w-full rounded-md border border-slate-200 px-2 text-[13px] font-medium">
                              <option value="__o">{baseHeaders[i]} (as in your file)</option>
                              <optgroup label="Directory field names">
                                {FIELDS.filter((f) => f.label !== baseHeaders[i]).map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                              </optgroup>
                              <option value="__c">Type a custom name...</option>
                            </select>
                            {mode === "__c" ? (
                              <input aria-label={`Custom header ${i + 1}`} placeholder="Custom header name" value={cur ?? ""} onChange={(e) => setRenamed((r) => ({ ...r, [i]: e.target.value }))}
                                className="mt-1.5 h-8 w-full rounded-md border border-slate-200 px-2 text-[13px]" />
                            ) : null}
                          </>
                        );
                      })()}
                    </td>
                    <td className={`${td} truncate text-slate-600`}>{examples[i]?.[0] ?? <span className="text-slate-400">Empty</span>}</td>
                    <td className={td}>{filledCount(rows, i).toLocaleString("en-US")} of {total.toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {step === 3 && data ? (
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900">Matched to Investor Directory fields</h2>
            <p className="mb-3 text-[12.5px] text-slate-500">
              {headers.length - needs.length} matched on their own. {needs.length} {needs.length === 1 ? "has" : "have"} a suggested best fit that you confirm in the next step. Every field here can be changed: tick one or more, or Skip.
            </p>
            <table className="w-full table-fixed text-[13px]">
              <colgroup><col style={{ width: "22%" }} /><col style={{ width: "4%" }} /><col style={{ width: "54%" }} /><col style={{ width: "20%" }} /></colgroup>
              <thead><tr><th className={th}>Header</th><th className={th} /><th className={th}>Directory field</th><th className={th}>Result</th></tr></thead>
              <tbody>
                {headers.map((h, i) => {
                  const b = badge(i);
                  return (
                    <tr key={i}>
                      <td className={`${td} font-medium`}>{h}</td><td className={td}>→</td>
                      <td className={td}>{picker(i)}<p className="mt-1.5 text-[12px] text-slate-500">{reason(i)}</p></td>
                      <td className={td}><span className={`rounded-md px-2 py-0.5 text-[11px] ${b.cls}`}>{b.text}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {step === 4 && data ? (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-semibold text-slate-900">Select what field to use</h2>
                <p className="mb-3 text-[12.5px] text-slate-500">Best fit from your existing fields is ticked, with the reason. Tick one or more fields, or change it. Skip clears the other ticks. Changes here and in step 3 are the same answers.</p>
              </div>
              {needs.length ? <button type="button" onClick={acceptAll} className={btn}>Accept all suggestions</button> : null}
            </div>
            <label className="mb-2 flex items-center gap-2 text-[12.5px] text-slate-600">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-4 w-4" />
              Also show the {headers.length - needs.length} columns that matched on their own, so I can change any of them
            </label>

            {needs.length || showAll ? (
              <table className="w-full table-fixed text-[13px]">
                <colgroup><col style={{ width: "20%" }} /><col style={{ width: "26%" }} /><col style={{ width: "54%" }} /></colgroup>
                <thead><tr><th className={th}>Header</th><th className={th}>Values in your file</th><th className={th}>Field to use</th></tr></thead>
                <tbody>
                  {headers.map((h, i) => (info[i].ask || showAll ? (
                    <tr key={i}>
                      <td className={`${td} font-medium`}>{h}</td>
                      <td className={`${td} text-slate-600`}>{examples[i]?.length ? examples[i].map((v) => <div key={v} className="truncate">{v}</div>) : <span className="text-slate-400">Empty</span>}</td>
                      <td className={td}>{picker(i)}<p className="mt-1.5 text-[12px] text-slate-500">{reason(i)}</p></td>
                    </tr>
                  ) : null))}
                </tbody>
              </table>
            ) : <p className="text-[12.5px] text-slate-600">Every column matched. Nothing needs your answer.</p>}

            {loose.length ? (
              <>
                <h2 className="mt-5 text-[16px] font-semibold text-slate-900">Values that don&apos;t fit a choice</h2>
                <p className="mb-3 text-[12.5px] text-slate-500">Directory lists have fixed choices. Tick one or more for each value.</p>
                <table className="w-full table-fixed text-[13px]">
                  <colgroup><col style={{ width: "36%" }} /><col style={{ width: "10%" }} /><col style={{ width: "54%" }} /></colgroup>
                  <thead><tr><th className={th}>Value in file</th><th className={th}>Rows</th><th className={th}>Use choices</th></tr></thead>
                  <tbody>
                    {loose.map((r) => {
                      const mine = picked[String(r.i)]?.[r.value];
                      return (
                        <tr key={`${r.i}-${r.value}`}>
                          <td className={td}><span className="font-medium">{r.value}</span><br /><span className="text-[12px] text-slate-500">{fieldLabel(r.f)}</span></td>
                          <td className={td}>{r.count.toLocaleString("en-US")}</td>
                          <td className={td}>
                            <MultiSelect label={`Choices for ${r.value}`} options={VOCAB[r.f] ?? []} value={valueMap[String(r.i)]?.[r.value] ?? []}
                              onChange={(v) => setPicked((p) => ({ ...p, [String(r.i)]: { ...p[String(r.i)], [r.value]: v } }))} />
                            <p className="mt-1.5 text-[12px] text-slate-500">{mine ? <>Your choice<span className={tagChanged}>Your choice</span></> : <>Closest match to your existing choices.<span className={tagOk}>Suggested</span></>}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            ) : null}

            <label className="mt-4 flex items-center gap-2 text-[12.5px] text-slate-600">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4" /> Remember my answers as the default template
            </label>
            {result?.missingFirm ? <p className="mt-3 text-[12.5px] text-[#A32D2D]">No column is set to Firm yet. Choose one above before continuing.</p> : null}
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-[12.5px] text-slate-600">Next you review the cleaned records and can edit any of them before anything is saved. The existing cleaning runs unchanged: dedupe by email, normalize names and phones, flag bad emails, map labels to your lists, tag source and date.</div>
          </div>
        ) : null}

        {step === 5 && result && !result.missingFirm ? (
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900">Review and save</h2>
            <p className="mb-3 text-[12.5px] text-slate-500">This is the cleaned data that will be saved. Click any cell to edit it, or tick Exclude to leave a record out. Nothing is saved until you click Save import.</p>
            <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[["Rows read", result.rowCount], ["Records after cleaning", cleaned.length], ["Merged by email", result.merged], ["Bad emails", result.invalidEmails]].map(([l, n]) => (
                <div key={String(l)} className="rounded-lg bg-slate-100 px-3 py-2.5"><b className="block text-[20px] font-semibold">{Number(n).toLocaleString("en-US")}</b><span className="text-[12px] text-slate-500">{l}</span></div>
              ))}
            </div>
            <div className="mb-3 rounded-lg bg-[#E6F1FB] p-3 text-[12.5px] text-slate-700">
              <b className="text-slate-900">Guess missing fields.</b> Capital comes from Investor type: venture, angel, family office and private equity give Equity capital, lenders give Debt capital. Industry names are matched to the directory list, so &quot;Cybersecurity&quot; becomes &quot;Cyber Security&quot;; names with no match move to Notes as &quot;Industries: ...&quot;. Guesses show with an amber border, you can edit any of them, and nothing is saved until you click Save import.
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={applyGuess} disabled={!preview.capital && !preview.industries} className="rounded-lg bg-[#1A6CE4] px-3 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-40">Guess missing fields</button>
                <button type="button" onClick={undoGuesses} disabled={!undoGuess} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12.5px] disabled:opacity-40">Undo guesses</button>
                <span className="text-slate-600">{guessInfo ? `Filled ${guessInfo.capital} Capital cells and fixed ${guessInfo.industries} industry cells.` : `Fills ${preview.capital} empty Capital cells and fixes ${preview.industries} industry cells.`}</span>
              </div>
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {([["all", "All records"], ["noind", `Needs industries ${noInd}`], ["edited", `Edited ${editedCount}`]] as [Filter, string][]).map(([k, l]) => (
                <button key={k} type="button" onClick={() => { setFilter(k); setPage(0); }}
                  className={`rounded-full border px-3 py-1 text-[12px] ${filter === k ? "border-[#1A6CE4] bg-[#E6F1FB] text-[#0C447C]" : "border-slate-300 text-slate-600"}`}>{l}</button>
              ))}
              <span className="flex-1" />
              <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
                <span>{visible.length ? page * PAGE + 1 : 0}-{Math.min(visible.length, page * PAGE + PAGE)} / {visible.length.toLocaleString("en-US")}</span>
                <button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="h-7 w-7 rounded-md border border-slate-300 disabled:opacity-40">‹</button>
                <button type="button" aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="h-7 w-7 rounded-md border border-slate-300 disabled:opacity-40">›</button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[2300px] text-[13px]">
                <thead><tr><th className={th}>Exclude</th>{EDIT_FIELDS.map((f) => <th key={f} className={`${th} whitespace-nowrap`}>{EDIT_LABELS[f]}</th>)}</tr></thead>
                <tbody>
                  {pageRows.map((i) => {
                    const out = excluded.has(i);
                    return (
                      <tr key={i} className={out ? "opacity-45" : ""}>
                        <td className={td}>
                          <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
                            <input type="checkbox" checked={out} onChange={(e) => setExcluded((s) => { const n = new Set(s); if (e.target.checked) n.add(i); else n.delete(i); return n; })} className="h-4 w-4" /> Exclude
                          </label>
                        </td>
                        {EDIT_FIELDS.map((f) => {
                          const v = cell(i, f);
                          const changed = rowEdits[i]?.[f] !== undefined;
                          const bad = !out && ((f === "email" && v.trim() !== "" && normalizeEmail(v).invalid) || (f === "firm" && !parseEdit("firm", v).firm));
                          const w = f === "notes" ? "min-w-[420px]" : f === "industries" ? "min-w-[260px]" : "min-w-[150px]";
                          return (
                            <td key={f} className={td}>
                              <input aria-label={`${EDIT_LABELS[f]} for record ${i + 1}`} value={v} onChange={(e) => editCell(i, f, e.target.value)}
                                className={`h-8 w-full ${w} rounded-md border px-1.5 text-[13px] ${bad ? "border-[#A32D2D] bg-[#FCEBEB]" : changed ? "border-[#8a5a07] bg-[#FDF1DC]" : "border-transparent hover:border-slate-300"} focus:border-[#1A6CE4] focus:outline-none`} />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-[12.5px] text-slate-600">Edits are applied to these records before they are saved, and your edited values win over the file. Records without industries still go to the Verification queue as needs input. After saving, Review rows on the Imports page edits any saved record again.</div>
          </div>
        ) : null}

        {step === 6 && done ? (
          <div>
            <h2 className="text-[20px] font-semibold text-slate-900">{done.imp.name}</h2>
            <div className="my-3 flex gap-1.5 text-center text-[12px]">
              <span className="flex-1 rounded-lg bg-[#E7F5EC] p-2 text-[#1d6b3a]">Uploaded</span>
              <span className="flex-1 rounded-lg bg-[#E6F1FB] p-2 font-semibold text-[#0C447C]">Cleaned</span>
              <span className="flex-1 rounded-lg bg-slate-100 p-2 text-slate-500">Verifying</span>
              <span className="flex-1 rounded-lg bg-slate-100 p-2 text-slate-500">Published</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[["Rows read", done.rowCount], ["New", done.imp.created_count], ["Merged", done.imp.merged_count], ["Bad emails", done.invalid]].map(([l, n]) => (
                <div key={String(l)} className="rounded-lg bg-slate-100 px-3 py-2.5"><b className="block text-[20px] font-semibold">{Number(n).toLocaleString("en-US")}</b><span className="text-[12px] text-slate-500">{l}</span></div>
              ))}
            </div>
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-[12.5px] text-slate-600">New rows are drafts until you publish. Rows with the same email merge into the existing record, filling gaps and combining lists.</div>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-[12.5px] text-[#A32D2D]">{error}</p> : null}
        {showErr && pending > 0 ? <p className="mt-3 text-[12.5px] text-[#A32D2D]">Answer every question before continuing.</p> : null}

        {step < 6 ? (
          <div className="mt-5 flex items-center justify-between">
            <button type="button" disabled={busy} onClick={() => (step === 1 ? onClose() : setStep((s) => (s - 1) as Step))} className={btn}>{step === 1 ? "Cancel" : "Back"}</button>
            <span className="text-[12px] text-slate-500">
              {step === 4 ? (pending ? `${pending} ${pending === 1 ? "answer" : "answers"} needed` : `All set. Ready to clean ${total.toLocaleString("en-US")} rows.`)
                : step === 5 ? (editedCount || excluded.size ? `${editedCount} ${editedCount === 1 ? "edit" : "edits"}${excluded.size ? `, ${excluded.size} excluded` : ""}. Nothing is saved yet.` : "No edits yet. Nothing is saved.")
                : `Step ${step} of 4`}
            </span>
            {step === 4 ? (
              <button type="button" disabled={busy || !result || result.missingFirm} onClick={toReview} className={btnPri}>Clean and preview</button>
            ) : step === 5 ? (
              <button type="button" disabled={busy || cleaned.length === excluded.size} onClick={() => void runImport()} className={btnPri}>{busy ? "Saving…" : "Save import"}</button>
            ) : (
              <button type="button" disabled={busy || (step === 1 && !canNext1)} onClick={() => setStep((s) => (s + 1) as Step)} className={btnPri}>Next</button>
            )}
          </div>
        ) : (
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={finish} className={btnPri}>Open Imports</button>
          </div>
        )}
      </div>
    </div>
  );
}
