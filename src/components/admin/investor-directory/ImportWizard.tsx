"use client";

/**
 * New import, in four steps: 1 the list, 2 the column headers, 3 the match to
 * the directory's existing fields, 4 the answers for columns that did not match.
 * The finished mapping goes to the upload route, which cleans and stores the
 * rows through the same pipeline as the CSV import (drafts until published).
 */
import { useMemo, useState } from "react";
import {
  FIELDS, applyMapping, autoMatch, distinctValues, fieldCoverage, fieldLabel, mapLabel, suggest, sampleColumns,
  type FieldKey, type Mapping, type ValueMap,
} from "@/lib/investor-directory/import-mapping";
import { postJson } from "@/components/admin/investor-directory/ui";
import type { ImportRow } from "@/lib/investor-directory/db";

type Sheet = { fileName: string; sheets: { name: string; rows: number }[]; sheet: string; headers: string[]; rows: string[][] };
type Step = 1 | 2 | 3 | 4;

const MEMORY_KEY = "icapos.directoryImport.answers.v1";
const normHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function readMemory(): Record<string, FieldKey[]> {
  try { return JSON.parse(window.localStorage.getItem(MEMORY_KEY) ?? "{}") as Record<string, FieldKey[]>; } catch { return {}; }
}
function writeMemory(next: Record<string, FieldKey[]>) {
  try { window.localStorage.setItem(MEMORY_KEY, JSON.stringify(next)); } catch { /* storage can be off; answers just are not remembered */ }
}

const VOCAB_OPTIONS: Partial<Record<FieldKey, { slug: string; label: string }[]>> = {
  investor_types: ["angel-investor", "venture-capital", "private-equity", "family-office", "hedge-fund", "lender", "other"].map((s) => ({ slug: s, label: s.replace(/-/g, " ") })),
  funding_stages: ["pre-seed", "seed", "series-a", "series-b", "growth", "other"].map((s) => ({ slug: s, label: s.replace(/-/g, " ") })),
  capital_types: ["equity-capital", "debt-capital"].map((s) => ({ slug: s, label: s.replace(/-/g, " ") })),
};

function FieldChecks({ value, onChange, keys }: Readonly<{ value: FieldKey[]; onChange: (v: FieldKey[]) => void; keys: FieldKey[] }>) {
  const toggle = (k: FieldKey) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {keys.map((k) => (
        <label key={k} className={`cursor-pointer rounded-full border px-2.5 py-1 text-[12px] ${value.includes(k) ? "border-[#1A6CE4] bg-[#E6F1FB] text-[#0C447C]" : "border-slate-300 text-slate-600"}`}>
          <input type="checkbox" className="sr-only" checked={value.includes(k)} onChange={() => toggle(k)} />
          {fieldLabel(k)}
        </label>
      ))}
    </div>
  );
}

const ALL_KEYS = FIELDS.map((f) => f.key);
const input = "mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-[13px]";

export function ImportWizard({ onClose, onDone }: Readonly<{ onClose: () => void; onDone: (message: string) => void }>) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [source, setSource] = useState("Internet search");
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<Sheet | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [remembered, setRemembered] = useState<Set<number>>(new Set());
  const [needs, setNeeds] = useState<number[]>([]);
  const [valueMap, setValueMap] = useState<ValueMap>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function read(sheet?: string) {
    if (!file) { setError("Choose an Excel or CSV file."); return; }
    if (!name.trim() || !source.trim()) { setError("Name and a file are required. Source starts as Internet search."); return; }
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      if (sheet) fd.set("sheet", sheet);
      const res = await fetch("/api/admin/investor-directory/imports/preview", { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as Sheet & { error?: string };
      if (!res.ok) { setError(body.error ?? "Could not read that file."); return; }
      setData(body);
      const auto = autoMatch(body.headers, body.rows);
      const mem = readMemory();
      const next: Mapping = { ...auto.mapping };
      const mine = new Set<number>();
      for (const i of auto.needsAnswer) {
        const m = mem[normHeader(body.headers[i])];
        if (m) { next[String(i)] = m; mine.add(i); }
      }
      setMapping(next); setRemembered(mine); setValueMap({});
      setNeeds(auto.needsAnswer.filter((i) => !mine.has(i)));
      setStep(2);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const samples = useMemo(() => (data ? sampleColumns(data.headers, data.rows, 3) : []), [data]);
  const suggestions = useMemo(() => {
    if (!data) return [];
    const wide = sampleColumns(data.headers, data.rows, 8);
    return data.headers.map((h, i) => suggest(h, wide[i]));
  }, [data]);
  const result = useMemo(() => (data ? applyMapping(data.headers, data.rows, mapping, valueMap) : null), [data, mapping, valueMap]);
  const answered = needs.every((i) => mapping[String(i)] !== undefined);
  const set = (i: number, v: FieldKey[]) => setMapping((m) => ({ ...m, [String(i)]: v }));

  async function runImport() {
    if (!data || !result || result.missingFirm) return;
    setBusy(true); setError(null);
    const r = await postJson<{ import: ImportRow; skipped: number }>("/api/admin/investor-directory/imports/upload", "POST", {
      name: name.trim(), source: source.trim(), sourceUrl: sourceUrl.trim() || null, fileName: data.fileName,
      headers: data.headers, rows: data.rows, mapping, valueMap,
    });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    const mem = readMemory();
    for (const i of needs) mem[normHeader(data.headers[i])] = mapping[String(i)] ?? [];
    writeMemory(mem);
    const imp = r.data.import;
    onDone(`${result.rowCount.toLocaleString("en-US")} rows read · ${imp.created_count.toLocaleString("en-US")} new · ${imp.merged_count.toLocaleString("en-US")} merged · ${result.invalidEmails} bad emails · ${r.data.skipped} skipped (no firm). New rows are drafts until you publish.`);
  }

  const titles = ["Import the list", "Column headers", "Match to fields", "Select fields"];

  return (
    <div role="dialog" aria-modal="true" aria-label="New import" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-6 w-full max-w-3xl rounded-xl bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">New import</h2>
            <p className="mt-0.5 text-[12.5px] text-slate-500">Step {step} of 4: {titles[step - 1]}. Public sources only. Never scraped data from sites whose terms forbid it.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg border border-slate-300 px-2.5 py-1 text-[12.5px]">Close</button>
        </div>

        {step === 1 ? (
          <div className="mt-4">
            <label className="block text-[12px] text-slate-600">Name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="US investors, Oct 2026" className={input} />
            </label>
            <label className="mt-3 block text-[12px] text-slate-600">Source
              <input value={source} onChange={(e) => setSource(e.target.value)} className={input} />
            </label>
            <label className="mt-3 block text-[12px] text-slate-600">Source link (optional)
              <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://" className={input} />
            </label>
            <label className="mt-3 block text-[12px] text-slate-600">Excel or CSV file
              <input type="file" accept=".xlsx,.csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-[12.5px]" />
            </label>
          </div>
        ) : null}

        {step === 2 && data ? (
          <div className="mt-4">
            {data.sheets.length > 1 ? (
              <label className="mb-3 block text-[12px] text-slate-600">Sheet
                <select value={data.sheet} disabled={busy} onChange={(e) => void read(e.target.value)} className={input}>
                  {data.sheets.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.rows.toLocaleString("en-US")} rows)</option>)}
                </select>
              </label>
            ) : null}
            <p className="text-[12.5px] text-slate-600">{data.rows.length.toLocaleString("en-US")} rows and {data.headers.length} columns in {data.fileName}.</p>
            <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-[12.5px]">
                <thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2">Column header</th><th className="px-3 py-2">Example values</th></tr></thead>
                <tbody>
                  {data.headers.map((h, i) => (
                    <tr key={`${h}-${i}`} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-800">{h}</td>
                      <td className="px-3 py-2 text-slate-600">{samples[i]?.length ? samples[i].join(" · ") : "Empty"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {step === 3 && data ? (
          <div className="mt-4">
            <p className="text-[12.5px] text-slate-600">{data.headers.length - needs.length} of {data.headers.length} columns matched an existing field. {needs.length ? `${needs.length} need your answer in the next step.` : "Nothing needs your answer."}</p>
            <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-[12.5px]">
                <thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2">Column</th><th className="px-3 py-2">Goes to</th><th className="px-3 py-2">Why</th></tr></thead>
                <tbody>
                  {data.headers.map((h, i) => {
                    const ask = needs.includes(i);
                    const f = mapping[String(i)];
                    return (
                      <tr key={`${h}-${i}`} className="border-t border-slate-100 align-top">
                        <td className="px-3 py-2 font-medium text-slate-800">{h}</td>
                        <td className="px-3 py-2">
                          {ask ? <span className="rounded-full bg-[#FAEEDA] px-2 py-0.5 text-[11.5px] text-[#633806]">Needs your answer</span>
                            : f && f.length ? f.map(fieldLabel).join(", ") : <span className="text-slate-500">Skipped</span>}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{ask ? suggestions[i].reason : remembered.has(i) ? "Remembered from your last import." : suggestions[i].reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {step === 4 && data ? (
          <div className="mt-4 space-y-4">
            {needs.length ? needs.map((i) => {
              const s = suggestions[i];
              const cur = mapping[String(i)];
              const fields = cur ?? [];
              const vocab = fields.filter((f) => VOCAB_OPTIONS[f]);
              return (
                <div key={`${data.headers[i]}-${i}`} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-[13px] font-semibold text-slate-900">{data.headers[i]}</p>
                  <p className="mt-0.5 text-[12px] text-slate-500">{samples[i]?.length ? samples[i].join(" · ") : "Empty"}</p>
                  <p className="mt-2 text-[12px] font-medium text-slate-700">Best fits (pick one or more)</p>
                  <ul className="mt-1 space-y-1">
                    {s.options.filter((o) => o.field !== "skip").map((o) => {
                      const on = fields.includes(o.field as FieldKey);
                      return (
                        <li key={o.field}>
                          <label className="flex cursor-pointer items-start gap-2 text-[12.5px] text-slate-700">
                            <input type="checkbox" checked={on} className="mt-0.5 h-4 w-4"
                              onChange={() => set(i, on ? fields.filter((x) => x !== o.field) : [...fields, o.field as FieldKey])} />
                            <span><strong>{fieldLabel(o.field as FieldKey)}</strong> <span className="text-slate-500">{o.reason}</span></span>
                          </label>
                        </li>
                      );
                    })}
                    <li>
                      <label className="flex cursor-pointer items-start gap-2 text-[12.5px] text-slate-700">
                        <input type="checkbox" checked={cur !== undefined && cur.length === 0} className="mt-0.5 h-4 w-4"
                          onChange={() => set(i, [])} />
                        <span><strong>Skip this column</strong> <span className="text-slate-500">Leave it out of the import.</span></span>
                      </label>
                    </li>
                  </ul>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[12px] text-[#1A6CE4]">Other fields</summary>
                    <div className="mt-2"><FieldChecks value={fields} onChange={(v) => set(i, v)} keys={ALL_KEYS} /></div>
                  </details>
                  {vocab.map((f) => {
                    const opts = VOCAB_OPTIONS[f] ?? [];
                    const unknown = distinctValues(data.rows, i).filter((v) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v) && mapLabel(f, v).length === 0).slice(0, 12);
                    if (!unknown.length) return null;
                    return (
                      <div key={f} className="mt-3 rounded-md bg-slate-50 p-2">
                        <p className="text-[12px] font-medium text-slate-700">{fieldLabel(f)}: these values did not match the platform list. Pick what each should be (optional).</p>
                        {unknown.map((v) => (
                          <div key={v} className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-slate-600">
                            <span className="mr-1 font-medium">{v}</span>
                            {opts.map((o) => {
                              const picked = valueMap[String(i)]?.[v] ?? [];
                              const on = picked.includes(o.slug);
                              return (
                                <label key={o.slug} className={`cursor-pointer rounded-full border px-2 py-0.5 ${on ? "border-[#1A6CE4] bg-[#E6F1FB] text-[#0C447C]" : "border-slate-300"}`}>
                                  <input type="checkbox" className="sr-only" checked={on}
                                    onChange={() => setValueMap((m) => ({ ...m, [String(i)]: { ...m[String(i)], [v]: on ? picked.filter((x) => x !== o.slug) : [...picked, o.slug] } }))} />
                                  {o.label}
                                </label>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            }) : <p className="text-[12.5px] text-slate-600">Every column matched. Review the result below.</p>}

            {result ? (
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-[13px] font-semibold text-slate-900">What this import will do</p>
                {result.missingFirm ? (
                  <p className="mt-1 text-[12.5px] text-[#A32D2D]">No column is set to Firm yet. Choose one above before importing.</p>
                ) : (
                  <>
                    <p className="mt-1 text-[12.5px] text-slate-600">
                      {result.rowCount.toLocaleString("en-US")} rows read · {result.rows.length.toLocaleString("en-US")} records after cleaning · {result.merged} duplicates merged · {result.invalidEmails} bad emails · {result.skipped} skipped (no firm). New rows are drafts until you publish.
                    </p>
                    <p className="mt-2 text-[12px] text-slate-500">Rows that carry a value, per field</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {fieldCoverage(result).filter((c) => c.filled > 0).map((c) => (
                        <span key={c.field} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11.5px] text-slate-700">{fieldLabel(c.field)} {c.filled.toLocaleString("en-US")}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="mt-3 text-[12.5px] text-[#A32D2D]">{error}</p> : null}
        <div className="mt-4 flex justify-between gap-2">
          <button type="button" disabled={busy || step === 1} onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] disabled:opacity-40">Back</button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px]">Cancel</button>
            {step === 1 ? (
              <button type="button" disabled={busy} onClick={() => void read()} className="rounded-lg bg-[#1A6CE4] px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#2E78F5]">{busy ? "Reading…" : "Read the file"}</button>
            ) : null}
            {step === 2 || step === 3 ? (
              <button type="button" onClick={() => setStep((s) => ((s + 1) as Step))} className="rounded-lg bg-[#1A6CE4] px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#2E78F5]">Next</button>
            ) : null}
            {step === 4 ? (
              <button type="button" disabled={busy || !answered || !result || result.missingFirm} onClick={() => void runImport()} className="rounded-lg bg-[#1A6CE4] px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#2E78F5] disabled:opacity-45">{busy ? "Importing…" : "Import"}</button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
