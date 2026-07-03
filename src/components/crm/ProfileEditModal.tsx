"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Search } from "lucide-react";

const BLUE = "#2E78F5";

type FieldControl = "text" | "textarea" | "select" | "multiselect" | "checkbox" | "number" | "date" | "datetime";
interface FieldDesc {
  name: string;
  label: string;
  control: FieldControl;
  relation?: string;
  options?: { value: string; label: string }[];
}

function MultiSelect({ options, selected, onChange }: { options: { value: string; label: string }[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? options.filter((o) => o.label.toLowerCase().includes(n)) : options;
  }, [options, q]);
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <div className="rounded-lg border border-slate-200">
      {options.length > 8 && (
        <div className="relative border-b border-slate-100">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="w-full rounded-t-lg py-1.5 pl-8 pr-2 text-xs outline-none" />
        </div>
      )}
      <div className="max-h-40 overflow-y-auto p-1.5">
        {filtered.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-slate-400">No options.</p>
        ) : (
          filtered.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-50">
              <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} className="h-3.5 w-3.5 rounded border-slate-300" />
              <span className="text-slate-700">{o.label}</span>
            </label>
          ))
        )}
      </div>
      {selected.length > 0 && <div className="border-t border-slate-100 px-2 py-1 text-[10px] text-slate-400">{selected.length} selected</div>}
    </div>
  );
}

export function ProfileEditModal({ externalId, contactName, onClose }: { externalId: string; contactName: string; onClose: () => void }) {
  const router = useRouter();
  const [schema, setSchema] = useState<FieldDesc[] | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/crm/contacts/${encodeURIComponent(externalId)}/fields`);
        const json = await res.json();
        if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not load fields.");
        if (alive) { setSchema(json.schema as FieldDesc[]); setForm(json.values as Record<string, unknown>); }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load fields.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [externalId]);

  const set = (name: string, value: unknown) => setForm((f) => ({ ...f, [name]: value }));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/crm/contacts/${encodeURIComponent(externalId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateProfile", values: form }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not save to Odoo.");
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save to Odoo.");
    } finally {
      setSaving(false);
    }
  }

  function renderField(f: FieldDesc) {
    const v = form[f.name];
    switch (f.control) {
      case "textarea":
        return <textarea value={String(v ?? "")} onChange={(e) => set(f.name, e.target.value)} rows={3} className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />;
      case "select":
        return (
          <select value={String(v ?? "")} onChange={(e) => set(f.name, e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none">
            <option value="">—</option>
            {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case "multiselect":
        return <MultiSelect options={f.options ?? []} selected={Array.isArray(v) ? (v as string[]) : []} onChange={(vals) => set(f.name, vals)} />;
      case "checkbox":
        return <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={Boolean(v)} onChange={(e) => set(f.name, e.target.checked)} className="h-4 w-4 rounded border-slate-300" /> Yes</label>;
      case "number":
        return <input type="number" value={String(v ?? "")} onChange={(e) => set(f.name, e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />;
      case "date":
        return <input type="date" value={String(v ?? "").slice(0, 10)} onChange={(e) => set(f.name, e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />;
      case "datetime":
        return <input type="datetime-local" value={String(v ?? "").slice(0, 16).replace(" ", "T")} onChange={(e) => set(f.name, e.target.value.replace("T", " "))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />;
      default:
        return <input value={String(v ?? "")} onChange={(e) => set(f.name, e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />;
    }
  }

  const wide = (f: FieldDesc) => f.control === "textarea" || f.control === "multiselect";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-950">Edit all fields — {contactName}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading fields from Odoo…</div>
          ) : !schema ? (
            <p className="py-16 text-center text-sm text-slate-500">Could not load fields.</p>
          ) : (
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              {schema.map((f) => (
                <div key={f.name} className={wide(f) ? "sm:col-span-2" : ""}>
                  <label className="mb-1 block text-xs font-medium text-slate-500">{f.label}</label>
                  {renderField(f)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-slate-100 px-5 py-3">
          <p className="text-[11px] text-slate-400">Writes directly to Odoo (system of record) and refreshes the CRM.</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button onClick={save} disabled={saving || loading || !schema} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save to Odoo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
