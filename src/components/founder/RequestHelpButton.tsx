"use client";

import { useState } from "react";

/**
 * Founder "Request help" entry point. Pre-fills the stage/item so the request
 * lands in staff's queue with context. Drop onto any founder screen.
 */
export function RequestHelpButton({
  contextItem = null,
  contextStage = null,
}: Readonly<{ contextItem?: string | null; contextStage?: string | null }>) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState(contextItem ? `Help with ${contextItem}` : "");
  const [body, setBody] = useState("");

  async function submit() {
    if (!subject.trim()) {
      setError("Add a short subject.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/founder/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, source: "request_help", contextStage, contextItem }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Could not send your request.");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
        <i className="ti ti-headset mt-0.5 text-indigo-600" aria-hidden="true" />
        <p className="text-[13px] text-indigo-900">Our team is on it — we&apos;ll reply to you here. You can keep working in the meantime.</p>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setError(null); }}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <i className="ti ti-lifebuoy" aria-hidden="true" /> Request help
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Request help</h3>
                <p className="mt-0.5 text-xs text-slate-500">Our team will reply to you here.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">✕</button>
            </div>

            <label className="mb-1 block text-xs font-medium text-slate-600">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What do you need help with?"
              className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
            <label className="mb-1 block text-xs font-medium text-slate-600">Details</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="Add anything that helps us help you."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
            {error ? <p className="mt-2 text-xs font-medium text-red-600">{error}</p> : null}

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={submit} disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                {busy ? "Sending…" : "Send request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
