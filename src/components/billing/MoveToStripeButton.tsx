"use client";

import { useState } from "react";

/** Creates a fresh Stripe checkout for the move and sends the customer there. */
export function MoveToStripeButton({ token }: Readonly<{ token: string }>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/move-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setError(data?.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    }
    setBusy(false);
  }

  return (
    <div>
      <button type="button" onClick={() => void go()} disabled={busy} className="w-full rounded-lg bg-[#1A6CE4] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2E78F5] disabled:opacity-60">
        {busy ? "Opening Stripe…" : "Continue to Stripe"}
      </button>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
