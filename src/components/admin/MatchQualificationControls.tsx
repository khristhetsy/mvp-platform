"use client";

import { useCallback, useEffect, useState } from "react";

type MatchConfig = {
  requiredFields: { industry: boolean; checkSize: boolean; revenueStage: boolean; useOfFunds: boolean; geography: boolean; activeRating: boolean };
  minMatch: number;
  minInvestorScore: number;
  requireRated: boolean;
};

const FIELD_LABELS: [keyof MatchConfig["requiredFields"], string][] = [
  ["industry", "Industry / sector"],
  ["checkSize", "Check size vs. raise"],
  ["revenueStage", "Revenue stage"],
  ["useOfFunds", "Use of funds"],
  ["geography", "Geography"],
  ["activeRating", "Active investor rating"],
];

/**
 * Admin Control Feature: required match fields + outreach qualification
 * thresholds. Loads/saves the investor match config via the outreach admin API
 * (persisted in platform_settings). Industry is always required (locked).
 */
export function MatchQualificationControls() {
  const [config, setConfig] = useState<MatchConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/investor-outreach")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active && d?.matchConfig) setConfig(d.matchConfig as MatchConfig); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const save = useCallback(async (next: MatchConfig) => {
    setConfig(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/investor-outreach", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_match_config", config: next }),
      });
      if (!res.ok) setError("Couldn't save. Please try again.");
    } catch {
      setError("Network error saving settings.");
    } finally {
      setSaving(false);
    }
  }, []);

  if (!config) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Investor match &amp; outreach qualification</h2>
      <p className="mt-0.5 text-xs leading-5 text-slate-500">
        A <span className="font-medium">required</span> field must match or the investor is excluded from founder
        matches entirely. Thresholds gate who is queued for automated outreach.
      </p>

      <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Required match fields</div>
      <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {FIELD_LABELS.map(([key, label]) => {
          const on = config.requiredFields[key];
          const locked = key === "industry";
          return (
            <button
              key={key}
              type="button"
              disabled={locked || saving}
              onClick={() => save({ ...config, requiredFields: { ...config.requiredFields, [key]: !on } })}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-90"
            >
              <span className="text-[13px] text-slate-700">{label}</span>
              <span className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold ${on ? "text-indigo-700" : "text-slate-400"}`}>
                  {on ? "Required" : "Optional"}{locked ? " · locked" : ""}
                </span>
                <span className={`relative inline-flex h-5 w-9 items-center rounded-full ${on ? "bg-emerald-600" : "bg-slate-300"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : "translate-x-1"}`} />
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-[13px] text-slate-700">
          Minimum match score
          <input
            type="number" min={0} max={100} value={config.minMatch}
            onChange={(e) => setConfig({ ...config, minMatch: Number(e.target.value) })}
            onBlur={() => save(config)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-[13px] text-slate-700">
          Minimum investor score
          <input
            type="number" min={0} max={100} value={config.minInvestorScore}
            onChange={(e) => setConfig({ ...config, minInvestorScore: Number(e.target.value) })}
            onBlur={() => save(config)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-[13px] text-slate-700">
        <input
          type="checkbox" checked={config.requireRated}
          onChange={(e) => save({ ...config, requireRated: e.target.checked })}
          className="h-4 w-4"
        />
        Require a rated investor score (exclude unrated &ldquo;New&rdquo; investors)
      </label>
      <div className="mt-2 flex items-center gap-3 text-[11px]">
        {saving ? <span className="text-slate-400">Saving…</span> : null}
        {error ? <span className="text-red-600">{error}</span> : null}
      </div>
    </section>
  );
}
