"use client";

import { useState } from "react";

/** Starts an acting session for this founder, then opens the founder's workspace as them. */
export function OpenAsFounderButton({ founderId, founderName }: { founderId: string; founderName: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/admin/act-on-behalf", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ founderId }),
            });
            if (res.ok) {
              window.location.href = "/founder/dashboard";
              return;
            }
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            setError(data.error ?? "Could not open this account.");
          } catch {
            setError("Network error. Please try again.");
          }
          setBusy(false);
        }}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {busy ? "Opening…" : `Open as ${founderName}`}
      </button>
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </div>
  );
}
