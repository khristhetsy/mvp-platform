"use client";

import { useEffect, useState } from "react";

interface Profile { company: string | null; billing_contact: string | null; address: string | null }
const FIELDS: Array<{ key: keyof Profile; label: string; placeholder: string }> = [
  { key: "company", label: "Company", placeholder: "iCFO Capital Global, Inc." },
  { key: "billing_contact", label: "Billing contact", placeholder: "billing@icapos.com" },
  { key: "address", label: "Address", placeholder: "La Jolla, CA, USA" },
];

export function OrgBillingProfileCard() {
  const [form, setForm] = useState<Profile>({ company: "", billing_contact: "", address: "" });
  const [loaded, setLoaded] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/billing/org-profile").then((r) => r.json()).then((d) => {
      const p: Profile = { company: d.profile?.company ?? "", billing_contact: d.profile?.billing_contact ?? "", address: d.profile?.address ?? "" };
      setForm(p); setLoaded(p);
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const r = await fetch("/api/admin/billing/org-profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (r.ok) { setLoaded(form); setEditing(false); setMsg("Saved."); }
      else setMsg("Save failed.");
    } catch { setMsg("Save failed."); }
    finally { setSaving(false); }
  };
  const cancel = () => { if (loaded) setForm(loaded); setEditing(false); setMsg(null); };

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Billing profile</h2>
        {editing
          ? <span className="rounded-md bg-[#1A6CE4]/10 px-2 py-0.5 text-[11px] font-medium text-[#1A6CE4]">✎ Editing</span>
          : <button onClick={() => setEditing(true)} className="text-xs font-medium text-[#1A6CE4] hover:underline">Edit</button>}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="mb-1 block text-[11px] text-slate-500">{f.label}</label>
            <input
              value={form[f.key] ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              disabled={!editing}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${editing ? "border-[#1A6CE4] bg-[#f7faff] text-slate-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}
            />
          </div>
        ))}
      </div>
      {editing && (
        <div className="mt-3 flex items-center gap-2">
          <button onClick={() => void save()} disabled={saving} className="rounded-lg bg-[#1A6CE4] px-4 py-2 text-xs font-semibold text-white">{saving ? "Saving…" : "Save changes"}</button>
          <button onClick={cancel} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600">Cancel</button>
          {msg && <span className="text-xs text-slate-500">{msg}</span>}
        </div>
      )}
      <p className="mt-3 text-[11px] text-slate-500">Payment method changes route through the Lemon Squeezy secure form — card details are never entered or stored here.</p>
    </div>
  );
}
