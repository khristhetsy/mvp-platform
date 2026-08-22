"use client";

import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import { LIMIT_PLANS, PLAN_LABELS, type LimitPlan, type PlanLimit, type UsagePeriod } from "@/lib/ai-usage";
import { FEATURE_LABELS } from "@/lib/feature-controls";

type FeatureLimits = Record<LimitPlan, PlanLimit>;

export function AiUsageLimitsControls() {
  const [features, setFeatures] = useState<string[]>([]);
  const [limits, setLimits] = useState<Record<string, FeatureLimits>>({});
  const [loading, setLoading] = useState(true);
  const [savingFeature, setSavingFeature] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ feature: string; text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/ai-usage-limits");
        if (!res.ok) return;
        const j = await res.json();
        if (!active) return;
        setFeatures(j.features ?? []);
        setLimits(j.limits ?? {});
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  function update(feature: string, plan: LimitPlan, patch: Partial<PlanLimit>) {
    setMsg(null);
    setLimits((prev) => ({
      ...prev,
      [feature]: { ...prev[feature], [plan]: { ...prev[feature][plan], ...patch } },
    }));
  }

  async function save(feature: string) {
    setSavingFeature(feature);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/ai-usage-limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature, limits: limits[feature] }),
      });
      const j = await res.json().catch(() => ({}));
      setMsg({ feature, text: res.ok ? "Saved. Applies to new runs immediately." : (j.error ?? "Could not save."), ok: res.ok });
    } catch {
      setMsg({ feature, text: "Could not save.", ok: false });
    } finally {
      setSavingFeature(null);
    }
  }

  if (loading || features.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
        <Gauge className="h-5 w-5 text-[var(--gold,#B8860B)]" strokeWidth={1.75} aria-hidden /> AI usage limits
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        These tools make a paid AI call each time they run. Cap how many runs each plan gets in a rolling window.
        Viewing a saved result never counts — only a new run does.
      </p>

      {features.map((feature) => {
        const fl = limits[feature];
        if (!fl) return null;
        return (
          <div key={feature} className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="text-sm font-medium text-slate-900">{FEATURE_LABELS[feature] ?? feature}</span>
              <div className="flex items-center gap-3">
                {msg?.feature === feature && (
                  <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span>
                )}
                <button
                  type="button"
                  onClick={() => void save(feature)}
                  disabled={savingFeature === feature}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {savingFeature === feature ? "Saving…" : "Save limits"}
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              <div className="grid grid-cols-[1.2fr_1fr_0.8fr_1fr] gap-3 px-4 py-2 text-[11px] uppercase tracking-wide text-slate-400">
                <span>Plan</span><span>Limit</span><span>Runs</span><span>Per</span>
              </div>
              {LIMIT_PLANS.map((plan) => {
                const lim = fl[plan];
                const capped = lim.maxRuns != null;
                return (
                  <div key={plan} className="grid grid-cols-[1.2fr_1fr_0.8fr_1fr] items-center gap-3 px-4 py-2.5">
                    <span className="text-sm text-slate-700">{PLAN_LABELS[plan]}</span>
                    <select
                      value={capped ? "capped" : "unlimited"}
                      onChange={(e) => update(feature, plan, e.target.value === "capped" ? { maxRuns: lim.maxRuns ?? 1 } : { maxRuns: null })}
                      className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      <option value="capped">Capped</option>
                      <option value="unlimited">Unlimited</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={capped ? lim.maxRuns ?? 0 : ""}
                      disabled={!capped}
                      onChange={(e) => update(feature, plan, { maxRuns: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-300"
                    />
                    <select
                      value={lim.period}
                      disabled={!capped}
                      onChange={(e) => update(feature, plan, { period: e.target.value as UsagePeriod })}
                      className="rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-300"
                    >
                      <option value="week">week</option>
                      <option value="month">month</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
