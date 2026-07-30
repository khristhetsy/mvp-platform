"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Master switch for automatic investor email outreach, surfaced on the admin
 * Feature Controls page. Reads/writes the same `investor_outreach_automation`
 * setting as the Outreach Qualification page (via /api/admin/investor-outreach),
 * so the two stay in sync. When ON, qualified founders' campaigns dispatch real
 * Founder-Preview emails on the weekly pass.
 */
export function OutreachAutomationToggle() {
  const [live, setLive] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/investor-outreach")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active && d) setLive(Boolean(d.liveSend)); })
      .catch(() => { if (active) setError("Couldn't load status."); });
    return () => { active = false; };
  }, []);

  const toggle = useCallback(async () => {
    if (live === null || saving) return;
    const next = !live;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/investor-outreach", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_automation", enabled: next }),
      });
      if (!res.ok) throw new Error();
      setLive(next);
    } catch {
      setError("Couldn't update. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [live, saving]);

  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Automatic investor email outreach</h2>
            {live !== null ? (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${live ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-slate-400"}`} />
                {live ? "Live — sending on" : "Off — nothing sends"}
              </span>
            ) : null}
          </div>
          <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
            When on, qualified founders&rsquo; Founder-Preview one-pagers are emailed automatically to matched investors on
            the weekly pass. Suppression list, unsubscribe, and each founder&rsquo;s do-not-contact list are always honored.
            Detailed match rules, caps, and message live on{" "}
            <a href="/admin/outreach-qualification" className="font-medium text-indigo-600 hover:text-indigo-700">Outreach Qualification</a>.
          </p>
          {error ? <p className="mt-1 text-[11px] text-red-600">{error}</p> : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(live)}
          aria-label="Toggle automatic investor email outreach"
          onClick={toggle}
          disabled={live === null || saving}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${live ? "bg-emerald-600" : "bg-slate-300"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${live ? "translate-x-[22px]" : "translate-x-0.5"}`} />
        </button>
      </div>
    </section>
  );
}
