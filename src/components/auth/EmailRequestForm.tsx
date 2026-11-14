"use client";

import { useState } from "react";

/**
 * One email box that posts to an endpoint and shows one fixed confirmation.
 * Used by Forgot password and by "Paid but have no login yet?". The reply is the
 * same for every email, so neither form reveals who has an account or paid.
 */
export function EmailRequestForm({
  endpoint,
  label,
  button,
  sentMessage,
  initialEmail = "",
}: Readonly<{ endpoint: string; label: string; button: string; sentMessage: string; initialEmail?: string }>) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{sentMessage}</p>;
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
        {label}
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-normal"
          placeholder="you@company.com"
        />
      </label>
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <button type="submit" disabled={busy} className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? "Please wait..." : button}
      </button>
    </form>
  );
}
