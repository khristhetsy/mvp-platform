"use client";

import { useEffect, useMemo, useState } from "react";
import {
  STAGES, STAGE_LABELS, STAGE_COLORS, GRAINS, GRAIN_LABELS, fmt,
  type Grain, type StageKey, type StageResult, type CampaignFunnel,
} from "./funnel-types";
import { GoalPlanner } from "./GoalPlanner";
import { AiCmo } from "./AiCmo";

type ChartType = "bar" | "line" | "area";

function pct(n: number | null): string { return n === null ? "—" : `${n}%`; }
function delta(n: number | null): { txt: string; cls: string } {
  if (n === null) return { txt: "—", cls: "text-slate-400" };
  if (n > 0) return { txt: `▲ ${n}%`, cls: "text-emerald-600" };
  if (n < 0) return { txt: `▼ ${Math.abs(n)}%`, cls: "text-rose-600" };
  return { txt: "0%", cls: "text-slate-400" };
}
function stepLabel(s: StageResult): string {
  if (s.stepFromPrevRatio === null) return "—";
  // impressions/post is a multiplier; the rest read as a percentage.
  return s.stage === "impressions" ? `${Math.round(s.stepFromPrevRatio)}/post` : `${(s.stepFromPrevRatio * 100).toFixed(1)}%`;
}

/** Aggregate the per-campaign contributions to one stage. */
function contributions(funnels: CampaignFunnel[], stage: StageKey) {
  return funnels
    .map((f) => ({ id: f.campaignId, name: f.name, s: f.stages.find((x) => x.stage === stage)! }))
    .filter((r) => r.s && (r.s.actual > 0 || r.s.target))
    .sort((a, b) => b.s.actual - a.s.actual);
}

export function CampaignsGoals({ focus }: { focus?: { campaignId?: string; stage?: string } | null }) {
  const [grain, setGrain] = useState<Grain>("month");
  const [funnels, setFunnels] = useState<CampaignFunnel[]>([]);
  const [aggregate, setAggregate] = useState<StageResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<StageKey | null>(null);
  const [selected, setSelected] = useState<StageKey | "all">("all");
  const [chart, setChart] = useState<ChartType>("bar");
  const [mode, setMode] = useState<"value" | "pct">("pct");
  const [planning, setPlanning] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [creatingBusy, setCreatingBusy] = useState(false);

  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [rowBusy, setRowBusy] = useState(false);

  async function createCampaign() {
    const name = newName.trim();
    if (!name) return;
    setCreatingBusy(true);
    try {
      const res = await fetch("/api/admin/social/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, budgetCents: 0 }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.campaign?.id) { setNewName(""); setCreating(false); await load(); setPlanning(d.campaign.id); }
    } finally { setCreatingBusy(false); }
  }

  async function renameCampaign(id: string) {
    const name = renameVal.trim(); if (!name) { setRenaming(null); return; }
    setRowBusy(true);
    try { await fetch("/api/admin/social/campaigns", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, name }) }); setRenaming(null); await load(); }
    finally { setRowBusy(false); }
  }
  async function archiveCampaign(id: string, name: string) {
    if (!confirm(`Archive "${name}"? It's hidden from the Hub but keeps its posts, goals and history. You can unarchive later.`)) return;
    setRowBusy(true);
    try { await fetch("/api/admin/social/campaigns", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, archived: true }) }); await load(); }
    finally { setRowBusy(false); }
  }
  async function deleteCampaignAction(id: string, name: string) {
    if (!confirm(`Delete "${name}" permanently? Its posts stay but lose their campaign link and attribution grouping. Consider Archive instead.`)) return;
    setRowBusy(true);
    try { await fetch("/api/admin/social/campaigns", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }); await load(); }
    finally { setRowBusy(false); }
  }

  async function load() {
    try {
      const res = await fetch(`/api/admin/social/goals?grain=${grain}`);
      const d = await res.json().catch(() => ({}));
      setFunnels(d.funnels ?? []); setAggregate(d.aggregate ?? []);
    } catch { setFunnels([]); setAggregate([]); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let live = true;
    fetch(`/api/admin/social/goals?grain=${grain}`).then((r) => r.json().catch(() => ({}))).then((d) => {
      if (!live) return; setFunnels(d.funnels ?? []); setAggregate(d.aggregate ?? []); setLoading(false);
    }).catch(() => { if (live) { setFunnels([]); setAggregate([]); setLoading(false); } });
    return () => { live = false; };
  }, [grain]);

  // Arriving from a Top-movers click: expand that stage's per-campaign drill-down and highlight it in the graph.
  useEffect(() => {
    if (!focus?.stage) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpanded(focus.stage as StageKey);
    setSelected(focus.stage as StageKey);
  }, [focus]);

  const cmoContext = useMemo(() => () => ({ grain, stages: aggregate.map((s) => ({ stage: s.stage, actual: s.actual, target: s.target, pctOfGoal: s.pctOfGoal, deltaPct: s.deltaPct })) }), [grain, aggregate]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] font-semibold text-slate-800">Goals for</span>
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-[12px]">
          {GRAINS.map((g) => (
            <button key={g} type="button" onClick={() => setGrain(g)} className={`px-3 py-1.5 ${grain === g ? "bg-indigo-600 text-white" : "border-l border-slate-200 text-slate-600 first:border-l-0"}`}>{GRAIN_LABELS[g]}</button>
          ))}
        </div>
        {loading ? <span className="text-[12px] text-slate-400">Loading…</span> : null}
        <div className="ml-auto">
          {creating ? (
            <div className="flex items-center gap-1.5">
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void createCampaign(); if (e.key === "Escape") { setCreating(false); setNewName(""); } }}
                placeholder="Campaign name" className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] outline-none focus:border-indigo-300" />
              <button type="button" disabled={creatingBusy || !newName.trim()} onClick={() => void createCampaign()} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50">{creatingBusy ? "Creating…" : "Create"}</button>
              <button type="button" onClick={() => { setCreating(false); setNewName(""); }} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] text-slate-600">Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => setCreating(true)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-indigo-700">＋ New campaign</button>
          )}
        </div>
      </div>

      {/* Aggregate funnel table with per-stage drill-down */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2 font-semibold">Stage</th>
              <th className="px-3 py-2 font-semibold">Actual / Goal</th>
              <th className="px-3 py-2 font-semibold">% of goal</th>
              <th className="px-3 py-2 font-semibold">Step rate</th>
              <th className="px-4 py-2 font-semibold">vs prev</th>
            </tr>
          </thead>
          <tbody>
            {STAGES.map((k) => {
              const s = aggregate.find((x) => x.stage === k);
              if (!s) return null;
              const d = delta(s.deltaPct);
              const open = expanded === k;
              return (
                <>
                  <tr key={k} className={`cursor-pointer border-t border-slate-100 ${open ? "bg-indigo-50/50" : "hover:bg-slate-50"}`} onClick={() => setExpanded(open ? null : k)}>
                    <td className="px-4 py-2.5">
                      <span className="mr-1 text-slate-400">{open ? "▾" : "▸"}</span>
                      <span className="inline-block h-2 w-2 rounded-sm align-middle" style={{ background: STAGE_COLORS[k] }} /> <span className="align-middle">{STAGE_LABELS[k]}</span>
                      {s.estimated ? <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">est.</span> : null}
                    </td>
                    <td className="px-3 py-2.5">{fmt(s.actual)} / {s.target != null ? fmt(s.target) : "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-1.5 w-16 rounded bg-slate-100"><span className="block h-full rounded" style={{ width: `${Math.min(100, s.pctOfGoal ?? 0)}%`, background: STAGE_COLORS[k] }} /></span>
                        <b className="font-semibold">{pct(s.pctOfGoal)}</b>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">{stepLabel(s)}</td>
                    <td className={`px-4 py-2.5 ${d.cls}`}>{d.txt}</td>
                  </tr>
                  {open ? (
                    <tr className="bg-slate-50/70">
                      <td colSpan={5} className="px-4 py-2">
                        <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">{STAGE_LABELS[k]} by campaign</div>
                        {contributions(funnels, k).length ? contributions(funnels, k).map((r) => {
                          const hit = focus?.campaignId === r.id && focus?.stage === k;
                          return (
                            <div key={r.id} className={`flex items-center gap-3 rounded-md px-1 py-1 text-[11.5px] ${hit ? "bg-indigo-100/70 ring-1 ring-indigo-200" : ""}`}>
                              <span className="min-w-0 flex-1 truncate text-slate-700">{r.name}</span>
                              <span className="text-slate-600">{fmt(r.s.actual)}{r.s.target != null ? ` / ${fmt(r.s.target)}` : ""}</span>
                              <span className="w-10 text-right font-medium text-slate-500">{pct(r.s.pctOfGoal)}</span>
                            </div>
                          );
                        }) : <div className="py-1 text-[11.5px] text-slate-400">No campaign data this period.</div>}
                      </td>
                    </tr>
                  ) : null}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Graph: chart type + value/% toggle + selectable stage outline */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] font-semibold text-slate-800">Funnel graph</span>
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-[11px]">
            {(["bar", "line", "area"] as ChartType[]).map((c) => (
              <button key={c} type="button" onClick={() => setChart(c)} className={`px-2.5 py-1 capitalize ${chart === c ? "bg-indigo-600 text-white" : "border-l border-slate-200 text-slate-600 first:border-l-0"}`}>{c}</button>
            ))}
          </div>
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-[11px]">
            <button type="button" onClick={() => setMode("value")} className={`px-2.5 py-1 ${mode === "value" ? "bg-slate-600 text-white" : "text-slate-600"}`}>Value</button>
            <button type="button" onClick={() => setMode("pct")} className={`border-l border-slate-200 px-2.5 py-1 ${mode === "pct" ? "bg-slate-600 text-white" : "text-slate-600"}`}>% of goal</button>
          </div>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setSelected("all")} className={`rounded-full px-2.5 py-0.5 text-[10.5px] ${selected === "all" ? "border border-slate-400 text-slate-700" : "border border-dashed border-slate-300 text-slate-500"}`}>All</button>
            {STAGES.map((k) => (
              <button key={k} type="button" onClick={() => setSelected(k)} className="rounded-full px-2.5 py-0.5 text-[10.5px] font-medium text-white"
                style={{ background: STAGE_COLORS[k], opacity: selected === "all" || selected === k ? 1 : 0.4, boxShadow: selected === k ? `0 0 0 2px #fff, 0 0 0 3.5px ${STAGE_COLORS[k]}` : "none" }}>
                {STAGE_LABELS[k]}
              </button>
            ))}
          </div>
        </div>
        <FunnelGraph stages={aggregate} chart={chart} mode={mode} selected={selected} />
        <div className="mt-1.5 text-[10.5px] text-slate-400">Each stage shows current vs previous period. Select a stage to outline it; the goal line marks 100%.</div>
      </div>

      {/* Per-campaign goal planning */}
      <div className="space-y-2">
        {funnels.map((f) => (
          <div key={f.campaignId} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              {renaming === f.campaignId ? (
                <span className="flex items-center gap-1.5">
                  <input autoFocus value={renameVal} onChange={(e) => setRenameVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void renameCampaign(f.campaignId); if (e.key === "Escape") setRenaming(null); }}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-[13px] outline-none focus:border-indigo-300" />
                  <button type="button" disabled={rowBusy} onClick={() => void renameCampaign(f.campaignId)} className="rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white disabled:opacity-50">Save</button>
                  <button type="button" onClick={() => setRenaming(null)} className="text-[11px] text-slate-500">Cancel</button>
                </span>
              ) : (
                <span className="text-[13px] font-semibold text-slate-800">{f.name}</span>
              )}
              <span className="text-[11px] text-slate-500">{f.members} members · ${(f.revenueCents / 100).toLocaleString()}/mo</span>
              <span className="ml-auto flex items-center gap-1.5">
                <button type="button" onClick={() => setPlanning(planning === f.campaignId ? null : f.campaignId)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[11.5px] font-medium text-indigo-600 hover:bg-indigo-50">
                  {planning === f.campaignId ? "Close" : "Adjust goals"}
                </button>
                <button type="button" disabled={rowBusy} onClick={() => { setRenaming(f.campaignId); setRenameVal(f.name); }} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11.5px] text-slate-600 hover:bg-slate-50">Rename</button>
                <button type="button" disabled={rowBusy} onClick={() => void archiveCampaign(f.campaignId, f.name)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11.5px] text-slate-600 hover:bg-slate-50">Archive</button>
                <button type="button" disabled={rowBusy} onClick={() => void deleteCampaignAction(f.campaignId, f.name)} className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-[11.5px] text-rose-600 hover:bg-rose-50">Delete</button>
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {f.stages.map((s) => (
                <span key={s.stage} className="rounded-md bg-slate-50 px-2 py-1 text-[10.5px] text-slate-600">
                  {STAGE_LABELS[s.stage]} <b className="font-semibold text-slate-800">{pct(s.pctOfGoal)}</b>
                </span>
              ))}
            </div>
            {planning === f.campaignId ? (
              <div className="mt-3"><GoalPlanner campaignId={f.campaignId} grain={grain} stages={f.stages} onSaved={() => { setPlanning(null); void load(); }} onCancel={() => setPlanning(null)} /></div>
            ) : null}
          </div>
        ))}
        {!loading && !funnels.length ? <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-[12.5px] text-slate-400">No campaigns yet. Use <b className="font-medium text-slate-500">＋ New campaign</b> above to create one and set its goals.</div> : null}
      </div>

      <AiCmo tab="Campaigns & Goals" context={cmoContext} />
    </div>
  );
}

/** SVG grouped chart: current vs previous per stage; % or value mode; stage selection outline. */
function FunnelGraph({ stages, chart, mode, selected }: { stages: StageResult[]; chart: ChartType; mode: "value" | "pct"; selected: StageKey | "all" }) {
  const W = 560, H = 200, padL = 40, padB = 26, padT = 16;
  const plotH = H - padB - padT, plotW = W - padL - 12;
  const n = STAGES.length, slot = plotW / n;

  // Y scaling: pct mode uses a fixed 0..120 axis; value mode scales each stage to its own max.
  const yTop = 120;
  const cur = (s: StageResult) => mode === "pct" ? (s.pctOfGoal ?? 0) : s.actual;
  const prev = (s: StageResult) => {
    if (mode === "pct") return s.target && s.target > 0 ? (s.prevActual / s.target) * 100 : 0;
    return s.prevActual;
  };
  const yOf = (s: StageResult, v: number) => {
    if (mode === "pct") return padT + plotH - Math.min(v, yTop) / yTop * plotH;
    const m = Math.max(1, s.actual, s.prevActual);
    return padT + plotH - Math.min(v, m) / m * plotH;
  };

  const points = STAGES.map((k, i) => {
    const s = stages.find((x) => x.stage === k);
    const x = padL + slot * i + slot / 2;
    return { k, s, x, i };
  });

  const linePts = points.filter((p) => p.s).map((p) => `${p.x},${yOf(p.s!, cur(p.s!))}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="funnel graph, current versus previous period">
      {/* gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={padL} x2={W - 12} y1={padT + plotH * f} y2={padT + plotH * f} stroke="#eef2f7" strokeWidth="1" />
      ))}
      {mode === "pct" ? (
        <>
          <line x1={padL} x2={W - 12} y1={padT + plotH - (100 / yTop) * plotH} y2={padT + plotH - (100 / yTop) * plotH} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 4" />
          <text x={W - 12} y={padT + plotH - (100 / yTop) * plotH - 3} fontSize="8.5" fill="#94a3b8" textAnchor="end">goal 100%</text>
        </>
      ) : null}

      {points.map((p) => {
        if (!p.s) return null;
        const on = selected === "all" || selected === p.k;
        const op = on ? 1 : 0.25;
        const color = STAGE_COLORS[p.k];
        const yCur = yOf(p.s, cur(p.s)), yPrev = yOf(p.s, prev(p.s));
        const label = mode === "pct" ? (p.s.pctOfGoal === null ? "—" : `${p.s.pctOfGoal}%`) : fmt(p.s.actual);
        if (chart === "bar") {
          const bw = Math.min(26, slot * 0.28);
          return (
            <g key={p.k} opacity={op}>
              <rect x={p.x - bw - 2} y={yPrev} width={bw} height={padT + plotH - yPrev} rx="2" fill="#cbd5e1" />
              <rect x={p.x + 2} y={yCur} width={bw} height={padT + plotH - yCur} rx="2" fill={color} stroke={selected === p.k ? "#0f172a" : "none"} strokeWidth={selected === p.k ? 1.5 : 0} />
              <text x={p.x} y={yCur - 5} fontSize="9" fontWeight="600" fill="#0f172a" textAnchor="middle">{label}</text>
              <text x={p.x} y={H - 8} fontSize="8.5" fill="#94a3b8" textAnchor="middle">{STAGE_LABELS[p.k].slice(0, 6)}</text>
            </g>
          );
        }
        // line/area: dots + labels per stage (path drawn below)
        return (
          <g key={p.k} opacity={op}>
            <circle cx={p.x} cy={yCur} r={selected === p.k ? 5 : 3.5} fill={color} stroke="#fff" strokeWidth="1.5" />
            <text x={p.x} y={yCur - 7} fontSize="9" fontWeight="600" fill="#0f172a" textAnchor="middle">{label}</text>
            <text x={p.x} y={H - 8} fontSize="8.5" fill="#94a3b8" textAnchor="middle">{STAGE_LABELS[p.k].slice(0, 6)}</text>
          </g>
        );
      })}

      {chart !== "bar" && linePts ? (
        <>
          {chart === "area" ? <polygon points={`${linePts} ${W - 12},${padT + plotH} ${padL},${padT + plotH}`} fill="#4f46e5" opacity="0.08" /> : null}
          <polyline points={linePts} fill="none" stroke="#4f46e5" strokeWidth="2.5" opacity={selected === "all" ? 1 : 0.5} />
        </>
      ) : null}
    </svg>
  );
}
