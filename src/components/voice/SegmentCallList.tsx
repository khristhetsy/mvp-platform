"use client";

import { useEffect, useState } from "react";
import { Loader2, ListPlus, Check, CircleCheck } from "lucide-react";

const BLUE = "#2E78F5";
const TIMEZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix", "Pacific/Honolulu"];

type Segment = { kind: "module" | "status"; value: string; label: string; count: number };

export function SegmentCallList({ onChanged }: { onChanged?: () => void }) {
  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [sel, setSel] = useState<Segment | null>(null);
  const [source, setSource] = useState("");
  const [consentType, setConsentType] = useState("express_written");
  const [timezone, setTimezone] = useState("America/New_York");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [attest, setAttest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ inserted: number; skippedExisting: number; total: number } | null>(null);

  useEffect(() => {
    void fetch("/api/admin/voice/segments").then((r) => r.json()).then((d) => setSegments(d.segments ?? [])).catch(() => setSegments([]));
  }, []);

  async function add() {
    if (!sel) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/admin/voice/segments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: sel.kind, value: sel.value, source: source.trim(), consentType, timezone, evidenceUrl: evidenceUrl.trim() || null, attest }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed.");
      setResult(json);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-800">Add contacts to the call list</p>
      <p className="mb-3 text-xs text-slate-500">Pick a segment already in iCapOS, record its opt-in, and the whole group becomes dialable.</p>

      {error && <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
      {result && <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Added {result.inserted.toLocaleString()} to the call list · {result.skippedExisting.toLocaleString()} already consented.</p>}

      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">1 · Choose a segment</p>
      {segments === null ? (
        <div className="flex items-center gap-2 py-3 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading segments…</div>
      ) : segments.length === 0 ? (
        <p className="py-3 text-sm text-slate-400">No contact segments found.</p>
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {segments.map((s) => {
            const active = sel?.kind === s.kind && sel?.value === s.value;
            return (
              <button key={`${s.kind}:${s.value}`} onClick={() => setSel(s)} className={`rounded-lg border p-3 text-left ${active ? "border-2 border-[#2E78F5] bg-[var(--blue-muted)]" : "border-slate-200 hover:bg-slate-50"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">{s.label}</span>
                  {active && <CircleCheck className="h-4 w-4" style={{ color: BLUE }} />}
                </div>
                <div className="text-[11px] text-slate-400">{s.count.toLocaleString()} contacts</div>
              </button>
            );
          })}
        </div>
      )}

      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">2 · Record the opt-in</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="text-xs font-medium text-slate-500">Opt-in source</span>
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Website contact form" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none" /></label>
        <label className="block"><span className="text-xs font-medium text-slate-500">Consent type</span>
          <select value={consentType} onChange={(e) => setConsentType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"><option value="express_written">Express written</option><option value="express">Express (oral)</option></select></label>
        <label className="block"><span className="text-xs font-medium text-slate-500">Default timezone</span>
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none">{TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
        <label className="block"><span className="text-xs font-medium text-slate-500">Evidence link (optional)</span>
          <input value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://…" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none" /></label>
      </div>

      <label className="mt-3 flex items-start gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
        I confirm these contacts gave documented consent to be contacted by phone.
      </label>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
        <span className="text-xs text-slate-500">{sel ? <><strong className="text-slate-800">{sel.count.toLocaleString()} contacts</strong> in {sel.label} will be added.</> : "Select a segment above."}</span>
        <button onClick={add} disabled={busy || !sel || !source.trim() || !attest} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListPlus className="h-4 w-4" />} Add to call list
        </button>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400"><Check className="h-3 w-3" /> Already-consented contacts are skipped. Nothing dials until you launch, and the gate still checks hours, do-not-call, and the two-call cap.</p>
    </div>
  );
}
