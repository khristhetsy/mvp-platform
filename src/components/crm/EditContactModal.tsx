"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import type { ContactFull } from "@/lib/crm/types";

const BLUE = "#2E78F5";

export function EditContactModal({ record: r, onClose }: { record: ContactFull; onClose: () => void }) {
  const router = useRouter();
  const d = r.details;
  const [name, setName] = useState(r.name);
  const [title, setTitle] = useState(d.title ?? "");
  const [email, setEmail] = useState(d.email ?? "");
  const [phone, setPhone] = useState(d.phone ?? "");
  const [website, setWebsite] = useState(d.website ?? "");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/crm/contacts/${encodeURIComponent(r.externalId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          fields: { name, title, email, phone, website, city: city || undefined },
        }),
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

  const field = (label: string, value: string, set: (v: string) => void, type = "text") => (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <input type={type} value={value} onChange={(e) => set(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-950">Edit contact in Odoo</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 px-5 py-4">
          {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          {field("Name", name, setName)}
          {field("Job title", title, setTitle)}
          {field("Email", email, setEmail, "email")}
          {field("Phone", phone, setPhone)}
          {field("Website", website, setWebsite)}
          {field("City", city, setCity)}
          <p className="text-[11px] text-slate-400">Saves directly to Odoo (the system of record) and updates the CRM mirror.</p>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save to Odoo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
