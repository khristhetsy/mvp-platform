"use client";

/**
 * New import, in four steps (the approved mockup): 1 Import list, 2 Break down
 * headers, 3 Match directory fields, 4 Select fields. Then a result screen.
 * Step 4 ticks the best fit from the existing fields for every column that did
 * not match, with the reason; fields and values take one or more choices.
 * The finished mapping goes to the upload route, which cleans and stores the
 * rows through the same pipeline as the CSV import (drafts until published).
 */
import { useMemo, useState } from "react";
import {
  FIELDS, applyMapping, autoMatch, fieldCoverage, fieldLabel, filledCount, mapLabel, sampleColumns, suggest, valueCounts,
  type FieldKey, type Mapping, type Suggestion, type ValueMap,
} from "@/lib/investor-directory/import-mapping";
import { postJson } from "@/components/admin/investor-directory/ui";
import type { ImportRow } from "@/lib/investor-directory/db";

type SheetInfo = { name: string; rows: number; cols: number; importable: boolean };
type Sheet = { fileName: string; sheets: SheetInfo[]; sheet: string; headers: string[]; rows: string[][] };
type Step = 1 | 2 | 3 | 4 | 5;
type Opt = { value: string; label: string };

const MEMORY_KEY = "icapos.directoryImport.answers.v1";
const SKIP = "skip";
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const normHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function readMemory(): Record<string, FieldKey[]> {
  try { return JSON.parse(window.localStorage.getItem(MEMORY_KEY) ?? "{}") as Record<string, FieldKey[]>; } catch { return {}; }
}
function writeMemory(next: Record<string, FieldKey[]>) {
  try { window.localStorage.setItem(MEMORY_KEY, JSON.stringify(next)); } catch { /* storage can be off; answers just are not remembered */ }
}

const slugOpts = (slugs: string[]): Opt[] => slugs.map((s) => ({ value: s, label: s.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) }));
const VOCAB: Partial<Record<FieldKey, Opt[]>> = {
  investor_types: slugOpts(["angel-investor", "venture-capital", "private-equity", "family-office", "hedge-fund", "lender", "other"]),
  funding_stages: slugOpts(["pre-seed", "seed", "series-a", "series-b", "growth", "other"]),
  capital_types: slugOpts(["equity-capital", "debt-capital"]),
};
const defaultValue = (f: FieldKey): string[] => (VOCAB[f]?.some((o) => o.value === "other") ? ["other"] : []);

const ALL_FIELD_OPTS: Opt[] = FIELDS.map((f) => ({ value: f.key, label: f.label }));
const SKIP_OPT: Opt = { value: SKIP, label: "Skip this column" };

/** Options for a column that needs an answer: its best fits first, then every other field, then Skip. */
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

export function ImportWizard({ onClose, onDone }: Readonly<{ onClose: () => void; onDone: (message: string) => void }>) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [source, setSource] = useState("Internet search");
  const [sourceUrl, setSourceUrl] = useState("");
  const [data, setData] = useState<Sheet | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [remembered, setRemembered] = useState<Set<number>>(new Set());
  const [needs, setNeeds] = useState<number[]>([]);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [picked, setPicked] = useState<ValueMap>({});
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErr, setShowErr] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [done, setDone] = useState<{ imp: ImportRow; skipped: number; invalid: number; rowCount: number } | null>(null);

  async function read(f: File, sheet?: string) {
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.set("file", f);
      if (sheet) fd.set("sheet", sheet);
      const res = await fetch("/api/admin/investor-directory/imports/preview", { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as Sheet & { error?: string };
      if (!res.ok) { setError(body.error ?? "Could not read that file."); setData(null); return; }
      setFile(f); setData(body);
      if (!name.trim()) setName(f.name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim());
      const auto = autoMatch(body.headers, body.rows);
      const mem = readMemory();
      const next: Mapping = { ...auto.mapping };
      const mine = new Set<number>();
      const ask: number[] = [];
      for (const i of auto.needsAnswer) {
        const m = mem[normHeader(body.headers[i])];
        if (m) { next[String(i)] = m; mine.add(i); continue; }
        ask.push(i);
        const best = auto.suggestions[i].options.find((o) => o.field !== SKIP);
        next[String(i)] = best ? [best.field as FieldKey] : []; // the best fit starts ticked
      }
      setMapping(next); setRemembered(mine); setNeeds(ask); setSkipped(new Set()); setPicked({}); setShowErr(false);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const suggestions = useMemo(() => {
    if (!data) return [];
    const wide = sampleColumns(data.headers, data.rows, 8);
    return data.headers.map((h, i) => suggest(h, wide[i]));
  }, [data]);
  const examples = useMemo(() => (data ? sampleColumns(data.headers, data.rows, 3) : []), [data]);

  /** Values of investor type, stage and capital columns that no built in label covers. */
  const loose = useMemo(() => {
    if (!data) return [];
    const out: { i: number; f: FieldKey; value: string; count: number }[] = [];
    for (const [k, fields] of Object.entries(mapping)) {
      const i = Number(k);
      const f = fields.find((x) => VOCAB[x]);
      if (!f) continue;
      for (const v of valueCounts(data.rows, i)) {
        if (!SLUG.test(v.value) && mapLabel(f, v.value).length === 0) out.push({ i, f, value: v.value, count: v.count });
      }
    }
    return out.slice(0, 60);
  }, [data, mapping]);

  const valueMap = useMemo(() => {
    const m: ValueMap = {};
    for (const r of loose) (m[String(r.i)] ??= {})[r.value] = picked[String(r.i)]?.[r.value] ?? defaultValue(r.f);
    return m;
  }, [loose, picked]);

  const result = useMemo(() => (data ? applyMapping(data.headers, data.rows, mapping, valueMap) : null), [data, mapping, valueMap]);
  const pending = needs.filter((i) => !skipped.has(i) && !(mapping[String(i)]?.length)).length;

  function setColumn(i: number, v: string[]) {
    setShowErr(false);
    if (v.includes(SKIP)) { setSkipped((s) => new Set(s).add(i)); setMapping((m) => ({ ...m, [String(i)]: [] })); return; }
    setSkipped((s) => { const n = new Set(s); n.delete(i); return n; });
    setMapping((m) => ({ ...m, [String(i)]: v as FieldKey[] }));
  }
  function acceptAll() {
    setShowErr(false); setSkipped(new Set());
    setMapping((m) => {
      const n = { ...m };
      for (const i of needs) { const b = suggestions[i]?.options.find((o) => o.field !== SKIP); n[String(i)] = b ? [b.field as FieldKey] : []; }
      return n;
    });
  }

  async function runImport() {
    if (!data || !result || result.missingFirm) return;
    if (pending > 0) { setShowErr(true); return; }
    setBusy(true); setError(null);
    const r = await postJson<{ import: ImportRow; skipped: number }>("/api/admin/investor-directory/imports/upload", "POST", {
      name: name.trim(), source: source.trim(), sourceUrl: sourceUrl.trim() || null, fileName: data.fileName,
      headers: data.headers, rows: data.rows, mapping, valueMap,
    });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    if (remember) {
      const mem = readMemory();
      for (const i of needs) mem[normHeader(data.headers[i])] = mapping[String(i)] ?? [];
      writeMemory(mem);
    }
    setDone({ imp: r.data.import, skipped: r.data.skipped, invalid: result.invalidEmails, rowCount: result.rowCount });
    setStep(5);
  }

  function finish() {
    if (!done) { onClose(); return; }
    const c = done.imp;
    onDone(`${done.rowCount.toLocaleString("en-US")} rows read · ${c.created_count.toLocaleString("en-US")} new · ${c.merged_count.toLocaleString("en-US")} merged · ${done.invalid} bad emails · ${done.skipped} skipped (no firm). New rows are drafts until you publish.`);
  }

  const labels = ["1 Import list", "2 Break down headers", "3 Match directory fields", "4 Select fields"];
  const total = data?.rows.length ?? 0;
  const importableSheets = data?.sheets.filter((s) => s.importable) ?? [];
  const hidden = (data?.sheets.length ?? 0) - importableSheets.length;
  const canNext1 = Boolean(data && name.trim() && source.trim());

  return (
    <div role="dialog" aria-modal="true" aria-label="New import" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-6 w-full max-w-4xl rounded-xl bg-white p-5">
        <div className="mb-2 flex items-center justify-between text-[12px] text-slate-500">
          <span>Investor Directory › {step === 5 ? "Imports" : "Records › New import"}</span>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg border border-slate-300 px-2.5 py-1 text-[12.5px] text-slate-700">Close</button>
        </div>

        {step < 5 ? (
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
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void read(f); }}
              className="block cursor-pointer rounded-xl border-[1.5px] border-dashed border-slate-300 p-5 text-center text-slate-500"
            >
              <div className="text-[26px]" aria-hidden>⬆</div>
              {file ? <span className="font-medium text-slate-800">{file.name}</span> : <span>Choose an Excel or CSV file</span>}
              <br /><span className="text-[12px]">.xlsx or .csv. Drop a different file or browse</span>
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
            <p className="mt-2 text-[12px] text-slate-500">Name and a file are required. Source starts as &quot;Internet search&quot; and you can change it. Source link can stay blank.</p>
          </div>
        ) : null}

        {step === 2 && data ? (
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900">Headers found in {data.sheet === "CSV" ? data.fileName : data.sheet}</h2>
            <p className="mb-3 text-[12.5px] text-slate-500">{data.headers.length} columns, {total.toLocaleString("en-US")} rows. Check that the first values look right.</p>
            <table className="w-full table-fixed text-[13px]">
              <colgroup><col style={{ width: "6%" }} /><col style={{ width: "28%" }} /><col style={{ width: "42%" }} /><col style={{ width: "24%" }} /></colgroup>
              <thead><tr><th className={th}>#</th><th className={th}>Header</th><th className={th}>First value</th><th className={th}>Rows filled</th></tr></thead>
              <tbody>
                {data.headers.map((h, i) => (
                  <tr key={`${h}-${i}`}>
                    <td className={td}>{i + 1}</td><td className={`${td} font-medium`}>{h}</td>
                    <td className={`${td} truncate text-slate-600`}>{examples[i]?.[0] ?? <span className="text-slate-400">Empty</span>}</td>
                    <td className={td}>{filledCount(data.rows, i).toLocaleString("en-US")} of {total.toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {step === 3 && data ? (
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900">Matched to Investor Directory fields</h2>
            <p className="mb-3 text-[12.5px] text-slate-500">{data.headers.length - needs.length} matched on their own. {needs.length} need your answer in the next step.</p>
            <table className="w-full table-fixed text-[13px]">
              <colgroup><col style={{ width: "28%" }} /><col style={{ width: "4%" }} /><col style={{ width: "40%" }} /><col style={{ width: "28%" }} /></colgroup>
              <thead><tr><th className={th}>Header</th><th className={th} /><th className={th}>Directory field</th><th className={th}>Result</th></tr></thead>
              <tbody>
                {data.headers.map((h, i) => {
                  const ask = needs.includes(i);
                  const f = mapping[String(i)] ?? [];
                  return (
                    <tr key={`${h}-${i}`}>
                      <td className={`${td} font-medium`}>{h}</td><td className={td}>→</td>
                      <td className={td}>{ask ? <span className="text-slate-400">Needs your answer</span> : f.length ? f.map(fieldLabel).join(", ") : <span className="text-slate-500">Skipped</span>}</td>
                      <td className={td}>
                        <span className={`rounded-md px-2 py-0.5 text-[11px] ${ask ? "bg-[#FAEEDA] text-[#633806]" : "bg-[#E7F5EC] text-[#1d6b3a]"}`}>{ask ? "Check" : remembered.has(i) ? "Remembered" : "Matched"}</span>
                      </td>
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
                <p className="mb-3 text-[12.5px] text-slate-500">Best fit from your existing fields is ticked, with the reason. Tick one or more fields, or change it. Skip clears the other ticks.</p>
              </div>
              {needs.length ? <button type="button" onClick={acceptAll} className={btn}>Accept all suggestions</button> : null}
            </div>

            {needs.length ? (
              <table className="w-full table-fixed text-[13px]">
                <colgroup><col style={{ width: "20%" }} /><col style={{ width: "26%" }} /><col style={{ width: "54%" }} /></colgroup>
                <thead><tr><th className={th}>Header</th><th className={th}>Values in your file</th><th className={th}>Field to use</th></tr></thead>
                <tbody>
                  {needs.map((i) => {
                    const s = suggestions[i];
                    const best = s.options.find((o) => o.field !== SKIP);
                    const cur = skipped.has(i) ? [SKIP] : mapping[String(i)] ?? [];
                    const same = best ? cur.length === 1 && cur[0] === best.field : false;
                    return (
                      <tr key={`${data.headers[i]}-${i}`}>
                        <td className={`${td} font-medium`}>{data.headers[i]}</td>
                        <td className={`${td} text-slate-600`}>{examples[i]?.length ? examples[i].map((v) => <div key={v} className="truncate">{v}</div>) : <span className="text-slate-400">Empty</span>}</td>
                        <td className={td}>
                          <MultiSelect label={`Field for ${data.headers[i]}`} options={fieldOptions(s)} value={cur} exclusive={SKIP} onChange={(v) => setColumn(i, v)} />
                          <p className="mt-1.5 text-[12px] text-slate-500">
                            {same && best ? <>{best.reason}<span className="ml-1.5 rounded-md bg-[#E7F5EC] px-2 py-0.5 text-[11px] text-[#1d6b3a]">Suggested</span></>
                              : <>Changed from the suggestion<span className="ml-1.5 rounded-md bg-[#FAEEDA] px-2 py-0.5 text-[11px] text-[#633806]">Your choice</span></>}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
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
                    {loose.map((r) => (
                      <tr key={`${r.i}-${r.value}`}>
                        <td className={td}><span className="font-medium">{r.value}</span><br /><span className="text-[12px] text-slate-500">{fieldLabel(r.f)}</span></td>
                        <td className={td}>{r.count.toLocaleString("en-US")}</td>
                        <td className={td}>
                          <MultiSelect label={`Choices for ${r.value}`} options={VOCAB[r.f] ?? []} value={valueMap[String(r.i)]?.[r.value] ?? []}
                            onChange={(v) => setPicked((p) => ({ ...p, [String(r.i)]: { ...p[String(r.i)], [r.value]: v } }))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}

            <label className="mt-4 flex items-center gap-2 text-[12.5px] text-slate-600">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4" /> Remember my answers as the default template
            </label>

            {result && !result.missingFirm ? (
              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-[12.5px] text-slate-600">
                <p>{result.rowCount.toLocaleString("en-US")} rows read · {result.rows.length.toLocaleString("en-US")} records after cleaning · {result.merged} duplicates merged · {result.invalidEmails} bad emails · {result.skipped} skipped (no firm).</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {fieldCoverage(result).filter((c) => c.filled > 0).map((c) => (
                    <span key={c.field} className="rounded-full bg-white px-2.5 py-0.5 text-[11.5px] text-slate-700">{fieldLabel(c.field)} {c.filled.toLocaleString("en-US")}</span>
                  ))}
                </div>
              </div>
            ) : result?.missingFirm ? <p className="mt-3 text-[12.5px] text-[#A32D2D]">No column is set to Firm yet. Choose one above before importing.</p> : null}

            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-[12.5px] text-slate-600">After this, the existing cleaning runs unchanged: dedupe by email, normalize names and phones, flag bad emails, map labels to your lists, tag source and date. New rows stay drafts until you publish.</div>
          </div>
        ) : null}

        {step === 5 && done ? (
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
        {showErr && pending > 0 ? <p className="mt-3 text-[12.5px] text-[#A32D2D]">Answer every question before importing.</p> : null}

        {step < 5 ? (
          <div className="mt-5 flex items-center justify-between">
            <button type="button" disabled={busy} onClick={() => (step === 1 ? onClose() : setStep((s) => (s - 1) as Step))} className={btn}>{step === 1 ? "Cancel" : "Back"}</button>
            <span className="text-[12px] text-slate-500">
              {step === 4 ? (pending ? `${pending} ${pending === 1 ? "answer" : "answers"} needed` : `All set. Ready to import ${total.toLocaleString("en-US")} rows.`) : `Step ${step} of 4`}
            </span>
            {step === 4 ? (
              <button type="button" disabled={busy || !result || result.missingFirm} onClick={() => void runImport()} className={btnPri}>{busy ? "Importing…" : "Upload and clean"}</button>
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
