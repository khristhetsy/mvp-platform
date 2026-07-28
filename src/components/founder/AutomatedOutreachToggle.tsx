"use client";

import { useState } from "react";

/**
 * Founder on/off switch for their own automated outreach. Posts to
 * /api/founder/outreach/pause. "On" means outreach runs; toggling off pauses the
 * company's campaign so the weekly send pass skips it — no env change needed.
 */
export function AutomatedOutreachToggle({
  initialPaused,
  active,
}: {
  initialPaused: boolean;
  /** Whether an outreach campaign exists yet (needs a strong-fit match). When
   *  false, there's nothing to pause — show a "waiting" state instead. */
  active: boolean;
}) {
  const [paused, setPaused] = useState(initialPaused);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const on = !paused;

  if (!active) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">Automated outreach</p>
          <p className="text-xs text-slate-500">
            On — waiting for a strong-fit investor (match ≥ 70). It starts automatically as soon as one appears.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">Waiting</span>
      </div>
    );
  }

  async function toggle() {
    const nextPaused = !paused;
    setSaving(true);
    setError(null);
    // Optimistic.
    setPaused(nextPaused);
    try {
      const res = await fetch("/api/founder/outreach/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: nextPaused }),
      });
      if (!res.ok) {
        setPaused(!nextPaused); // revert
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Couldn't update. Try again.");
      }
    } catch {
      setPaused(!nextPaused);
      setError("Couldn't update. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">Automated outreach</p>
        <p className="text-xs text-slate-500">
          {on
            ? "On — your Founder Preview is shared with newly matched investors."
            : "Paused — no new investors will be contacted until you turn this back on."}
        </p>
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Automated outreach"
        disabled={saving}
        onClick={() => void toggle()}
        className={`relative h-[22px] w-10 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-60 ${
          on ? "bg-indigo-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform ${
            on ? "translate-x-[20px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
