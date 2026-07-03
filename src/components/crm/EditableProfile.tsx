"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Check, X, Search, Plus } from "lucide-react";

const BLUE = "#2E78F5";

type FieldControl = "text" | "textarea" | "select" | "multiselect" | "checkbox" | "number" | "date" | "datetime";
interface FieldDesc {
  name: string;
  label: string;
  control: FieldControl;
  relation?: string;
  options?: { value: string; label: string }[];
}

const CONTACT_KEYS = ["name", "function", "email", "phone", "mobile", "website", "city"];
const NOTES_KEYS = ["comment"];

function labelFor(desc: FieldDesc, value: string): string {
  return desc.options?.find((o) => o.value === value)?.label ?? value;
}

function InlineMultiSelect({ options, selected, onChange }: { options: { value: string; label: string }[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? options.filter((o) => o.label.toLowerCase().includes(n)) : options;
  }, [options, q]);
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap gap-1">
        {selected.length === 0 && <span className="text-xs text-slate-400">None selected</span>}
        {selected.map((v) => {
          const lbl = options.find((o) => o.value === v)?.label ?? v;
          return (
            <span key={v} className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">
              {lbl}
              <button onClick={() => toggle(v)} aria-label={`Remove ${lbl}`} className="text-slate-400 hover:text-slate-700"><X className="h-3 w-3" /></button>
            </span>
          );
        })}
      </div>
      <div className="rounded-lg border border-slate-200">
        {options.length > 8 && (
          <div className="relative border-b border-slate-100">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="w-full rounded-t-lg py-1.5 pl-8 pr-2 text-xs outline-none" />
          </div>
        )}
        <div className="max-h-36 overflow-y-auto p-1">
          {filtered.length === 0 ? <p className="px-2 py-1.5 text-xs text-slate-400">No options.</p> : filtered.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-50">
              <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} className="h-3.5 w-3.5 rounded border-slate-300" />
              <span className="text-slate-700">{o.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function InlineField({ desc, value, onSave }: { desc: FieldDesc; value: unknown; onSave: (name: string, v: unknown) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<unknown>(value);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- sync local draft when the saved value changes and we're not editing */
    if (!editing) setDraft(value);
  }, [value, editing]);

  const wide = desc.control === "textarea" || desc.control === "multiselect";

  async function commit() {
    setSaving(true);
    setError(false);
    try {
      await onSave(desc.name, draft);
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 1800);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  function readDisplay() {
    if (desc.control === "checkbox") return <span className="text-sm text-slate-700">{value ? "Yes" : "No"}</span>;
    if (desc.control === "multiselect") {
      const ids = Array.isArray(value) ? (value as string[]) : [];
      if (ids.length === 0) return <span className="text-sm text-slate-400">—</span>;
      return <span className="flex flex-wrap gap-1">{ids.map((v) => <span key={v} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{labelFor(desc, v)}</span>)}</span>;
    }
    if (desc.control === "select") {
      const s = String(value ?? "");
      if (!s) return <span className="text-sm text-slate-400">—</span>;
      return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{labelFor(desc, s)}</span>;
    }
    const s = String(value ?? "");
    return s ? <span className="whitespace-pre-wrap text-sm text-slate-700">{s}</span> : <span className="text-sm text-slate-400">—</span>;
  }

  function editControl() {
    switch (desc.control) {
      case "textarea":
        return <textarea autoFocus value={String(draft ?? "")} onChange={(e) => setDraft(e.target.value)} rows={4} className="w-full resize-y rounded-lg border border-[#2E78F5] px-3 py-2 text-sm outline-none" />;
      case "select":
        return (
          <select autoFocus value={String(draft ?? "")} onChange={(e) => setDraft(e.target.value)} className="w-full rounded-lg border border-[#2E78F5] px-3 py-2 text-sm outline-none">
            <option value="">—</option>
            {(desc.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case "multiselect":
        return <InlineMultiSelect options={desc.options ?? []} selected={Array.isArray(draft) ? (draft as string[]) : []} onChange={setDraft} />;
      case "checkbox":
        return <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={Boolean(draft)} onChange={(e) => setDraft(e.target.checked)} className="h-4 w-4 rounded border-slate-300" /> Yes</label>;
      case "number":
        return <input autoFocus type="number" value={String(draft ?? "")} onChange={(e) => setDraft(e.target.value)} className="w-full rounded-lg border border-[#2E78F5] px-3 py-2 text-sm outline-none" />;
      case "date":
        return <input autoFocus type="date" value={String(draft ?? "").slice(0, 10)} onChange={(e) => setDraft(e.target.value)} className="w-full rounded-lg border border-[#2E78F5] px-3 py-2 text-sm outline-none" />;
      case "datetime":
        return <input autoFocus type="datetime-local" value={String(draft ?? "").slice(0, 16).replace(" ", "T")} onChange={(e) => setDraft(e.target.value.replace("T", " "))} className="w-full rounded-lg border border-[#2E78F5] px-3 py-2 text-sm outline-none" />;
      default:
        return <input autoFocus value={String(draft ?? "")} onChange={(e) => setDraft(e.target.value)} className="w-full rounded-lg border border-[#2E78F5] px-3 py-2 text-sm outline-none" />;
    }
  }

  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{desc.label}</span>
        {saved && <Check className="h-3 w-3 text-emerald-600" />}
        {error && <span className="text-[10px] text-rose-600">save failed</span>}
      </div>
      {editing ? (
        <div>
          {editControl()}
          <div className="mt-1.5 flex items-center gap-2">
            <button onClick={commit} disabled={saving} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
            </button>
            <button onClick={() => { setEditing(false); setDraft(value); }} className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="group flex w-full items-start justify-between gap-2 rounded-md border border-transparent px-1.5 py-1 text-left hover:border-slate-200 hover:bg-slate-50">
          <span className="min-w-0">{readDisplay()}</span>
          <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100" />
        </button>
      )}
    </div>
  );
}

function Group({ title, fields, values, onSave }: { title: string; fields: FieldDesc[]; values: Record<string, unknown>; onSave: (n: string, v: unknown) => Promise<void> }) {
  if (fields.length === 0) return null;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
        {fields.map((f) => <InlineField key={f.name} desc={f} value={values[f.name]} onSave={onSave} />)}
      </div>
    </section>
  );
}

export function EditableProfile({ externalId }: { externalId: string }) {
  const [schema, setSchema] = useState<FieldDesc[] | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/crm/contacts/${encodeURIComponent(externalId)}/fields`);
        const json = await res.json();
        if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not load fields.");
        if (alive) { setSchema(json.schema as FieldDesc[]); setValues(json.values as Record<string, unknown>); }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load fields.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [externalId]);

  async function saveField(name: string, value: unknown) {
    const res = await fetch(`/api/admin/crm/contacts/${encodeURIComponent(externalId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateProfile", values: { [name]: value } }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(typeof json.error === "string" ? json.error : "Save failed.");
    }
    setValues((v) => ({ ...v, [name]: value }));
  }

  if (loading) {
    return <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading editable fields from Odoo…</div>;
  }
  if (error || !schema) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Couldn’t load editable fields ({error ?? "unknown"}). Try the “Edit all fields” button, or reload.</div>;
  }

  const contact = schema.filter((f) => CONTACT_KEYS.includes(f.name));
  const notes = schema.filter((f) => NOTES_KEYS.includes(f.name));
  const profile = schema.filter((f) => !CONTACT_KEYS.includes(f.name) && !NOTES_KEYS.includes(f.name));

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-1.5 text-[11px] text-slate-400"><Plus className="h-3 w-3" /> Hover any field and click to edit — each field saves to Odoo on its own.</p>
      <Group title="Contact" fields={contact} values={values} onSave={saveField} />
      <Group title="Notes" fields={notes} values={values} onSave={saveField} />
      <Group title="Profile" fields={profile} values={values} onSave={saveField} />
    </div>
  );
}
