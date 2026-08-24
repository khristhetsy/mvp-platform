"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { EVENT_SECTORS } from "@/lib/icfo-events/sectors";

/**
 * Networking is chosen at registration (required). This panel lets an attendee
 * review and update their interests later — there is no opt-in toggle; everyone
 * who registered is matched by shared interests (names only).
 */
export function NetworkingOptIn({
  eventId,
  initialInterests,
}: {
  eventId: string;
  initialInterests: string[];
}) {
  const t = useTranslations("eventsCmp");
  const [interests, setInterests] = useState<string[]>(initialInterests);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleInterest(slug: string) {
    setInterests((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
    setSaved(false);
  }

  async function save() {
    if (interests.length === 0) { setError("Pick at least one interest."); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/events/networking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, optedIn: true, interests }),
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
      <h3 className="font-semibold text-[var(--navy)]">{t("networking")}</h3>
      <p className="text-sm text-[var(--text-muted)]">
        You&rsquo;re matched with attendees by shared interests. Names only — no contact details shared until both
        sides accept. Update your interests any time.
      </p>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{t("your_interests")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {EVENT_SECTORS.map((s) => {
            const on = interests.includes(s.slug);
            return (
              <button
                key={s.slug}
                type="button"
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
          type="button"
          onClick={save}
          disabled={busy}
          className="mt-3 rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save interests"}
        </button>
        {saved && <span className="ml-2 text-xs text-emerald-700">{t("saved")}</span>}
      </div>

      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
