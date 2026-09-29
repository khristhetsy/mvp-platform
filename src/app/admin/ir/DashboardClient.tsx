"use client";

/**
 * IR dashboard — goals vs actual for this week / this month (cards with attainment donuts
 * that expand into a detail panel), goal vs actual trend (metric × granularity × bar/line
 * × founder), active projects table, activity by agent this week, overdue activities and
 * the investor lifecycle strip. A metric with no goal shows "No goal", never a percentage.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DashboardPayload } from "@/lib/ir/dashboard";
import { GOAL_METRIC_LABEL, GOAL_METRICS, type GoalMetric, type PeriodKind } from "@/lib/ir/metrics";
import { IR_STAGE_LABEL, type IrStage } from "@/lib/ir/types";

type Expanded = "founders" | GoalMetric | null;
const seg = (on: boolean) => `rounded-md px-2.5 py-1 text-[12px] font-medium ${on ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"}`;
const pct = (v: number | null) => (v == null ? null : Math.round(v * 100));

export function DashboardClient() {
  const [period, setPeriod] = useState<PeriodKind>("month");
  const [metric, setMetric] = useState<GoalMetric>("meetings_held");
  const [gran, setGran] = useState<PeriodKind>("month");
  const [type, setType] = useState<"bar" | "line">("bar");
  const [founder, setFounder] = useState("all");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Expanded>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState<IrStage | null>(null);

  const load = useCallback(async () => {
    const q = new URLSearchParams({ period, metric, gran, founder });
    const r = await fetch(`/api/admin/ir/dashboard?${q}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? "Couldn't load the dashboard."); return; }
    setData(j); setError(null);
  }, [period, metric, gran, founder]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set
  useEffect(() => { void load(); }, [load]);

  if (error && !data) return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>;
  if (!data) return <p className="text-[13px] text-slate-400">Loading…</p>;
  const card = (m: GoalMetric) => data.cards.find((c) => c.metric === m)!;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[18px] font-semibold text-slate-900">Goals vs actual</h2>
        <span className="text-[12px] text-slate-500">{data.period.label} · click a card for details</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Goal period">
            <button type="button" className={seg(period === "week")} onClick={() => setPeriod("week")} aria-pressed={period === "week"}>This week</button>
            <button type="button" className={seg(period === "month")} onClick={() => setPeriod("month")} aria-pressed={period === "month"}>This month</button>
          </div>
          <button type="button" onClick={() => setGoalsOpen(true)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50">Set goals</button>
          <Link href="/admin/ir/projects/new" className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700">New project</Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Founders" onClick={() => setOpen(open === "founders" ? null : "founders")} expanded={open === "founders"} more="View founders">
          <span className="text-[26px] font-semibold text-slate-900">{data.founders.active} <span className="text-[13px] font-normal text-slate-500">active</span></span>
          <span className="text-[12px] text-slate-500">{data.founders.finalMonth} in final month</span>
        </Kpi>
        {(["meetings_held", "term_sheets", "calls", "emails"] as GoalMetric[]).map((m) => { const c = card(m); const a = pct(c.attainment); return (
          <Kpi key={m} label={GOAL_METRIC_LABEL[m]} onClick={() => setOpen(open === m ? null : m)} expanded={open === m} more="View details">
            <span className="flex items-center justify-between gap-2">
              <span className="text-[26px] font-semibold text-slate-900">{c.actual} {c.target != null ? <span className="text-[13px] font-normal text-slate-500">of {c.target}</span> : <span className="text-[12px] font-normal text-slate-400">No goal</span>}</span>
              {a != null ? <Donut pct={a} /> : null}
            </span>
          </Kpi>
        ); })}
      </div>

      {open ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          {open === "founders" ? (
            <>
              <div className="mb-2 flex items-center justify-between"><h3 className="text-[15px] font-semibold text-slate-900">Active founders</h3><button type="button" onClick={() => setOpen(null)} className="text-[12px] text-slate-500 hover:text-slate-800">Close</button></div>
              <table className="w-full text-[12.5px]"><thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1.5 font-medium">Founder</th><th className="py-1.5 font-medium">Owner</th><th className="py-1.5 font-medium">Milestone</th><th className="py-1.5 font-medium">Term ends</th><th></th></tr></thead>
                <tbody className="divide-y divide-slate-100">{data.founders.list.map((f) => <tr key={f.id}><td className="py-1.5"><span className="font-medium text-slate-900">{f.title}</span>{f.founder_name ? <span className="block text-[11px] text-slate-500">{f.founder_name}</span> : null}</td><td className="py-1.5 text-slate-700">{f.owner_name ?? "—"}</td><td className="py-1.5 text-slate-700">{f.milestone}</td><td className="py-1.5 text-slate-700">{f.endsOn}</td><td className="py-1.5 text-right"><Link href={`/admin/ir/projects/${f.id}`} className="text-indigo-700 hover:underline">Open</Link></td></tr>)}
                  {data.founders.list.length === 0 ? <tr><td colSpan={5} className="py-4 text-center text-slate-400">No active projects.</td></tr> : null}</tbody></table>
            </>
          ) : (() => { const c = card(open); const a = pct(c.attainment); const gap = c.target != null ? Math.max(0, c.target - c.actual) : null; return (
            <>
              <div className="mb-3 flex items-center justify-between"><h3 className="text-[15px] font-semibold text-slate-900">{GOAL_METRIC_LABEL[open]} · {data.period.label}</h3><button type="button" onClick={() => setOpen(null)} className="text-[12px] text-slate-500 hover:text-slate-800">Close</button></div>
              <div className="grid gap-5 md:grid-cols-[180px_1fr_1fr]">
                <div className="flex flex-col items-center gap-2">
                  {a != null ? <Donut pct={a} size={120} /> : <span className="text-[13px] text-slate-400">No goal set</span>}
                  <span className="text-[13px] text-slate-700">{c.actual}{c.target != null ? ` of ${c.target}` : ""}</span>
                  {gap != null ? <span className="text-[12px] text-slate-500">{gap === 0 ? "Goal met" : `${gap} to go`}</span> : null}
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Goal vs actual per founder</p>
                  <ul className="divide-y divide-slate-100 text-[12.5px]">{c.perProject.map((p) => <li key={p.projectId} className="flex items-center justify-between py-1.5"><span className="text-slate-800">{p.title}</span><span className="text-slate-600">{p.actual}{p.target != null ? ` of ${p.target}` : <span className="text-slate-400"> · No goal</span>}</span></li>)}
                    {c.perProject.length === 0 ? <li className="py-2 text-slate-400">No active projects.</li> : null}</ul>
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Each agent&rsquo;s share</p>
                  <ul className="divide-y divide-slate-100 text-[12.5px]">{c.perAgent.map((g) => <li key={g.id} className="flex items-center justify-between py-1.5"><span className="text-slate-800">{g.name}</span><span className="text-slate-600">{g.actual}{c.actual ? ` · ${Math.round((g.actual / c.actual) * 100)}%` : ""}</span></li>)}
                    {c.perAgent.length === 0 ? <li className="py-2 text-slate-400">Nothing logged yet this period.</li> : null}</ul>
                </div>
              </div>
            </>
          ); })()}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-semibold text-slate-900">Goal vs actual trend</h3>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Metric">{(["meetings_held", "term_sheets", "calls", "emails"] as GoalMetric[]).map((m) => <button key={m} type="button" className={seg(metric === m)} onClick={() => setMetric(m)} aria-pressed={metric === m}>{GOAL_METRIC_LABEL[m]}</button>)}</div>
            <div className="flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Granularity"><button type="button" className={seg(gran === "week")} onClick={() => setGran("week")}>Weekly</button><button type="button" className={seg(gran === "month")} onClick={() => setGran("month")}>Monthly</button></div>
            <div className="flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Chart type"><button type="button" className={seg(type === "bar")} onClick={() => setType("bar")}>Bar</button><button type="button" className={seg(type === "line")} onClick={() => setType("line")}>Line</button></div>
            <select value={founder} onChange={(e) => setFounder(e.target.value)} aria-label="Founder" className="rounded-md border border-slate-200 px-2 py-1 text-[12px]"><option value="all">All founders</option>{data.founderOptions.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}</select>
          </div>
        </div>
        <TrendChart labels={data.trend.labels} actual={data.trend.actual} goal={data.trend.goal} type={type} />
        <p className="mt-1 text-[12px] text-slate-500">{data.trend.goal.every((g) => g == null) ? `No goals set for ${GOAL_METRIC_LABEL[metric].toLowerCase()} in this range — actuals only.` : "Goal in grey, actual in blue; green when actual is at or above the goal."}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-baseline justify-between"><h3 className="text-[15px] font-semibold text-slate-900">Active projects</h3><span className="text-[12px] text-slate-500">Project to date · goal is the sum of the project&rsquo;s goals</span></div>
        <table className="w-full text-[12.5px]">
          <thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1.5 font-medium">Founder</th><th className="py-1.5 font-medium">Owner</th><th className="py-1.5 font-medium">Milestone</th><th className="py-1.5 font-medium">Meetings held</th><th className="py-1.5 font-medium">Term sheets</th><th className="py-1.5 font-medium">Matches</th><th></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data.projects.map((p) => <tr key={p.id}>
              <td className="py-2"><span className="font-medium text-slate-900">{p.title}</span>{p.founder_name ? <span className="block text-[11px] text-slate-500">{p.founder_name}</span> : null}</td>
              <td className="py-2 text-slate-700">{p.owner_name ?? "—"}</td><td className="py-2 text-slate-700">{p.milestone}</td>
              <td className="py-2 pr-4"><GoalBar actual={p.meetingsHeld} target={p.meetingsGoal} /></td>
              <td className="py-2 pr-4"><GoalBar actual={p.termSheets} target={p.termGoal} /></td>
              <td className="py-2 text-slate-700">{p.matches}</td>
              <td className="py-2 text-right"><Link href={`/admin/ir/projects/${p.id}`} className="text-indigo-700 hover:underline">Open</Link></td>
            </tr>)}
            {data.projects.length === 0 ? <tr><td colSpan={7} className="py-4 text-center text-slate-400">No active projects yet — create one from a closed deal.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-[15px] font-semibold text-slate-900">Activity by agent this week</h3>
          <table className="w-full text-[12.5px]"><thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1.5 font-medium">Agent</th><th className="py-1.5 font-medium">Emails</th><th className="py-1.5 font-medium">Calls</th><th className="py-1.5 font-medium">Meetings booked</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{data.byAgent.map((a) => <tr key={a.id}><td className="py-1.5 text-slate-800">{a.name}</td><td className="py-1.5">{a.emails}</td><td className="py-1.5">{a.calls}</td><td className="py-1.5">{a.booked}</td></tr>)}
              {data.byAgent.length === 0 ? <tr><td colSpan={4} className="py-3 text-slate-400">Nothing logged this week.</td></tr> : null}</tbody></table>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-[15px] font-semibold text-slate-900">Overdue</h3>
          <ul className="flex flex-col gap-2 text-[12.5px]">
            {data.overdue.map((o) => <li key={o.id}><Link href={o.matchId ? `/admin/ir/matches/${o.matchId}` : `/admin/ir/projects/${o.projectId}`} className="flex items-center justify-between gap-2 text-slate-800 hover:text-indigo-700"><span className="truncate">{o.subject}{o.investor ? ` · ${o.investor}` : ""} <span className="text-slate-400">· {o.projectTitle}</span></span><span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700">{o.daysLate} day{o.daysLate === 1 ? "" : "s"}</span></Link></li>)}
            {data.overdue.length === 0 ? <li className="text-slate-400">Nothing overdue.</li> : null}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-baseline justify-between"><h3 className="text-[15px] font-semibold text-slate-900">Investor lifecycle</h3><span className="text-[12px] text-slate-500">All active projects</span></div>
        <div className="grid grid-cols-4 gap-2 lg:grid-cols-8">
          {data.lifecycle.map((s) => <button key={s.stage} type="button" onClick={() => setStageOpen(stageOpen === s.stage ? null : s.stage)} aria-pressed={stageOpen === s.stage} className={`flex items-center justify-between rounded-lg px-3 py-2 text-[12px] ${s.stage === "committed" ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-700"} ${stageOpen === s.stage ? "ring-2 ring-indigo-400" : "hover:ring-1 hover:ring-indigo-300"}`}>{IR_STAGE_LABEL[s.stage]}<b>{s.count}</b></button>)}
        </div>
        {stageOpen ? (
          <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-100 text-[12.5px]">
            {data.lifecycleByProject.filter((p) => p.stages[stageOpen] > 0).map((p) => <li key={p.projectId} className="flex items-center justify-between px-3 py-1.5"><span className="text-slate-800">{p.title}</span><span className="flex items-center gap-3"><span className="text-slate-600">{p.stages[stageOpen]} in {IR_STAGE_LABEL[stageOpen]}</span><Link href={`/admin/ir/projects/${p.projectId}`} className="text-indigo-700 hover:underline">Open pipeline</Link></span></li>)}
            {data.lifecycleByProject.every((p) => p.stages[stageOpen] === 0) ? <li className="px-3 py-2 text-slate-400">No investors in {IR_STAGE_LABEL[stageOpen]} right now.</li> : null}
          </ul>
        ) : null}
      </div>

      {goalsOpen ? <GoalsDialog kind={period} start={data.period.start} onClose={() => { setGoalsOpen(false); void load(); }} /> : null}
    </div>
  );
}

function Kpi({ label, children, onClick, expanded, more }: { label: string; children: React.ReactNode; onClick: () => void; expanded: boolean; more: string }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={expanded} className={`flex flex-col gap-1 rounded-xl border bg-white p-4 text-left hover:border-indigo-300 ${expanded ? "border-indigo-400 ring-1 ring-indigo-200" : "border-slate-200"}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
      <span className="mt-1 text-[11.5px] text-indigo-700">{more}</span>
    </button>
  );
}

function Donut({ pct, size = 44 }: { pct: number; size?: number }) {
  const r = size / 2 - size * 0.11, c = 2 * Math.PI * r, fill = Math.min(pct, 100) / 100;
  const color = pct >= 100 ? "#1E8A57" : "#1A6CE4";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${pct}% of goal`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF1F6" strokeWidth={size * 0.14} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={size * 0.14} strokeDasharray={`${c * fill} ${c}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.24} fontWeight={600} fill="#0A1A40">{pct}%</text>
    </svg>
  );
}

function GoalBar({ actual, target }: { actual: number; target: number | null }) {
  const a = target ? Math.min(100, Math.round((actual / target) * 100)) : null;
  return (
    <div className="min-w-[120px]">
      <div className="flex justify-between text-[12px]"><span className="text-slate-800">{actual}{target != null ? ` of ${target}` : ""}</span><span className="text-slate-500">{a != null ? `${a}%` : "No goal"}</span></div>
      <div className="mt-1 h-1.5 rounded bg-slate-100"><div className="h-1.5 rounded" style={{ width: `${a ?? 0}%`, background: a != null && a >= 100 ? "#1E8A57" : "#1A6CE4" }} /></div>
    </div>
  );
}

function TrendChart({ labels, actual, goal, type }: { labels: string[]; actual: number[]; goal: Array<number | null>; type: "bar" | "line" }) {
  const w = 900, h = 260, l = 36, b = 30, top = 14, n = Math.max(1, labels.length);
  const max = Math.max(1, ...actual, ...goal.map((g) => g ?? 0));
  const plotW = w - l - 10, plotH = h - b - top, gw = plotW / n, bw = Math.min(28, gw / 3);
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const x = (i: number) => l + i * gw + gw / 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[260px] w-full" role="img" aria-label="Goal versus actual">
      {[0, 0.5, 1].map((f) => <g key={f}><line x1={l} x2={w - 10} y1={y(f * max)} y2={y(f * max)} stroke="#E2E7F0" /><text x={l - 6} y={y(f * max) + 4} textAnchor="end" fontSize={10} fill="#5B6B86">{Math.round(f * max)}</text></g>)}
      {labels.map((lab, i) => <text key={lab + i} x={x(i)} y={h - 10} textAnchor="middle" fontSize={10.5} fill="#5B6B86">{lab}</text>)}
      {type === "bar" ? labels.map((_, i) => <g key={i}>
        {goal[i] != null ? <rect x={x(i) - bw - 2} y={y(goal[i]!)} width={bw} height={Math.max(0, top + plotH - y(goal[i]!))} rx={3} fill="#C9D2E1" /> : null}
        <rect x={goal[i] != null ? x(i) + 2 : x(i) - bw / 2} y={y(actual[i])} width={bw} height={Math.max(0, top + plotH - y(actual[i]))} rx={3} fill={goal[i] != null && actual[i] >= goal[i]! ? "#1E8A57" : "#1A6CE4"} />
        <text x={goal[i] != null ? x(i) + 2 + bw / 2 : x(i)} y={y(actual[i]) - 4} textAnchor="middle" fontSize={10} fill="#0A1A40">{actual[i]}</text>
      </g>) : <>
        {goal.some((g) => g != null) ? <polyline fill="none" stroke="#9AA6BA" strokeWidth={2} strokeDasharray="5 4" points={labels.map((_, i) => goal[i] != null ? `${x(i)},${y(goal[i]!)}` : "").filter(Boolean).join(" ")} /> : null}
        <polyline fill="none" stroke="#1A6CE4" strokeWidth={2.5} points={labels.map((_, i) => `${x(i)},${y(actual[i])}`).join(" ")} />
        {labels.map((_, i) => <g key={i}><circle cx={x(i)} cy={y(actual[i])} r={4} fill={goal[i] != null && actual[i] >= goal[i]! ? "#1E8A57" : "#1A6CE4"} /><text x={x(i)} y={y(actual[i]) - 8} textAnchor="middle" fontSize={10} fill="#0A1A40">{actual[i]}</text></g>)}
      </>}
    </svg>
  );
}

/** Goals for the current period: firm-wide row + one row per active project, per metric. Blank removes the goal. */
function GoalsDialog({ kind, start, onClose }: { kind: PeriodKind; start: string; onClose: () => void }) {
  const [data, setData] = useState<{ period: { label: string }; projects: Array<{ id: string; title: string }>; rows: Array<{ projectId: string | null; metric: GoalMetric; target: number }> } | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const key = (p: string | null, m: GoalMetric) => `${p ?? "firm"}:${m}`;
  useEffect(() => {
    let live = true;
    fetch(`/api/admin/ir/goals?kind=${kind}&start=${start}`).then((r) => r.json()).then((j) => {
      if (!live) return;
      if (j.error) { setErr(j.error); return; }
      setData(j); setVals(Object.fromEntries((j.rows as Array<{ projectId: string | null; metric: GoalMetric; target: number }>).map((r) => [key(r.projectId, r.metric), String(r.target)])));
    });
    return () => { live = false; };
  }, [kind, start]);
  async function save() {
    if (!data) return;
    setBusy(true); setErr(null);
    const rows = [null, ...data.projects.map((p) => p.id)].flatMap((pid) => GOAL_METRICS.map((m) => { const v = vals[key(pid, m)]; return { projectId: pid, metric: m, target: v == null || v.trim() === "" ? null : Number(v) }; }));
    if (rows.some((r) => r.target != null && (Number.isNaN(r.target) || r.target < 0))) { setErr("Targets must be whole numbers of zero or more."); setBusy(false); return; }
    const r = await fetch("/api/admin/ir/goals", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, start, rows }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? "Couldn't save goals."); return; }
    onClose();
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="Set goals">
      <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-1 flex items-center justify-between"><h3 className="text-[15px] font-semibold text-slate-900">Goals · {data?.period.label ?? "…"}</h3><button type="button" onClick={onClose} className="text-[12px] text-slate-500 hover:text-slate-800">Close</button></div>
        <p className="mb-3 text-[12px] text-slate-500">Firm-wide targets drive the cards; project targets drive the projects table and per-founder detail. Leave a cell blank for no goal. When there is no firm-wide row, the cards use the sum of the project goals.</p>
        {!data ? <p className="text-[13px] text-slate-400">{err ?? "Loading…"}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1.5 pr-2 font-medium">Scope</th>{GOAL_METRICS.map((m) => <th key={m} className="py-1.5 pr-2 font-medium">{GOAL_METRIC_LABEL[m]}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {[{ id: null as string | null, title: "Firm-wide" }, ...data.projects].map((p) => <tr key={p.id ?? "firm"}>
                  <td className={`py-1.5 pr-2 ${p.id ? "text-slate-800" : "font-semibold text-slate-900"}`}>{p.title}</td>
                  {GOAL_METRICS.map((m) => <td key={m} className="py-1.5 pr-2"><input type="number" min={0} step={1} inputMode="numeric" value={vals[key(p.id, m)] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [key(p.id, m)]: e.target.value }))} className="w-20 rounded-md border border-slate-200 px-2 py-1 text-[12.5px] focus:border-indigo-400 focus:outline-none" aria-label={`${p.title} ${GOAL_METRIC_LABEL[m]}`} /></td>)}
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex items-center justify-end gap-2">
          {err && data ? <span className="mr-auto text-[12px] text-rose-600">{err}</span> : null}
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="button" disabled={busy || !data} onClick={save} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? "Saving…" : "Save goals"}</button>
        </div>
      </div>
    </div>
  );
}
