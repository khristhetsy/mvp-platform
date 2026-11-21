"use client";

import { useState } from "react";
import { Check, Clock } from "lucide-react";

const CARD = "rounded-xl border border-[var(--border-subtle)] bg-white p-6 text-center";

/**
 * The set a time link ran out. One tap emails a fresh one to the address the
 * first went to, so nothing on this page can redirect it.
 */
export function ExpiredScheduleLink({
  token, investorName, maskedEmail,
}: Readonly<{ token: string; investorName: string; maskedEmail: string | null }>) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function request() {
    setError(null);
    setState("sending");
    try {
      const res = await fetch("/api/events/introductions/schedule/new-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not send a new link.");
        setState("idle");
        return;
      }
      setState("sent");
    } catch {
      setError("Could not send a new link.");
      setState("idle");
    }
  }

  return (
    <div className={CARD}>
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800">
        <Clock className="h-5 w-5" aria-hidden="true" />
      </div>
      <h1 className="text-lg font-semibold text-[var(--navy)]">This link has expired</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        {state === "sent"
          ? "Check your inbox. The new link works for 30 days."
          : `Links to set a time with ${investorName} work for 30 days. We can send you a new one.`}
      </p>
      {state === "sent" ? (
        <p
          role="status"
          className="mt-4 inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          New link sent
        </p>
      ) : (
        <button
          type="button"
          onClick={request}
          disabled={state === "sending"}
          className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {state === "sending" ? "Sending" : "Email me a new link"}
        </button>
      )}
      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
      {maskedEmail && <p className="mt-2 text-xs text-[var(--text-muted)]">Sent to {maskedEmail}</p>}
    </div>
  );
}
