"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/** Import a historical booklet PDF into the library as an archived_import (Step 7). */
export function BrochureImportButton() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Choose a PDF."); return; }
    if (!title.trim()) { setError("Enter a title."); return; }
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("title", title.trim());
      const res = await fetch("/api/admin/events/brochure/import", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't import.");
      setOpen(false); setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't import.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--navy)] hover:border-[var(--blue)]">
        Import archive PDF
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
      <p className="text-sm font-semibold text-[var(--navy)]">Import a historical booklet</p>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">Adds a pre-platform PDF to the library — view, download, and link only. Not regenerable.</p>
      {error && <div className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
      <div className="mt-3 space-y-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. PE Expo Scottsdale — 2023)" className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
        <input ref={fileRef} type="file" accept="application/pdf" className="block w-full text-sm" />
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={submit} disabled={busy} className="cap-btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">{busy ? "Importing…" : "Import"}</button>
        <button type="button" onClick={() => { setOpen(false); setError(null); }} className="rounded-md px-3 py-2 text-sm font-medium text-[var(--text-muted)]">Cancel</button>
      </div>
    </div>
  );
}
