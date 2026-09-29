"use client";

import { useEffect, useMemo, useState } from "react";
import { STAGES, STAGE_LABELS, GRAINS, GRAIN_LABELS, fmt, type Grain, type StageResult } from "./funnel-types";
import { AiCmo } from "./AiCmo";

/** This-period vs previous, per funnel stage, with % change — grain-selectable. */
export function AttributionPeriods() {
  const [grain, setGrain] = useState<Grain>("month");
  const [agg, setAgg] = useState<StageResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    fetch(`/api/admin/social/goals?grain=${grain}`).then((r) => r.json()).then((d) => { if (live) { setAgg(d.aggregate ?? []); setLoading(false); } }).catch(() => { if (live) { setAgg([]); setLoading(false); } });
    return () => { live = false; };
  }, [grain]);

  const W = 560, H = 190, padL = 40, padB = 30, padT = 18;
  const plotH = H - padB - padT, plotW = W - padL - 12, slot = plotW / STAGES.length;

  const cmoContext = useMemo(() => () => ({ grain, stages: agg.map((s) => ({ stage: s.stage, actual: s.actual, prev: s.prevActual, deltaPct: s.deltaPct })) }), [grain, agg]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] font-semibold text-slate-800">Period comparison</span>
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-[11px]">
          {GRAINS.map((g) => (
            <button key={g} type="button" onClick={() => setGrain(g)} className={`px-2.5 py-1 ${grain === g ? "bg-indigo-600 text-white" : "border-l border-slate-200 text-slate-600 first:border-l-0"}`}>{GRAIN_LABELS[g]}</button>
          ))}
        </div>
        <span className="ml-auto flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-600" />This {grain}</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />Previous</span>
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3.5">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="this period versus previous by stage">
          {[0, 0.5, 1].map((f) => <line key={f} x1={padL} x2={W - 12} y1={padT + plotH * f} y2={padT + plotH * f} stroke="#eef2f7" />)}
          {STAGES.map((k, i) => {
            const s = agg.find((x) => x.stage === k); if (!s) return null;
            const m = Math.max(1, s.actual, s.prevActual);
            const x = padL + slot * i + slot / 2;
            const yc = padT + plotH - (s.actual / m) * plotH;
            const yp = padT + plotH - (s.prevActual / m) * plotH;
            const d = s.deltaPct;
            const dcolor = d === null ? "#94a3b8" : d < 0 ? "#A32D2D" : "#3B6D11";
            const dtxt = d === null ? "" : `${d < 0 ? "−" : "+"}${Math.abs(d)}%`;
            return (
              <g key={k}>
                <rect x={x - 22} y={yp} width={18} height={padT + plotH - yp} rx="2" fill="#cbd5e1" />
                <rect x={x + 2} y={yc} width={18} height={padT + plotH - yc} rx="2" fill="#4338CA" />
                <text x={x} y={Math.min(yc, yp) - 5} fontSize="9" fill={dcolor} textAnchor="middle">{dtxt}</text>
                <text x={x} y={H - 14} fontSize="8.5" fill="#0f172a" textAnchor="middle">{fmt(s.actual)}</text>
                <text x={x} y={H - 3} fontSize="8.5" fill="#94a3b8" textAnchor="middle">{STAGE_LABELS[k].slice(0, 7)}</text>
              </g>
            );
          })}
        </svg>
        <div className="mt-1 text-[10.5px] text-slate-400">{loading ? "Loading…" : "Bars scaled per stage; the % above each pair is the change vs the previous comparable period."}</div>
      </div>

      <AiCmo tab="Attribution" context={cmoContext} />
    </div>
  );
}
