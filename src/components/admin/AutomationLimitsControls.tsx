"use client";

/**
 * Automated outreach limits by plan, on Admin, Feature controls.
 *
 * Same `investor_automation_config` row as Outreach Qualification, saved through
 * the same route, so the two always agree. Four controls per plan: automation on
 * or off, investors reached per 30 days, the most one run may send, and the
 * minimum Capital Readiness Rating before automation starts.
 *
 * Manual outreach is capped separately, under Investor directory limits.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CODE_DEFAULT_PRICING, priceShort, type PricingCatalog } from "@/lib/subscriptions/pricing-catalog";

type PlanKey = "basic" | "professional" | "premium";

type AutomationConfig = {
  monthlyByPlan: Record<PlanKey, number>;
  enabledByPlan: Record<PlanKey, boolean>;
  runCapByPlan: Record<PlanKey, number>;
  minCrrByPlan: Record<PlanKey, number>;
  startDate: string | null;
  cadence: "weekly" | "daily";
  pause: { enabled: boolean; until: string | null };
};

const PLANS: Array<{ key: PlanKey; label: string; planType: "founder_basic" | "founder_professional" | "founder_premium" }> = [
  { key: "basic", label: "Basic", planType: "founder_basic" },
  { key: "professional", label: "Professional", planType: "founder_professional" },
  { key: "premium", label: "Premium", planType: "founder_premium" },
];

const whole = (v: string, max: number) => Math.max(0, Math.min(max, Math.round(Number(v.replace(/,/g, "")) || 0)));

function Switch({ on, label, onChange, disabled }: Readonly<{ on: boolean; label: string; onChange: (v: boolean) => void; disabled?: boolean }>) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-[#1A6CE4]" : "bg-slate-300"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

export function AutomationLimitsControls({ pricing = CODE_DEFAULT_PRICING }: Readonly<{ pricing?: PricingCatalog }>) {
  const [cfg, setCfg] = useState<AutomationConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/investor-outreach")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active && d?.automation) setCfg(d.automation as AutomationConfig); })
      .catch(() => { if (active) setMsg({ text: "Couldn't load the current limits.", ok: false }); });
    return () => { active = false; };
  }, []);

  const save = useCallback(async (next: AutomationConfig) => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/investor-outreach", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_automation_config", config: next }),
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      if (d?.automation) setCfg(d.automation as AutomationConfig);
      setMsg({ text: "Saved. Applies to the next run.", ok: true });
    } catch {
      setMsg({ text: "Couldn't save. Please try again.", ok: false });
    } finally {
      setSaving(false);
    }
  }, []);

  const patch = (plan: PlanKey, field: "monthlyByPlan" | "runCapByPlan" | "minCrrByPlan", value: number) => {
    if (!cfg) return;
    setMsg(null);
    setCfg({ ...cfg, [field]: { ...cfg[field], [plan]: value } });
  };

  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Automated outreach limits by plan</h2>
      <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
        What automation does on its own for each plan: how many investors it reaches per 30 day period, the most it
        sends in one run, and the Capital Readiness Rating a founder must clear before it starts. Manual outreach is
        capped separately under{" "}
        <Link href="/admin/investor-directory/access" className="font-medium text-indigo-600 hover:text-indigo-700">Investor directory limits</Link>.
      </p>

      {!cfg ? (
        <p className="mt-4 text-xs text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2">Plan</th>
                    <th className="px-2 py-2 text-center">Automation</th>
                    <th className="px-2 py-2 text-right">Investors / 30 days</th>
                    <th className="px-2 py-2 text-right">Sends / run</th>
                    <th className="px-4 py-2 text-right">Min CRR</th>
                  </tr>
                </thead>
                <tbody>
                  {PLANS.map((p) => {
                    const on = cfg.enabledByPlan[p.key];
                    return (
                      <tr key={p.key} className="border-b border-slate-50 last:border-b-0">
                        <td className="px-4 py-2 font-medium text-slate-800">
                          {p.label}
                          <span className="ml-2 text-[10px] font-normal text-slate-400">{priceShort(pricing, p.planType)}</span>
                        </td>
                        <td className="px-2 py-2">
                          <span className="flex justify-center">
                            <Switch on={on} label={`Automation for ${p.label}`} disabled={saving}
                              onChange={(v) => setCfg({ ...cfg, enabledByPlan: { ...cfg.enabledByPlan, [p.key]: v } })} />
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input type="text" inputMode="numeric" value={cfg.monthlyByPlan[p.key]} disabled={!on}
                            aria-label={`${p.label} investors per 30 days`}
                            onChange={(e) => patch(p.key, "monthlyByPlan", whole(e.target.value, 100000))}
                            className="h-8 w-24 rounded-md border border-slate-300 px-2 text-right disabled:bg-slate-50 disabled:text-slate-400" />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input type="text" inputMode="numeric" value={cfg.runCapByPlan[p.key]} disabled={!on}
                            aria-label={`${p.label} sends per run`}
                            onChange={(e) => patch(p.key, "runCapByPlan", whole(e.target.value, 100000))}
                            className="h-8 w-20 rounded-md border border-slate-300 px-2 text-right disabled:bg-slate-50 disabled:text-slate-400" />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input type="text" inputMode="numeric" value={cfg.minCrrByPlan[p.key]} disabled={!on}
                            aria-label={`${p.label} minimum CRR`}
                            onChange={(e) => patch(p.key, "minCrrByPlan", whole(e.target.value, 100))}
                            className="h-8 w-20 rounded-md border border-slate-300 px-2 text-right disabled:bg-slate-50 disabled:text-slate-400" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
              <span className="max-w-xl text-[12px] leading-5 text-slate-500">
                <span className="font-medium text-slate-600">Sends / run</span> and{" "}
                <span className="font-medium text-slate-600">Min CRR</span> are off at 0: the campaign&rsquo;s own cap
                decides the batch, and only the global matching threshold gates readiness. The 30 day period runs from
                each founder&rsquo;s signup date, not the calendar month. Investors already in outreach are unaffected.
              </span>
              <span className="flex items-center gap-3">
                {msg ? <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span> : null}
                <button type="button" onClick={() => void save(cfg)} disabled={saving}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                  {saving ? "Saving…" : "Save limits"}
                </button>
              </span>
            </div>
          </div>

          <p className="mt-2 text-[11px] leading-5 text-slate-400">
            The master switch above turns automation off everywhere, whatever these rows say. The SPV Program is
            uncapped and is not listed here.
          </p>
        </>
      )}
    </section>
  );
}
