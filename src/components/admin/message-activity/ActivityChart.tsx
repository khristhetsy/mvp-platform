"use client";

import { useState } from "react";
import {
  SENT_COLUMNS,
  chartBuckets,
  sourceLabel,
  type DayRange,
  type MessagePerson,
  type PeriodKind,
  type ReceivedItem,
  type SentItem,
} from "@/lib/analytics/message-activity-metrics";

// Series colours: brand blue, a warm contrast and a green, checked for
// colour-blind separation against white. Labels and legends carry identity too.
const C1 = "#1A6CE4";
const C2 = "#D9772B";
const C3 = "#1F9F8F";

type Side = "received" | "sent";
type View = "time" | "company" | "type";
type Style = "bar" | "line";
type Series = { key: string; label: string; color: string };

const RECEIVED_SERIES: Series[] = [
  { key: "email", label: "Email", color: C1 },
  { key: "in_app", label: "In app", color: C2 },
];
const SENT_SERIES: Series[] = [
  { key: "preview", label: "Founder Preview emails", color: C1 },
  { key: "intro", label: "Intro requests", color: C2 },
  { key: "diy", label: "DIY outreach emails", color: C3 },
];

function niceMax(m: number): number {
  if (m <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(m)));
  const n = m / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

const W = 960;

export function ActivityChart({
  kind,
  range,
  received,
  sent,
  people,
}: Readonly<{
  kind: PeriodKind;
  range: DayRange;
  received: ReceivedItem[];
  sent: SentItem[];
  people: Map<string, MessagePerson>;
}>) {
  const [side, setSide] = useState<Side>("received");
  const [view, setView] = useState<View>("time");
  const [style, setStyle] = useState<Style>("bar");
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const series = side === "received" ? RECEIVED_SERIES : SENT_SERIES;
  const rows: Array<{ at: string; s: string; personKey: string; group: string }> =
    side === "received"
      ? received.map((r) => ({ at: r.at, s: r.channel, personKey: r.personKey, group: sourceLabel(r.source) + (r.channel === "email" ? " (email)" : "") }))
      : sent.map((r) => ({ at: r.at, s: r.kind, personKey: r.personKey, group: `${SENT_COLUMNS.find((c) => c.kind === r.kind)?.label}: ${r.status}` }));
  const who = side === "received" ? "Received by founders" : "Sent to investors";

  const seg = (active: boolean) =>
    `px-3 py-1.5 text-xs font-medium ${active ? "bg-[#1A6CE4] text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`;

  const controls = (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="inline-flex overflow-hidden rounded-lg border border-slate-200" role="group" aria-label="Chart data">
        <button type="button" aria-pressed={side === "received"} onClick={() => setSide("received")} className={seg(side === "received")}>Founders</button>
        <button type="button" aria-pressed={side === "sent"} onClick={() => setSide("sent")} className={seg(side === "sent")}>Investors</button>
      </div>
      <div className="inline-flex overflow-hidden rounded-lg border border-slate-200" role="group" aria-label="Chart view">
        {(["time", "company", "type"] as View[]).map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={seg(view === v)}>
            {v === "time" ? "Over time" : v === "company" ? "By company" : "By type"}
          </button>
        ))}
      </div>
      {view === "time" ? (
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200" role="group" aria-label="Chart style">
          <button type="button" aria-pressed={style === "bar"} onClick={() => setStyle("bar")} className={seg(style === "bar")}>Bars</button>
          <button type="button" aria-pressed={style === "line"} onClick={() => setStyle("line")} className={seg(style === "line")}>Lines</button>
        </div>
      ) : null}
    </div>
  );

  let title = "";
  let svg: React.ReactNode = null;
  let table: { head: string[]; rows: Array<Array<string | number>> } = { head: [], rows: [] };
  let legend = series;
  let tip: React.ReactNode = null;

  if (view === "time") {
    const b = chartBuckets(kind, range);
    const idx = new Map(b.keys.map((k, i) => [k, i]));
    const M = series.map(() => b.keys.map(() => 0));
    for (const r of rows) {
      const i = idx.get(b.keyOf(r.at));
      const j = series.findIndex((s) => s.key === r.s);
      if (i !== undefined && j >= 0) M[j][i] += 1;
    }
    const tot = b.keys.map((_, i) => M.reduce((a, s) => a + s[i], 0));
    const peak = style === "bar" ? Math.max(0, ...tot) : Math.max(0, ...M.flat());
    const ymax = niceMax(peak * 1.08);
    const H = 270, L = 48, R = 8, T = 22, B = 42, pw = W - L - R, ph = H - T - B, n = b.keys.length, bw = pw / n;
    const y = (v: number) => T + ph - (v / ymax) * ph;
    const every = Math.ceil(n / Math.max(4, Math.floor(pw / 52)));
    const labelAll = bw >= 22;
    const peakI = tot.indexOf(Math.max(...tot));
    const unitLabel = { hour: "Hour of day (Pacific)", day: "Day", week: "Week starting", month: "Month" }[b.unit];
    title = `${who} by ${b.unit}, total ${tot.reduce((a, v) => a + v, 0)}`;
    const gw = Math.max(2, Math.min(30, bw * 0.7));

    svg = (
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
        {[0, 1, 2, 3, 4].map((g) => {
          const v = (ymax * g) / 4;
          return (
            <g key={g}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth={1} />
              <text x={L - 6} y={y(v) + 4} textAnchor="end" className="fill-slate-500 font-mono text-[11px]">{+v.toFixed(1)}</text>
            </g>
          );
        })}
        <text transform={`translate(13,${T + ph / 2}) rotate(-90)`} textAnchor="middle" className="fill-slate-500 text-[11px]">Messages</text>
        <text x={L + pw / 2} y={H - 4} textAnchor="middle" className="fill-slate-500 text-[11px]">{unitLabel}</text>
        {b.keys.map((k, i) =>
          i % every === 0 ? (
            <text key={k} x={L + bw * i + bw / 2} y={T + ph + 16} textAnchor="middle" className="fill-slate-500 font-mono text-[11px]">{b.tick(k)}</text>
          ) : null,
        )}
        {hover !== null ? <line x1={L + bw * hover + bw / 2} x2={L + bw * hover + bw / 2} y1={T} y2={T + ph} stroke="#94a3b8" strokeDasharray="3 3" /> : null}
        {style === "bar"
          ? b.keys.map((k, i) => {
              let acc = 0;
              const x = L + bw * i + (bw - gw) / 2;
              const segs = series.map((s, j) => ({ j, v: M[j][i] })).filter((s) => s.v);
              return (
                <g key={k}>
                  {segs.map(({ j, v }, si) => {
                    const top = y(acc + v);
                    const h = Math.max(1, y(acc) - top - (si ? 2 : 0));
                    acc += v;
                    const last = si === segs.length - 1;
                    const r = last ? Math.min(4, gw / 2, h) : 0;
                    return (
                      <path
                        key={j}
                        d={`M${x},${top + h}V${top + r}Q${x},${top} ${x + r},${top}H${x + gw - r}Q${x + gw},${top} ${x + gw},${top + r}V${top + h}Z`}
                        fill={series[j].color}
                      />
                    );
                  })}
                  {tot[i] && (labelAll || i === peakI) ? (
                    <text x={x + gw / 2} y={y(tot[i]) - 6} textAnchor="middle" className="fill-slate-900 text-[11.5px] font-semibold">{tot[i]}</text>
                  ) : null}
                </g>
              );
            })
          : series.map((s, j) =>
              M[j].some((v) => v) ? (
                <g key={s.key}>
                  <polyline
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    points={M[j].map((v, i) => `${L + bw * i + bw / 2},${y(v)}`).join(" ")}
                  />
                  {n <= 40
                    ? M[j].map((v, i) => (
                        <circle key={i} cx={L + bw * i + bw / 2} cy={y(v)} r={3.5} fill={s.color} stroke="#fff" strokeWidth={2} />
                      ))
                    : null}
                  {M[j].map((v, i) =>
                    v && (labelAll || v === Math.max(...M[j])) ? (
                      <text key={`t${i}`} x={L + bw * i + bw / 2} y={y(v) - 8} textAnchor="middle" className="fill-slate-900 text-[11px] font-semibold">{v}</text>
                    ) : null,
                  )}
                </g>
              ) : null,
            )}
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="#cbd5e1" />
        {b.keys.map((k, i) => (
          <rect key={`h${k}`} x={L + bw * i} y={T} width={bw} height={ph} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
    );
    if (hover !== null && b.keys[hover] !== undefined) {
      tip = (
        <div className="pointer-events-none absolute right-2 top-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
          <p className="mb-1 font-semibold text-slate-900">{b.label(b.keys[hover])}</p>
          {series.map((s, j) => (
            <p key={s.key} className="flex items-center gap-2 text-slate-600">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} />
              {s.label}
              <span className="ml-auto pl-3 tabular-nums text-slate-900">{M[j][hover]}</span>
            </p>
          ))}
          <p className="mt-0.5 flex text-slate-600">Total<span className="ml-auto pl-3 font-semibold tabular-nums text-slate-900">{tot[hover]}</span></p>
        </div>
      );
    }
    table = {
      head: [b.unit[0].toUpperCase() + b.unit.slice(1), ...series.map((s) => s.label), "Total"],
      rows: b.keys.map((k, i) => [b.label(k), ...M.map((s) => s[i]), tot[i]]).filter((r) => (r[r.length - 1] as number) > 0),
    };
  } else {
    const segSeries: Series[] = view === "company" ? series : [{ key: "x", label: "Count", color: C1 }];
    if (view === "type") legend = [];
    const groups = new Map<string, number[]>();
    for (const r of rows) {
      const p = people.get(r.personKey);
      const name = view === "company" ? p?.company ?? p?.name ?? "Unknown" : r.group;
      const v = groups.get(name) ?? segSeries.map(() => 0);
      const j = view === "company" ? segSeries.findIndex((s) => s.key === r.s) : 0;
      if (j >= 0) v[j] += 1;
      groups.set(name, v);
    }
    let list = [...groups.entries()].map(([k, v]) => ({ k, v, t: v.reduce((a, b) => a + b, 0) })).sort((a, b) => b.t - a.t);
    if (list.length > 12) {
      const rest = list.slice(11);
      list = [...list.slice(0, 11), { k: `Other (${rest.length})`, v: segSeries.map((_, j) => rest.reduce((a, r) => a + r.v[j], 0)), t: rest.reduce((a, r) => a + r.t, 0) }];
    }
    const rowH = 28, T = 4, LW = 250, R = 44, pw = W - LW - R, H = Math.max(40, list.length * rowH + T * 2);
    const mx = Math.max(1, ...list.map((r) => r.t));
    title = `${who} ${view === "company" ? "by company" : side === "received" ? "by message type" : "by type and outcome"}, total ${rows.length}`;
    svg = (
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={title}>
        {list.map((r, i) => {
          const by = T + i * rowH + 7;
          const bh = 14;
          let acc = 0;
          const segs = segSeries.map((s, j) => ({ j, v: r.v[j] })).filter((s) => s.v);
          return (
            <g key={r.k}>
              <text x={LW - 10} y={by + 11} textAnchor="end" className="fill-slate-700 text-[12px]">{r.k.length > 34 ? `${r.k.slice(0, 33)}…` : r.k}</text>
              {segs.map(({ j, v }, si) => {
                const x = LW + (acc / mx) * pw + (si ? 2 : 0);
                const w = Math.max(1, (v / mx) * pw - (si ? 2 : 0));
                acc += v;
                const last = si === segs.length - 1;
                const rr = last ? Math.min(4, w, bh / 2) : 0;
                return (
                  <g key={j}>
                    <path d={`M${x},${by}H${x + w - rr}Q${x + w},${by} ${x + w},${by + rr}V${by + bh - rr}Q${x + w},${by + bh} ${x + w - rr},${by + bh}H${x}Z`} fill={segSeries[j].color} />
                    {segs.length > 1 && w >= 26 ? <text x={x + w / 2} y={by + 11} textAnchor="middle" className="fill-white text-[10.5px] font-semibold">{v}</text> : null}
                  </g>
                );
              })}
              <text x={LW + (r.t / mx) * pw + 6} y={by + 11} className="fill-slate-900 text-[12px] font-semibold">{r.t}</text>
            </g>
          );
        })}
      </svg>
    );
    table = {
      head: [view === "company" ? "Company" : "Type", ...(segSeries.length > 1 ? segSeries.map((s) => s.label) : []), "Total"],
      rows: list.map((r) => [r.k, ...(segSeries.length > 1 ? r.v : []), r.t]),
    };
  }

  return (
    <div>
      {controls}
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {legend.length > 1 ? (
          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
            {legend.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {rows.length ? (
        <div className="relative overflow-x-auto">
          <div className="min-w-[560px]">{svg}</div>
          {tip}
        </div>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">Nothing to chart in this period.</p>
      )}
      <button type="button" onClick={() => setShowTable((v) => !v)} className="mt-2 text-xs font-semibold text-[#1A6CE4] hover:underline" aria-expanded={showTable}>
        {showTable ? "Hide table" : "Show as table"}
      </button>
      {showTable && table.rows.length ? (
        <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-slate-50">
              <tr>
                {table.head.map((h, i) => (
                  <th key={h} className={`px-3 py-1.5 font-semibold text-slate-500 ${i ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r) => (
                <tr key={String(r[0])} className="border-t border-slate-100">
                  {r.map((c, i) => (
                    <td key={i} className={`px-3 py-1.5 ${i ? "text-right tabular-nums" : "text-slate-700"}`}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
