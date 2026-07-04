"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, UserPlus } from "lucide-react";

type Result = { inserted: number; merged: number; skipped: number; total: number };

export function AddContactsCard() {
  const router = useRouter();
  const [tab, setTab] = useState<"file" | "manual">("file");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Manual form
  const [form, setForm] = useState({ email: "", name: "", side: "", company: "", website: "", note: "" });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/contacts/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setResult(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleManual(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/contacts/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          name: form.name || null,
          side: form.side || null,
          company: form.company || null,
          website: form.website || null,
          note: form.note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add contact.");
      setResult(data);
      setForm({ email: "", name: "", side: "", company: "", website: "", note: "" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add contact.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--blue,#2E78F5)] focus:outline-none";

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)]">
      <div className="mb-1 flex items-center gap-2">
        <UserPlus className="h-5 w-5 text-[#1A6CE4]" strokeWidth={1.75} aria-hidden />
        <h2 className="text-base font-semibold text-slate-950">Add contacts</h2>
      </div>
      <p className="mb-4 text-sm text-slate-600">
        Import a file or type one in. New contacts land in the same deduped store as Odoo — matched on email — and appear in the Marketing Hub.
      </p>

      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
        {(["file", "manual"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setResult(null); setError(null); }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${tab === t ? "bg-[#2E78F5] text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {t === "file" ? "File upload" : "Manual add"}
          </button>
        ))}
      </div>

      {tab === "file" ? (
        <div>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center hover:border-[#2E78F5]">
            <FileUp className="h-6 w-6 text-slate-400" strokeWidth={1.75} aria-hidden />
            <span className="text-sm font-medium text-slate-700">{busy ? "Importing…" : "Choose a CSV, XLSX, or vCard (.vcf) file"}</span>
            <span className="text-xs text-slate-500">Columns auto-detected: email, name, company, website, phone, side</span>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.vcf,.vcard" onChange={handleFile} disabled={busy} className="hidden" />
          </label>
        </div>
      ) : (
        <form onSubmit={handleManual} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Email *</label>
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@company.com" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Side</label>
            <select value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value })} className={inputCls}>
              <option value="">Unclassified</option>
              <option value="founder">Founder</option>
              <option value="investor">Investor</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Company</label>
            <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Website</label>
            <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="company.com" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Note <span className="text-slate-400">(feeds the approach model)</span></label>
            <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy || !form.email} className="rounded-lg bg-[#2E78F5] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? "Adding…" : "Add contact"}
            </button>
          </div>
        </form>
      )}

      {result ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {result.inserted} added, {result.merged} merged with existing{result.skipped ? `, ${result.skipped} skipped (no valid email / duplicate)` : ""}.
        </p>
      ) : null}
      {error ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
    </section>
  );
}
