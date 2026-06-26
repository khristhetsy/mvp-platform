"use client";

import { useState } from "react";
import { EVENT_SECTORS } from "@/lib/icfo-events/sectors";

export function NetworkingOptIn({
  eventId,
  initialOptedIn,
  initialInterests,
}: {
  eventId: string;
  initialOptedIn: boolean;
  initialInterests: string[];
}) {
  const [optedIn, setOptedIn] = useState(initialOptedIn);
  const [interests, setInterests] = useState<string[]>(initialInterests);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleInterest(slug: string) {
    setInterests((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
    setSaved(false);
  }

  async function save(nextOptedIn: boolean, nextInterests: string[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/events/networking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, optedIn: nextOptedIn, interests: nextInterests }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not save.");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[var(--navy)]">Networking</h3>
          <p className="text-sm text-[var(--text-muted)]">
            Opt in to be matched with other attendees by shared interests. Off by default; names only, no
            contact details shared.
          </p>
        </div>
        <button
          onClick={() => {
            const next = !optedIn;
            setOptedIn(next);
            save(next, interests);
          }}
          disabled={busy}
          className={`relative inline-flex h-6 w-11 flex-none items-center rounded-full transition disabled:opacity-50 ${
            optedIn ? "bg-[var(--indigo)]" : "bg-slate-300"
          }`}
          aria-pressed={optedIn}
          aria-label="Toggle networking opt-in"
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${optedIn ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>

      {optedIn && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Your interests</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {EVENT_SECTORS.map((s) => {
              const on = interests.includes(s.slug);
              return (
                <button
                  key={s.slug}
                  onClick={() => toggleInterest(s.slug)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    on
                      ? "border-[var(--indigo)] bg-[var(--indigo-soft)] text-[var(--indigo)]"
                      : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-slate-50"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => save(true, interests)}
            disabled={busy}
            className="mt-3 rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save interests"}
          </button>
          {saved && <span className="ml-2 text-xs text-emerald-700">Saved</span>}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
