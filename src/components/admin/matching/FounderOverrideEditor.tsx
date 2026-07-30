"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Per-founder override editor. Loads the founder's raw override + resolved
 * effective config, lets an admin customize three sections (automation, match
 * rules, message) with an Inherited/Custom toggle each, and saves a sparse
 * override — anything left Inherited falls through to the global defaults.
 */

type ReqFields = { industry: boolean; checkSize: boolean; revenueStage: boolean; useOfFunds: boolean; geography: boolean; activeRating: boolean; investorType: boolean; capitalType: boolean };

type Ov = {
  match?: { requiredFields?: ReqFields; minMatch?: number; minInvestorScore?: number; requireRated?: boolean };
  automation?: { capOverride?: number | null; startDate?: string | null; pause?: { enabled: boolean; until: string | null } };
  message?: { subject?: string; intro?: string; closing?: string };
};

type Eff = {
  match: { requiredFields: ReqFields; minMatch: number; minInvestorScore: number; requireRated: boolean };
  message: { subject: string; intro: string; closing: string };
  monthlyCap: number;
  startDate: string | null;
  pause: { enabled: boolean; until: string | null };
  planType: string | null;
};

const REQ_LABELS: [keyof ReqFields, string][] = [
  ["checkSize", "Check size vs. raise"],
  ["revenueStage", "Revenue stage"],
  ["useOfFunds", "Use of funds"],
  ["geography", "Geography"],
  ["activeRating", "Active investor rating"],
  ["investorType", "Type of investor(s)"],
  ["capitalType", "Type(s) of capital"],
];

function Badge({ custom }: { custom: boolean }) {
  return (
    <span className={`rounded px-2 py-0.5 text-[9px] font-semibold ${custom ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
      {custom ? "Custom" : "Inherited"}
    </span>
  );
}

export function FounderOverrideEditor({ companyId, companyName, onClose, onSaved }: { companyId: string; companyName: string; onClose: () => void; onSaved?: () => void }) {
  const [ov, setOv] = useState<Ov>({});
  const [eff, setEff] = useState<Eff | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/outreach-override?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d) return;
        setOv((d.override as Ov) ?? {});
        setEff(d.effective as Eff);
      })
      .catch(() => setError("Couldn't load settings."))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [companyId]);

  const save = useCallback(async (next: Ov) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/outreach-override", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, override: next }),
      });
      const d = res.ok ? await res.json() : null;
      if (!d?.ok) setError("Couldn't save. Please try again.");
      else { setOv((d.override as Ov) ?? {}); setEff(d.effective as Eff); onSaved?.(); }
    } catch {
      setError("Network error saving override.");
    } finally {
      setSaving(false);
    }
  }, [companyId, onSaved]);

  if (loading || !eff) {
    return <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-500">Loading settings…</div>;
  }

  const customAuto = !!ov.automation;
  const customMatch = !!ov.match;
  const customMsg = !!ov.message;

  const toggleAuto = (on: boolean) =>
    setOv((p) => ({ ...p, automation: on ? { startDate: eff.startDate, pause: eff.pause } : undefined }));
  const toggleMatch = (on: boolean) =>
    setOv((p) => ({ ...p, match: on ? { requiredFields: { ...eff.match.requiredFields }, minMatch: eff.match.minMatch, minInvestorScore: eff.match.minInvestorScore, requireRated: eff.match.requireRated } : undefined }));
  const toggleMsg = (on: boolean) =>
    setOv((p) => ({ ...p, message: on ? { ...eff.message } : undefined }));

  const capValue = ov.automation?.capOverride ?? eff.monthlyCap;
  const capOverridden = typeof ov.automation?.capOverride === "number";

  return (
    <div className="mt-3 rounded-xl border-2 border-indigo-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">Override for {companyName}</div>
        <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-800">Close</button>
      </div>
      <p className="mt-0.5 text-[11px] text-slate-500">Sections left Inherited use the global defaults{eff.planType ? ` · plan ${eff.planType.replace("founder_", "")}` : ""}. Customizing one affects only {companyName}.</p>

      {/* Automation & caps */}
      <div className="mt-3 rounded-lg border border-slate-200 p-3">
        <label className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-500">Automation &amp; caps <Badge custom={customAuto} /></span>
          <input type="checkbox" checked={customAuto} onChange={(e) => toggleAuto(e.target.checked)} className="h-4 w-4" />
        </label>
        {customAuto && ov.automation && (
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <div className="text-[12px] text-slate-600">Monthly cap
              <div className="mt-1 flex items-center gap-2">
                <input type="checkbox" checked={capOverridden}
                  onChange={(e) => setOv((p) => ({ ...p, automation: { ...p.automation, capOverride: e.target.checked ? eff.monthlyCap : null } }))}
                  className="h-4 w-4" />
                <input type="number" min={0} max={100000} value={capValue} disabled={!capOverridden}
                  onChange={(e) => setOv((p) => ({ ...p, automation: { ...p.automation, capOverride: Number(e.target.value) } }))}
                  className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm disabled:bg-slate-50 disabled:text-slate-400" />
              </div>
              <span className="text-[10px] text-slate-400">{capOverridden ? `override · plan ${eff.monthlyCap}` : `from plan (${eff.monthlyCap})`}</span>
            </div>
            <label className="text-[12px] text-slate-600">Start date
              <input type="date" value={ov.automation.startDate ?? ""}
                onChange={(e) => setOv((p) => ({ ...p, automation: { ...p.automation, startDate: e.target.value || null } }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
            <div className="text-[12px] text-slate-600">Pause
              <label className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5">
                <input type="checkbox" checked={ov.automation.pause?.enabled ?? false}
                  onChange={(e) => setOv((p) => ({ ...p, automation: { ...p.automation, pause: { enabled: e.target.checked, until: p.automation?.pause?.until ?? null } } }))}
                  className="h-4 w-4" />
                <span className="text-[10px] text-amber-700">until</span>
                <input type="date" value={ov.automation.pause?.until ?? ""}
                  onChange={(e) => setOv((p) => ({ ...p, automation: { ...p.automation, pause: { enabled: p.automation?.pause?.enabled ?? false, until: e.target.value || null } } }))}
                  className="w-full rounded-lg border border-slate-300 px-1 py-1 text-[11px]" />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Required match fields + thresholds */}
      <div className="mt-3 rounded-lg border border-slate-200 p-3">
        <label className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-500">Match rules <Badge custom={customMatch} /></span>
          <input type="checkbox" checked={customMatch} onChange={(e) => toggleMatch(e.target.checked)} className="h-4 w-4" />
        </label>
        {customMatch && ov.match && (
          <>
            <div className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] text-slate-500">
                <span>Industry / sector</span><span className="text-[10px] font-semibold text-indigo-700">Required · locked</span>
              </div>
              {REQ_LABELS.map(([key, label]) => {
                const on = ov.match?.requiredFields?.[key] ?? false;
                return (
                  <button key={key} type="button"
                    onClick={() => setOv((p) => ({ ...p, match: { ...p.match, requiredFields: { ...(p.match?.requiredFields ?? eff.match.requiredFields), industry: true, [key]: !on } } }))}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-1.5 text-left text-[12px] text-slate-700">
                    <span>{label}</span>
                    <span className={`text-[10px] font-semibold ${on ? "text-indigo-700" : "text-slate-400"}`}>{on ? "Required" : "Optional"}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-[12px] text-slate-600">Minimum match score
                <input type="number" min={0} max={100} value={ov.match.minMatch ?? eff.match.minMatch}
                  onChange={(e) => setOv((p) => ({ ...p, match: { ...p.match, minMatch: Number(e.target.value) } }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
              </label>
              <label className="text-[12px] text-slate-600">Minimum investor score
                <input type="number" min={0} max={100} value={ov.match.minInvestorScore ?? eff.match.minInvestorScore}
                  onChange={(e) => setOv((p) => ({ ...p, match: { ...p.match, minInvestorScore: Number(e.target.value) } }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
              </label>
            </div>
          </>
        )}
      </div>

      {/* Investor message (bottom) */}
      <div className="mt-3 rounded-lg border border-slate-200 p-3">
        <label className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-500">Investor message <Badge custom={customMsg} /></span>
          <input type="checkbox" checked={customMsg} onChange={(e) => toggleMsg(e.target.checked)} className="h-4 w-4" />
        </label>
        {customMsg && ov.message && (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              {["{{investor}}", "{{company}}", "{{sector}}", "{{stage}}"].map((t) => (
                <span key={t} className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-indigo-700">{t}</span>
              ))}
            </div>
            <label className="block text-[11px] text-slate-600">Subject
              <input value={ov.message.subject ?? ""} onChange={(e) => setOv((p) => ({ ...p, message: { ...p.message, subject: e.target.value } }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-[13px]" />
            </label>
            <label className="block text-[11px] text-slate-600">Intro
              <textarea value={ov.message.intro ?? ""} onChange={(e) => setOv((p) => ({ ...p, message: { ...p.message, intro: e.target.value } }))}
                className="mt-1 min-h-[56px] w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-[13px]" />
            </label>
            <label className="block text-[11px] text-slate-600">Closing
              <textarea value={ov.message.closing ?? ""} onChange={(e) => setOv((p) => ({ ...p, message: { ...p.message, closing: e.target.value } }))}
                className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-[13px]" />
            </label>
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[10.5px] text-slate-500">
              <span className="font-semibold">Locked</span> — the Founder one-pager card and compliance footer (disclaimer + unsubscribe) are always appended.
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
        <button onClick={() => save({})} disabled={saving} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12px] text-slate-600 hover:bg-slate-50 disabled:opacity-60">Reset to global defaults</button>
        {error && <span className="text-[11px] text-red-600">{error}</span>}
        <span className="ml-auto" />
        <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-[12px] text-slate-500">Cancel</button>
        <button onClick={() => save(ov)} disabled={saving} className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-60">{saving ? "Saving…" : `Save for ${companyName.split(/\s+/)[0]}`}</button>
      </div>
    </div>
  );
}
