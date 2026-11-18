"use client";

import { useState } from "react";

/** Yes or no to being matched. Nothing is saved until a button is pressed. */
export function NetworkingChoiceClient({
  token,
  eventTitle,
  initialOptedIn,
  preset,
}: Readonly<{
  token: string;
  eventTitle: string;
  initialOptedIn: boolean;
  preset: "yes" | "no" | null;
}>) {
  const [optedIn, setOptedIn] = useState(initialOptedIn);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/events/networking/choice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, optedIn: next }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setError(json.error ?? "Could not save your choice."); return; }
      setOptedIn(next);
      setSaved(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const primary = "rounded-lg bg-[var(--navy)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
  const secondary = "rounded-lg border border-[var(--border-subtle)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--navy)] disabled:opacity-50";

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-6">
      <h1 className="text-lg font-semibold text-[var(--navy)]">Networking at {eventTitle}</h1>

      {saved ? (
        <>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            {optedIn
              ? "You are in. We will email you the people worth meeting."
              : "You will not be matched or emailed introductions for this event."}
          </p>
          <button type="button" disabled={busy} onClick={() => void choose(!optedIn)} className={`mt-4 ${secondary}`}>
            {optedIn ? "Actually, take me out" : "Undo, match me"}
          </button>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            We match investors and founders by shared sectors. Investors are emailed the founders worth meeting, and
            founders hear when an investor accepts. Doing nothing keeps you in.
          </p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            You are currently {optedIn ? "in" : "out"}.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void choose(true)}
              className={preset === "no" ? secondary : primary}>
              Yes, match me
            </button>
            <button type="button" disabled={busy} onClick={() => void choose(false)}
              className={preset === "no" ? primary : secondary}>
              No thanks
            </button>
          </div>
        </>
      )}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
