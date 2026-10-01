"use client";

import { useState } from "react";
import { MAPPING_SOURCES, SOURCE_LABEL, type CustomField, type MappingAction, type MappingSource } from "@/lib/contacts/field-mapping";

type Saved = { source: MappingSource; source_column: string; action: MappingAction; target_field: string | null; custom_key: string | null; updated_at: string };
type Target = { key: string; label: string; group: "Contact" | "Company" };

function valueOf(m: Saved): string {
  if (m.action === "map" && m.target_field) return `map:${m.target_field}`;
  if (m.action === "custom" && m.custom_key) return `custom:${m.custom_key}`;
  return "ignore";
}

export function FieldMappingsClient({ initialSaved, customFields, targets }: { initialSaved: Saved[]; customFields: CustomField[]; targets: Target[] }) {
  const [saved, setSaved] = useState(initialSaved);
  const [source, setSource] = useState<MappingSource>("csv");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const rows = saved.filter((m) => m.source === source);
  const count = (s: MappingSource) => saved.filter((m) => m.source === s).length;
  const labelOf = (m: Saved) => m.action === "map" ? targets.find((t) => t.key === m.target_field)?.label ?? m.target_field
    : m.action === "custom" ? `Custom: ${customFields.find((f) => f.key === m.custom_key)?.label ?? m.custom_key}` : "Skipped";

  async function change(m: Saved, value: string) {
    const mapping = value.startsWith("map:") ? { column: m.source_column, action: "map", target: value.slice(4) }
      : value.startsWith("custom:") ? { column: m.source_column, action: "custom", customKey: value.slice(7) }
      : { column: m.source_column, action: "ignore" };
    const taken = value.startsWith("map:") && saved.find((x) => x.source === m.source && x.source_column !== m.source_column && x.action === "map" && x.target_field === value.slice(4));
    if (taken) { setMsg({ ok: false, text: `"${taken.source_column}" already goes to that field. Change it first.` }); return; }
    setBusy(m.source_column); setMsg(null);
    try {
      const res = await fetch("/api/admin/contacts/field-mapping", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: m.source, mapping: [mapping] }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Couldn't save.");
      setSaved((xs) => xs.map((x) => x === m ? { ...x, action: mapping.action as MappingAction, target_field: mapping.action === "map" ? value.slice(4) : null, custom_key: mapping.action === "custom" ? value.slice(7) : null, updated_at: new Date().toISOString() } : x));
      setMsg({ ok: true, text: `Saved. "${m.source_column}" applies on the next ${SOURCE_LABEL[m.source].toLowerCase()}.` });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't save." }); } finally { setBusy(null); }
  }

  async function remove(m: Saved) {
    setBusy(m.source_column); setMsg(null);
    try {
      const res = await fetch("/api/admin/contacts/field-mapping", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: m.source, column: m.source_column }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Couldn't remove.");
      setSaved((xs) => xs.filter((x) => x !== m));
      setMsg({ ok: true, text: `Removed. "${m.source_column}" will be asked about on the next import.` });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't remove." }); } finally { setBusy(null); }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap gap-1.5">
        {MAPPING_SOURCES.map((s) => (
          <button key={s} type="button" onClick={() => { setSource(s); setMsg(null); }}
            className={`rounded-full border px-3 py-1 text-[12px] ${s === source ? "border-[#2E78F5] bg-[#E6F1FB] text-[#185FA5]" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            {SOURCE_LABEL[s]} <span className="text-slate-400">{count(s)}</span>
          </button>
        ))}
      </div>

      {msg && <div className={`mt-3 rounded-lg px-3 py-2 text-[12.5px] ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</div>}

      {rows.length === 0 ? (
        <p className="mt-4 text-[13px] text-slate-500">No saved mappings for {SOURCE_LABEL[source].toLowerCase()} yet. They&rsquo;re added when you import a file with &ldquo;Remember these mappings&rdquo; on.</p>
      ) : (
        <div className="mt-3">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 border-b border-slate-200 pb-1.5 text-[11px] font-medium text-slate-500"><span>File column</span><span>Goes to</span><span /></div>
          {rows.map((m) => (
            <div key={m.source_column} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-100 py-2 last:border-b-0">
              <span className="break-words font-mono text-[12px] text-slate-600">{m.source_column}</span>
              <select value={valueOf(m)} disabled={busy !== null} onChange={(e) => void change(m, e.target.value)} aria-label={`Field for ${m.source_column}, currently ${labelOf(m)}`}
                className="min-h-[34px] w-full rounded-lg border border-slate-300 bg-white px-2 text-[12.5px] text-slate-800">
                {(["Contact", "Company"] as const).map((g) => (
                  <optgroup key={g} label={g}>{targets.filter((t) => t.group === g).map((t) => <option key={t.key} value={`map:${t.key}`}>{t.label}</option>)}</optgroup>
                ))}
                {customFields.length > 0 && <optgroup label="Custom fields">{customFields.map((f) => <option key={f.key} value={`custom:${f.key}`}>{f.label}</option>)}</optgroup>}
                <option value="ignore">Skip this column</option>
              </select>
              <button type="button" onClick={() => void remove(m)} disabled={busy !== null} aria-label={`Remove mapping for ${m.source_column}`}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[12px] text-slate-600 hover:bg-slate-50 disabled:opacity-50">Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
