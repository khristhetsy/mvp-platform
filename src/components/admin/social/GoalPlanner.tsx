"use client";

import { useState } from "react";
import { STAGES, STAGE_LABELS, STAGE_COLORS, type Grain, type StageKey, type StageResult } from "./funnel-types";

/**
 * Set per-stage goals for a campaign at a grain (the current period). Seeds inputs from
 * the campaign's current actuals ("auto-suggest") so the user can adjust from a real
 * baseline. Persists via POST /api/admin/social/goals.
 */
export function GoalPlanner({ campaignId, grain, stages, onSaved, onCancel }: {
  campaignId: string; grain: Grain; stages: StageResult[]; onSaved?: () => void; onCancel?: () => void;
}) {
  const seed = (k: StageKey): string => {
    const s = stages.find((x) => x.stage === k);
    if (s?.target != null) return String(s.target);
    // Auto-suggest: round current actual up ~15% as a stretch baseline.
    return s && s.actual > 0 ? String(Math.ceil((s.actual * 1.15) / 10) * 10) : "";
  };
  const [vals, setVals] = useState<Record<StageKey, string>>(() =>
    Object.fromEntries(STAGES.map((k) => [k, seed(k)])) as Record<StageKey, string>);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true); setMsg(null);
    const goals: Record<string, number | null> = {};
    for (const k of STAGES) { const n = vals[k].trim(); goals[k] = n === "" ? null : Math.max(0, Math.round(Number(n))); }
    try {
      const res = await fetch("/api/admin/social/goals", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignId, grain, goals }),
      });
      if (!res.ok) { setMsg("Could not save goals."); setBusy(false); return; }
      setMsg("Goals saved.");
      onSaved?.();
    } catch { setMsg("Could not save goals."); }
    setBusy(false);
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5">
      <div className="mb-1 text-[12.5px] font-semibold text-slate-800">Plan goals for this {grain}</div>
      <div className="mb-3 text-[11px] text-slate-500">Seeded from current pace — adjust any stage, leave blank to skip it.</div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {STAGES.map((k) => (
          <label key={k} className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-slate-500">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: STAGE_COLORS[k] }} />{STAGE_LABELS[k]}
            </span>
            <input inputMode="numeric" value={vals[k]} onChange={(e) => setVals((p) => ({ ...p, [k]: e.target.value.replace(/[^0-9]/g, "") }))}
              placeholder="—" className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-indigo-300" />
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" disabled={busy} onClick={() => void save()} className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{busy ? "Saving…" : "Save goals"}</button>
        {onCancel ? <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] text-slate-600">Cancel</button> : null}
        {msg ? <span className="text-[11.5px] text-slate-500">{msg}</span> : null}
      </div>
    </div>
  );
}
