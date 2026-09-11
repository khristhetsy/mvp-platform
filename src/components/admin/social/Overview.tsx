"use client";

import { useEffect, useMemo, useState } from "react";
import {
  STAGES, STAGE_LABELS, STAGE_COLORS, GRAINS, GRAIN_LABELS, fmt,
  type Grain, type StageResult, type CampaignFunnel,
} from "./funnel-types";
import { AiCmo } from "./AiCmo";

const C = 2 * Math.PI * 32; // ring circumference (r=32)

function Ring({ s }: { s: StageResult }) {
  const p = Math.min(100, s.pctOfGoal ?? 0);
  const off = C * (1 - p / 100);
  const color = STAGE_COLORS[s.stage];
  return (
    <div className="w-[92px] flex-none text-center">
      <svg viewBox="0 0 80 80" className="mx-auto h-[74px] w-[74px]" role="img" aria-label={`${STAGE_LABELS[s.stage]} ${s.pctOfGoal ?? 0}% of goal`}>
        <circle cx="40" cy="40" r="32" fill="none" stroke="#eef2f7" strokeWidth="7" />
        <circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 40 40)" />
        <text x="40" y="37" fontSize={s.actual >= 1000 ? "14" : "16"} fontWeight="700" fill="#0f172a" textAnchor="middle">{fmt(s.actual)}</text>
        <text x="40" y="51" fontSize="9" fill="#94a3b8" textAnchor="middle">{s.pctOfGoal === null ? "no goal" : `${s.pctOfGoal}%`}</text>
      </svg>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">{STAGE_LABELS[s.stage]}</div>
      <div className="text-[10px] text-slate-500">{s.target != null ? `of ${fmt(s.target)}` : "—"}</div>
    </div>
  );
}

function step(next: StageResult | undefined): string {
  if (!next || next.stepFromPrevRatio === null) return "";
  return next.stage === "impressions" ? `${Math.round(next.stepFromPrevRatio)}/post` : `${(next.stepFromPrevRatio * 100).toFixed(1)}%`;
}

export function Overview({ failedCount, topPostBody, onNavigate }: {
  failedCount: number; topPostBody: string | null; onNavigate: (tab: string) => void;
}) {
  const [grain, setGrain] = useState<Grain>("month");
  const [aggregate, setAggregate] = useState<StageResult[]>([]);
  const [funnels, setFunnels] = useState<CampaignFunnel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    fetch(`/api/admin/social/goals?grain=${grain}`).then((r) => r.json()).then((d) => {
      if (!live) return; setAggregate(d.aggregate ?? []); setFunnels(d.funnels ?? []); setLoading(false);
    }).catch(() => { if (live) { setAggregate([]); setFunnels([]); setLoading(false); } });
    return () => { live = false; };
  }, [grain]);

  const withGoal = aggregate.filter((s) => s.pctOfGoal !== null);
  const blended = withGoal.length ? Math.round(withGoal.reduce((a, s) => a + (s.pctOfGoal ?? 0), 0) / withGoal.length) : null;
  const revenueCents = funnels.reduce((a, f) => a + f.revenueCents, 0);
  const members = funnels.reduce((a, f) => a + f.members, 0);

  // Weakest step: smallest step ratio among clicks/meetings/conversions.
  const weakest = useMemo(() => {
    let worst: { label: string; val: number } | null = null;
    for (let i = 1; i < STAGES.length; i++) {
      const s = aggregate.find((x) => x.stage === STAGES[i]);
      if (!s || s.stepFromPrevRatio === null || s.stage === "impressions") continue;
      if (!worst || s.stepFromPrevRatio < worst.val) worst = { label: `${STAGE_LABELS[STAGES[i - 1]]} → ${STAGE_LABELS[STAGES[i]]}`, val: s.stepFromPrevRatio };
    }
    return worst;
  }, [aggregate]);

  const movers = useMemo(() =>
    [...funnels].map((f) => ({ f, conv: f.stages.find((s) => s.stage === "conversions") }))
      .sort((a, b) => (b.conv?.actual ?? 0) - (a.conv?.actual ?? 0)).slice(0, 4), [funnels]);

  const cmoContext = useMemo(() => () => ({ grain, blended, stages: aggregate.map((s) => ({ stage: s.stage, actual: s.actual, target: s.target, pctOfGoal: s.pctOfGoal, deltaPct: s.deltaPct })) }), [grain, blended, aggregate]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[15px] font-semibold text-slate-900">Command Center</span>
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-[11px]">
          {GRAINS.map((g) => (
            <button key={g} type="button" onClick={() => setGrain(g)} className={`px-2.5 py-1 ${grain === g ? "bg-indigo-600 text-white" : "border-l border-slate-200 text-slate-600 first:border-l-0"}`}>{GRAIN_LABELS[g]}</button>
          ))}
        </div>
        {blended !== null ? (
          <span className="ml-auto rounded-full bg-blue-50 px-3 py-1 text-[11px] text-blue-700">{blended}% of goal blended</span>
        ) : null}
      </div>

      {/* Ring funnel */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-0">
          {STAGES.map((k, i) => {
            const s = aggregate.find((x) => x.stage === k);
            const next = aggregate.find((x) => x.stage === STAGES[i + 1]);
            return (
              <div key={k} className="flex items-center">
                {s ? <Ring s={s} /> : <div className="w-[92px]" />}
                {i < STAGES.length - 1 ? (
                  <div className="flex-none px-1 text-center text-slate-400">
                    <div className="text-[10px]">{step(next)}</div>
                    <div className="text-[13px] leading-none">›</div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
          {weakest ? <>Weakest step → <b className="text-rose-600">{weakest.label} ({(weakest.val * 100).toFixed(1)}%)</b>. </> : null}
          Revenue this period: <b className="text-slate-800">${(revenueCents / 100).toLocaleString()}/mo</b> from {members} members.
          {loading ? <span className="ml-2 text-slate-400">Loading…</span> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <div className="mb-2 text-[12px] font-semibold text-slate-800">Top movers <span className="font-normal text-slate-400">· by conversions</span></div>
          {movers.length ? movers.map(({ f, conv }) => {
            const d = conv?.deltaPct ?? null;
            return (
              <div key={f.campaignId} className="flex items-center gap-2 py-1 text-[11.5px]">
                <span className="h-2 w-2 rounded-sm bg-indigo-500" />
                <span className="min-w-0 flex-1 truncate text-slate-700">{f.name}</span>
                <span className={d !== null && d < 0 ? "text-rose-600" : "text-emerald-600"}>{conv?.actual ?? 0} conv · ${(f.revenueCents / 100).toLocaleString()}</span>
              </div>
            );
          }) : <div className="py-1 text-[11.5px] text-slate-400">No campaign data yet.</div>}
          <button type="button" onClick={() => onNavigate("goals")} className="mt-1.5 text-[10.5px] text-indigo-600 hover:underline">View all campaigns →</button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <div className="mb-2 text-[12px] font-semibold text-slate-800">Next best actions</div>
          {topPostBody ? (
            <div className="flex items-start gap-2 py-1 text-[11.5px]"><span className="text-emerald-600">★</span><span className="text-slate-700"><b className="font-medium">Reuse your top post</b> — “{topPostBody.slice(0, 44)}…”. <button type="button" onClick={() => onNavigate("library")} className="text-indigo-600 hover:underline">Duplicate →</button></span></div>
          ) : null}
          {failedCount > 0 ? (
            <div className="flex items-start gap-2 py-1 text-[11.5px]"><span className="text-rose-600">!</span><span className="text-slate-700"><b className="font-medium">{failedCount} post{failedCount > 1 ? "s" : ""} failed</b> — needs review. <button type="button" onClick={() => onNavigate("schedule")} className="text-indigo-600 hover:underline">Review →</button></span></div>
          ) : null}
          {weakest ? (
            <div className="flex items-start gap-2 py-1 text-[11.5px]"><span className="text-amber-600">◔</span><span className="text-slate-700"><b className="font-medium">{weakest.label} is your weakest step</b>. Try a new angle. <button type="button" onClick={() => onNavigate("compose")} className="text-indigo-600 hover:underline">Compose →</button></span></div>
          ) : null}
          {!topPostBody && failedCount === 0 && !weakest ? <div className="py-1 text-[11.5px] text-slate-400">Nothing urgent — set goals to get tailored actions.</div> : null}
        </div>
      </div>

      <AiCmo tab="Overview" context={cmoContext} actions={[{ label: "Open Campaigns & Goals", onClick: () => onNavigate("goals") }]} />
    </div>
  );
}
