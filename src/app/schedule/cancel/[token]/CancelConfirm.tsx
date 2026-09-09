"use client";

import { useState } from "react";

export function CancelConfirm({ token, alreadyCancelled, title, hostName, when }: {
  token: string; alreadyCancelled: boolean; title: string; hostName: string | null; when: string;
}) {
  const [done, setDone] = useState(alreadyCancelled);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function cancel() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/scheduling/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(typeof j.error === "string" ? j.error : "Couldn’t cancel."); return; }
      setDone(true);
    } catch { setErr("Network error — please try again."); } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Booking cancelled</h1>
        <p className="mt-1 text-sm text-slate-600">Your meeting{hostName ? ` with ${hostName}` : ""} on {when} has been cancelled. Both parties have been notified.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-lg font-semibold text-slate-900">Cancel this booking?</h1>
      <p className="mt-1 text-sm text-slate-600"><strong>{title}</strong>{hostName ? ` with ${hostName}` : ""}</p>
      <p className="text-sm text-slate-600">{when}</p>
      {err ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{err}</p> : null}
      <div className="mt-5 flex justify-center gap-2">
        <button type="button" onClick={() => void cancel()} disabled={busy} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{busy ? "Cancelling…" : "Cancel booking"}</button>
      </div>
    </div>
  );
}
