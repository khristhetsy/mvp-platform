"use client";

import { useState } from "react";
import { Loader2, ListPlus, Check } from "lucide-react";

const BLUE = "#2E78F5";

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix", "America/Anchorage", "Pacific/Honolulu",
];

export function AddToCallList() {
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useState("");
  const [source, setSource] = useState("");
  const [consentType, setConsentType] = useState("express_written");
  const [timezone, setTimezone] = useState("America/New_York");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [attest, setAttest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skippedExisting: number; notFound: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const identifiers = ids.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);

  async function submit() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/voice/consent/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers, source: source.trim(), consentType, timezone, evidenceUrl: evidenceUrl.trim() || null, attest }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Import failed.");
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">Add contacts to the call list</p>
          <p className="text-xs text-slate-500">Record voice consent for opted-in contacts already in iCapOS. They then become dialable.</p>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <ListPlus className="h-4 w-4" /> {open ? "Close" : "Add contacts"}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          {result && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Added {result.inserted.toLocaleString()} to the call list · {result.skippedExisting} already had consent
              {result.notFound.length > 0 && <span className="text-amber-700"> · {result.notFound.length} not found in iCapOS</span>}.
            </div>
          )}

          <label className="block">
            <span className="text-xs font-medium text-slate-500">Contacts — paste emails or Odoo IDs, one per line</span>
            <textarea value={ids} onChange={(e) => setIds(e.target.value)} rows={5} placeholder={"jane@example.com\njohn@example.com"} className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs focus:outline-none" />
            <span className="text-[11px] text-slate-400">{identifiers.length} contact{identifiers.length === 1 ? "" : "s"} detected</span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Opt-in source</span>
              <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Website contact form, Event signup" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Consent type</span>
              <select value={consentType} onChange={(e) => setConsentType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none">
                <option value="express_written">Express written</option>
                <option value="express">Express (oral)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Default timezone (for calling hours)</span>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none">
                {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Evidence link (optional)</span>
              <input value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://link-to-opt-in-proof" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
            </label>
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
            I confirm these contacts gave documented consent to be contacted by phone, and this batch reflects that opt-in.
          </label>

          <div className="flex justify-end">
            <button onClick={submit} disabled={busy || identifiers.length === 0 || !source.trim() || !attest} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Add to call list
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
