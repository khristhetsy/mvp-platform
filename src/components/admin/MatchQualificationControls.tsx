"use client";

import { useCallback, useEffect, useState } from "react";

type MatchWeights = { sector: number; specificity: number; stage: number; checkSize: number; revenue: number; activity: number };
type EngineWeights = { sector: number; stage: number; checkSize: number; geography: number; investorType: number; capitalType: number; activeRating: number };
type MatchConfig = {
  requiredFields: { industry: boolean; checkSize: boolean; revenueStage: boolean; useOfFunds: boolean; geography: boolean; activeRating: boolean; investorType: boolean; capitalType: boolean };
  minMatch: number;
  minInvestorScore: number;
  requireRated: boolean;
  weights: MatchWeights;
  engineWeights: EngineWeights;
};
type AutomationConfig = {
  monthlyByPlan: { basic: number; professional: number };
  startDate: string | null;
  cadence: "weekly" | "daily";
  pause: { enabled: boolean; until: string | null };
};
type ConnectionConfig = {
  monthlyByPlan: { basic: number; professional: number };
};

const WEIGHT_LABELS: [keyof EngineWeights, string][] = [
  ["sector", "Sector fit"],
  ["stage", "Stage / use of funds"],
  ["checkSize", "Check size vs. raise"],
  ["geography", "Geography fit"],
  ["investorType", "Type of investor(s)"],
  ["capitalType", "Type(s) of capital"],
  ["activeRating", "Active investor rating"],
];

const FIELD_LABELS: [keyof MatchConfig["requiredFields"], string][] = [
  ["industry", "Industry / sector"],
  ["checkSize", "Check size vs. raise"],
  ["revenueStage", "Revenue stage"],
  ["useOfFunds", "Use of funds"],
  ["geography", "Geography"],
  ["activeRating", "Active investor rating"],
  ["investorType", "Type of investor(s)"],
  ["capitalType", "Type(s) of capital"],
];

/**
 * Admin Control Feature: required match fields + outreach qualification
 * thresholds. Loads/saves the investor match config via the outreach admin API
 * (persisted in platform_settings). Industry is always required (locked).
 */
export function MatchQualificationControls() {
  const [config, setConfig] = useState<MatchConfig | null>(null);
  const [auto, setAuto] = useState<AutomationConfig | null>(null);
  const [conn, setConn] = useState<ConnectionConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/investor-outreach")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active) return;
        if (d?.matchConfig) setConfig(d.matchConfig as MatchConfig);
        if (d?.automation) setAuto(d.automation as AutomationConfig);
        if (d?.connection) setConn(d.connection as ConnectionConfig);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const saveAuto = useCallback(async (next: AutomationConfig) => {
    setAuto(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/investor-outreach", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_automation_config", config: next }),
      });
      if (!res.ok) setError("Couldn't save automation. Please try again.");
    } catch {
      setError("Network error saving automation.");
    } finally {
      setSaving(false);
    }
  }, []);

  const saveConn = useCallback(async (next: ConnectionConfig) => {
    setConn(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/investor-outreach", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_connection_config", config: next }),
      });
      if (!res.ok) setError("Couldn't save connection limits. Please try again.");
    } catch {
      setError("Network error saving connection limits.");
    } finally {
      setSaving(false);
    }
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

      {auto && (
        <div className="mt-4 rounded-lg border border-slate-200 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">Founder outreach automation</div>
          <p className="mt-0.5 text-[11px] leading-5 text-slate-500">Monthly introduction cap by subscription plan. The schedule and pause apply to every founder; per-founder overrides layer on top.</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-700">
              <span>Basic <span className="text-[10px] text-slate-400">$499/mo</span></span>
              <span className="flex items-center gap-1.5">
                <input type="number" min={0} max={100000} value={auto.monthlyByPlan.basic}
                  onChange={(e) => setAuto({ ...auto, monthlyByPlan: { ...auto.monthlyByPlan, basic: Number(e.target.value) } })}
                  onBlur={() => saveAuto(auto)} className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm" />
                <span className="text-[11px] text-slate-500">/ mo</span>
              </span>
            </label>
            <label className="flex items-center justify-between gap-2 rounded-lg border-2 border-indigo-300 px-3 py-2 text-[13px] text-slate-700">
              <span>Professional <span className="text-[10px] text-slate-400">$1,000/mo</span></span>
              <span className="flex items-center gap-1.5">
                <input type="number" min={0} max={100000} value={auto.monthlyByPlan.professional}
                  onChange={(e) => setAuto({ ...auto, monthlyByPlan: { ...auto.monthlyByPlan, professional: Number(e.target.value) } })}
                  onBlur={() => saveAuto(auto)} className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm" />
                <span className="text-[11px] text-slate-500">/ mo</span>
              </span>
            </label>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-[12px] text-slate-600">Start date
              <input type="date" value={auto.startDate ?? ""}
                onChange={(e) => saveAuto({ ...auto, startDate: e.target.value || null })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
            </label>
            <label className="text-[12px] text-slate-600">Send cadence
              <select value={auto.cadence}
                onChange={(e) => saveAuto({ ...auto, cadence: e.target.value === "daily" ? "daily" : "weekly" })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm">
                <option value="weekly">Weekly batches</option>
                <option value="daily">Daily drip</option>
              </select>
            </label>
            <div className="text-[12px] text-slate-600">Pause
              <label className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5">
                <input type="checkbox" checked={auto.pause.enabled}
                  onChange={(e) => saveAuto({ ...auto, pause: { ...auto.pause, enabled: e.target.checked } })}
                  className="h-4 w-4" />
                <span className="text-[11px] text-amber-700">until</span>
                <input type="date" value={auto.pause.until ?? ""}
                  onChange={(e) => setAuto({ ...auto, pause: { ...auto.pause, until: e.target.value || null } })}
                  onBlur={() => saveAuto(auto)}
                  className="w-full rounded-lg border border-slate-300 px-1.5 py-1 text-[12px]" />
              </label>
            </div>
          </div>
        </div>
      )}

      {conn && (
        <div className="mt-4 rounded-lg border border-slate-200 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">Founder connection requests</div>
          <p className="mt-0.5 text-[11px] leading-5 text-slate-500">How many investor connection requests a founder can send per month, by subscription plan. Resets on the 1st. When the cap is reached, the founder&rsquo;s request is blocked with an upgrade prompt.</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-700">
              <span>Basic <span className="text-[10px] text-slate-400">$499/mo</span></span>
              <span className="flex items-center gap-1.5">
                <input type="number" min={0} max={100000} value={conn.monthlyByPlan.basic}
                  onChange={(e) => setConn({ ...conn, monthlyByPlan: { ...conn.monthlyByPlan, basic: Number(e.target.value) } })}
                  onBlur={() => saveConn(conn)} className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm" />
                <span className="text-[11px] text-slate-500">/ mo</span>
              </span>
            </label>
            <label className="flex items-center justify-between gap-2 rounded-lg border-2 border-indigo-300 px-3 py-2 text-[13px] text-slate-700">
              <span>Professional <span className="text-[10px] text-slate-400">$1,000/mo</span></span>
              <span className="flex items-center gap-1.5">
                <input type="number" min={0} max={100000} value={conn.monthlyByPlan.professional}
                  onChange={(e) => setConn({ ...conn, monthlyByPlan: { ...conn.monthlyByPlan, professional: Number(e.target.value) } })}
                  onBlur={() => saveConn(conn)} className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm" />
                <span className="text-[11px] text-slate-500">/ mo</span>
              </span>
            </label>
          </div>
        </div>
      )}

      <div className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Required match fields</div>
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

      <div className="mt-4 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Match factor weights</div>
        <div className="text-[11px] text-slate-500">Total {WEIGHT_LABELS.reduce((a, [k]) => a + (config.engineWeights[k] || 0), 0)}</div>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">How much each investor-fit factor contributes to the match score. A factor with no data on either side drops out (it never penalizes); readiness and marketplace add small fixed bonuses on top.</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {WEIGHT_LABELS.map(([key, label]) => (
          <label key={key} className="flex items-center justify-between gap-2 text-[13px] text-slate-700">
            <span>{label}</span>
            <input
              type="number" min={0} max={100} value={config.engineWeights[key]}
              onChange={(e) => setConfig({ ...config, engineWeights: { ...config.engineWeights, [key]: Number(e.target.value) } })}
              onBlur={() => save(config)}
              className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-3 text-[11px]">
        {saving ? <span className="text-slate-400">Saving…</span> : null}
        {error ? <span className="text-red-600">{error}</span> : null}
      </div>
    </section>
  );
}
