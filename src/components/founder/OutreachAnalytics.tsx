"use client";

import { useMemo, useState } from "react";
import {
  comparisonRange, delta, followUpDebt, funnel, inRange, messages, rangeFor,
  rateIsMeaningful, segments, series,
  type Comparison, type OutreachRecord, type Period,
} from "@/lib/analytics/outreach-metrics";

type ChartType = "bar" | "grouped" | "line" | "area" | "stacked" | "table";
type SegmentBy = "type" | "sector" | "geography";

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "quarter", label: "Quarter" },
  { key: "year", label: "Year" },
];

const CHARTS: Array<{ key: ChartType; label: string; note: string }> = [
  { key: "bar", label: "Bar", note: "One series, discrete periods — a quarter is three measurements, not a continuum." },
  { key: "grouped", label: "Grouped", note: "Sends beside replies, when the gap between them is the point." },
  { key: "line", label: "Line", note: "Direction over many points. At three months it draws a slope nobody measured." },
  { key: "area", label: "Area", note: "Line plus volume. Reads as cumulative even when it is not — one series only." },
  { key: "stacked", label: "Stacked", note: "Replies inside sends, so the bar height stays total sends." },
  { key: "table", label: "Table", note: "The numbers themselves. Always available, and the only view you can export." },
];

const CARD = "rounded-xl border border-[var(--border-subtle)] bg-white p-4";
const LABEL = "text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]";
const CHIP = "rounded-lg border px-3 py-1.5 text-[12px]";

const on = "border-2 border-[var(--blue)] bg-[var(--blue-muted)] font-semibold text-[var(--navy)]";
const off = "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-slate-50";

function csv(rows: Array<Record<string, string | number>>): string {
  if (!rows.length) return "";
  const head = Object.keys(rows[0]);
  const cell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [head.join(","), ...rows.map((r) => head.map((h) => cell(r[h])).join(","))].join("\n");
}

function download(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Delta({ now, was }: Readonly<{ now: number; was: number | null }>) {
  const d = delta(now, was);
  if (d.was === null) return <span className="text-[11px] text-[var(--text-muted)]">—</span>;
  if (d.pct === null) {
    return <span className="text-[11px] text-emerald-700">new · from {d.was}</span>;
  }
  const colour = d.direction === "up" ? "text-emerald-700" : d.direction === "down" ? "text-rose-700" : "text-[var(--text-muted)]";
  const arrow = d.direction === "up" ? "▲" : d.direction === "down" ? "▼" : "•";
  return (
    <span className={`text-[11px] ${colour}`}>
      {arrow} {Math.abs(d.pct)}% <span className="text-[var(--text-muted)]">from {d.was}</span>
    </span>
  );
}

/**
 * Outreach, as something you can interrogate.
 *
 * Every number here is counted from the recipient rows — sends, opens, clicks
 * and replies the provider and the inbound hook have been recording all along.
 * The period governs the whole page, so nothing on screen is quietly on a
 * different window.
 */
export function OutreachAnalytics({ records, crrNote }: Readonly<{
  records: OutreachRecord[];
  /** Shown above everything when automated outreach is held at the gate. */
  crrNote?: string | null;
}>) {
  const [period, setPeriod] = useState<Period>("quarter");
  const [cmp, setCmp] = useState<Comparison>("prev");
  const [chart, setChart] = useState<ChartType>("bar");
  const [by, setBy] = useState<SegmentBy>("type");
  const [step, setStep] = useState<string>("replied");

  const now = useMemo(() => new Date(), []);
  const range = useMemo(() => rangeFor(period, now), [period, now]);
  const prevRange = useMemo(() => comparisonRange(period, cmp, now), [period, cmp, now]);

  const current = useMemo(() => inRange(records, range), [records, range]);
  const previous = useMemo(() => inRange(records, prevRange), [records, prevRange]);
  const hasPrev = prevRange !== null && previous.length > 0;

  const steps = useMemo(() => funnel(current), [current]);
  const prevSteps = useMemo(() => funnel(previous), [previous]);
  const buckets = useMemo(() => series(current, period, range), [current, period, range]);
  const prevBuckets = useMemo(
    () => (prevRange ? series(previous, period, prevRange) : []),
    [previous, period, prevRange],
  );
  const segs = useMemo(() => segments(current, by), [current, by]);
  const debt = useMemo(() => followUpDebt(records, { now }), [records, now]);
  const msgs = useMemo(() => messages(current), [current]);

  const active = steps.find((s) => s.key === step) ?? steps[0];
  const max = Math.max(...buckets.map((b) => b.sent), ...prevBuckets.map((b) => b.sent), 1);

  const noHistory = prevRange !== null && previous.length === 0;

  return (
    <div className="space-y-3">
      {crrNote ? (
        <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50/70 px-3.5 py-2.5 text-[12px] text-amber-900">
          {crrNote}
        </p>
      ) : null}

      <div className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {PERIODS.map((p) => (
              <button key={p.key} type="button" onClick={() => setPeriod(p.key)}
                className={`${CHIP} ${period === p.key ? on : off}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--text-muted)]">vs</span>
            <select value={cmp} onChange={(e) => setCmp(e.target.value as Comparison)}
              className="rounded-lg border border-[var(--border-subtle)] px-2 py-1.5 text-[12px]">
              <option value="prev">Previous period</option>
              <option value="year">Same period last year</option>
              <option value="none">No comparison</option>
            </select>
          </div>
        </div>

        <p className="mt-2 text-[11.5px] text-[var(--text-muted)]">
          {range.label}
          {noHistory ? " · nothing to compare against — you had not started sending then" : ""}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.key} className="rounded-lg border border-[var(--border-subtle)] px-3 py-2">
              <p className="text-[11px] text-[var(--text-muted)]">{s.label}</p>
              <p className="text-[20px] font-semibold leading-tight text-[var(--navy)]">{s.count}</p>
              <Delta now={s.count} was={hasPrev ? prevSteps[i].count : null} />
            </div>
          ))}
        </div>
      </div>

      <div className={CARD}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[13px] text-[var(--navy)]">Your funnel · click a step</span>
          <span className="text-[11px] text-[var(--text-muted)]">
            {current.length} send{current.length === 1 ? "" : "s"} this {period}
          </span>
        </div>

        <div className="mt-2.5 space-y-1.5">
          {steps.map((s) => (
            <button key={s.key} type="button" onClick={() => setStep(s.key)}
              className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left ${
                step === s.key ? "border-2 border-[var(--blue)] bg-[var(--blue-muted)]" : "border-[var(--border-subtle)]"
              }`}>
              <span className="w-24 flex-none text-[12px] text-[var(--text-secondary)]">{s.label}</span>
              <span className="block h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <span className="block h-2 rounded-full"
                  style={{ width: `${s.ofSent}%`, background: step === s.key ? "#2563eb" : "#B5D4F4" }} />
              </span>
              <span className="w-14 flex-none text-right text-[12.5px] font-semibold tabular-nums text-[var(--navy)]">
                {s.count}
              </span>
              <span className="w-10 flex-none text-right text-[11px] tabular-nums text-[var(--text-muted)]">
                {s.ofSent}%
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3 border-t border-[var(--border-subtle)] pt-2.5">
          <p className="text-[12.5px] text-[var(--navy)]">{active?.label} — {active?.count ?? 0}</p>
          {active && active.records.length > 0 ? (
            <div className="mt-1.5">
              {active.records.slice(0, 8).map((r) => (
                <div key={r.id} className="flex justify-between gap-3 border-t border-slate-100 py-1 text-[11.5px] first:border-0">
                  <span className="truncate text-[var(--navy)]">{r.investorName}</span>
                  <span className="whitespace-nowrap text-[var(--text-muted)]">
                    {[r.investorType, r.sentAt ? new Date(r.sentAt).toLocaleDateString() : null].filter(Boolean).join(" · ")}
                  </span>
                </div>
              ))}
              {active.records.length > 8 ? (
                <p className="pt-1 text-[11px] text-[var(--text-muted)]">
                  {active.records.length - 8} more — export to see them all.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-1 text-[11.5px] text-[var(--text-muted)]">Nobody yet in this step.</p>
          )}
        </div>
      </div>

      <div className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] text-[var(--navy)]">Sends and replies</span>
          <div className="flex flex-wrap gap-1">
            {CHARTS.map((c) => (
              <button key={c.key} type="button" onClick={() => setChart(c.key)}
                className={`rounded-md border px-2 py-1 text-[11.5px] ${chart === c.key ? on : off}`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {chart === "table" ? (
          <>
            <table className="mt-3 w-full table-fixed text-[11.5px]">
              <thead>
                <tr className="text-left text-[var(--text-muted)]">
                  <th className="pb-1 font-medium">Period</th>
                  <th className="pb-1 font-medium">Sent</th>
                  <th className="pb-1 font-medium">Replied</th>
                  <th className="pb-1 font-medium">Rate</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b) => (
                  <tr key={b.key} className="border-t border-[var(--border-subtle)]">
                    <td className="py-1 text-[var(--navy)]">{b.label}</td>
                    <td className="py-1">{b.sent}</td>
                    <td className="py-1">{b.replied}</td>
                    <td className="py-1">{b.sent ? `${Math.round((b.replied / b.sent) * 100)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button"
              onClick={() => download(
                `outreach-${period}-${new Date().toISOString().slice(0, 10)}.csv`,
                csv(buckets.map((b) => ({ period: b.label, sent: b.sent, replied: b.replied }))),
              )}
              className="mt-2.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
              Export CSV
            </button>
          </>
        ) : (
          <Chart type={chart} buckets={buckets} prev={hasPrev ? prevBuckets : []} max={max} />
        )}

        <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
          {CHARTS.find((c) => c.key === chart)?.note}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={CARD}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] text-[var(--navy)]">Who replies</span>
            <div className="flex gap-1">
              {(["type", "sector", "geography"] as SegmentBy[]).map((k) => (
                <button key={k} type="button" onClick={() => setBy(k)}
                  className={`rounded-md border px-2 py-0.5 text-[11px] ${by === k ? on : off}`}>
                  {k === "type" ? "Type" : k === "sector" ? "Sector" : "Region"}
                </button>
              ))}
            </div>
          </div>

          {segs.length === 0 ? (
            <p className="mt-2 text-[11.5px] text-[var(--text-muted)]">No sends in this period.</p>
          ) : (
            <table className="mt-2 w-full table-fixed text-[11.5px]">
              <tbody>
                {segs.slice(0, 5).map((s) => (
                  <tr key={s.label}>
                    <td className="w-24 py-1 text-[var(--text-secondary)]">{s.label}</td>
                    <td className="py-1">
                      <span className="block h-1.5 rounded-full"
                        style={{ width: `${s.rate}%`, background: rateIsMeaningful(s.sent) ? "#1D9E75" : "#B4B2A9" }} />
                    </td>
                    <td className="w-20 py-1 text-right tabular-nums text-[var(--navy)]">
                      {rateIsMeaningful(s.sent) ? `${s.rate}%` : `${s.replied}/${s.sent}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
            Under {5} sends a rate is noise, so those show the raw count instead.
          </p>
        </div>

        <div className={CARD}>
          <p className="text-[13px] text-[var(--navy)]">Follow-up debt</p>
          <p className="text-[24px] font-semibold leading-tight text-[var(--navy)]">{debt.length}</p>
          <p className="text-[11.5px] text-[var(--text-muted)]">opened, never replied, never chased</p>

          {debt.length > 0 ? (
            <div className="mt-2 border-t border-[var(--border-subtle)] pt-2">
              {debt.slice(0, 4).map((r) => (
                <div key={r.id} className="flex justify-between gap-3 py-0.5 text-[11.5px]">
                  <span className="truncate text-[var(--navy)]">{r.investorName}</span>
                  <span className="whitespace-nowrap text-[var(--text-muted)]">{r.daysSince}d</span>
                </div>
              ))}
              {debt.length > 4 ? (
                <p className="pt-1 text-[11px] text-[var(--text-muted)]">{debt.length - 4} more</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className={CARD}>
        <p className="text-[13px] text-[var(--navy)]">Which message is working</p>
        {msgs.length === 0 ? (
          <p className="mt-2 text-[11.5px] text-[var(--text-muted)]">No sends in this period.</p>
        ) : (
          <table className="mt-2 w-full table-fixed text-[11.5px]">
            <thead>
              <tr className="text-left text-[var(--text-muted)]">
                <th className="pb-1 font-medium">Subject</th>
                <th className="w-14 pb-1 font-medium">Sent</th>
                <th className="w-16 pb-1 font-medium">Opened</th>
                <th className="w-16 pb-1 font-medium">Replied</th>
              </tr>
            </thead>
            <tbody>
              {msgs.slice(0, 5).map((m) => (
                <tr key={m.subject} className="border-t border-[var(--border-subtle)]">
                  <td className="truncate py-1 text-[var(--navy)]">{m.subject}</td>
                  <td className="py-1">{m.sent}</td>
                  <td className="py-1">{m.opened}</td>
                  <td className="py-1 font-semibold text-emerald-700">{m.replied}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
          Opens and clicks come from the send provider, replies from the inbound hook. Automated sends have no reply
          column of their own, so they count toward sends and opens but never toward replies.
        </p>
      </div>
    </div>
  );
}

/** The same numbers, drawn the way the founder asked for. */
function Chart({ type, buckets, prev, max }: Readonly<{
  type: ChartType;
  buckets: Array<{ key: string; label: string; sent: number; replied: number }>;
  prev: Array<{ sent: number }>;
  max: number;
}>) {
  const W = 320, H = 96, FLOOR = 74;
  const slot = W / Math.max(buckets.length, 1);
  const h = (v: number) => Math.round((v / max) * 60);
  const x = (i: number) => 18 + i * ((W - 36) / Math.max(buckets.length - 1, 1));
  const y = (v: number) => FLOOR - h(v);

  const pts = (key: "sent" | "replied") => buckets.map((b, i) => `${x(i)},${y(b[key])}`).join(" ");

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-24 w-full" role="img" aria-label="Sends and replies over the period">
        {type === "line" || type === "area" ? (
          <>
            {type === "area" ? (
              <polygon points={`${x(0)},${FLOOR} ${pts("sent")} ${x(buckets.length - 1)},${FLOOR}`} fill="#B5D4F4" />
            ) : null}
            <polyline points={pts("sent")} fill="none" stroke="#378ADD" strokeWidth="2.5" />
            <polyline points={pts("replied")} fill="none" stroke="#1D9E75" strokeWidth="2.5" />
            {buckets.map((b, i) => (
              <circle key={b.key} cx={x(i)} cy={y(b.sent)} r="3" fill="#378ADD" />
            ))}
          </>
        ) : (
          buckets.map((b, i) => {
            const w = type === "grouped" || prev.length ? slot * 0.3 : slot * 0.45;
            const left = i * slot + slot * 0.2;
            if (type === "stacked") {
              return (
                <g key={b.key}>
                  <rect x={left} y={y(b.sent)} width={slot * 0.45} height={h(b.sent) - h(b.replied)} rx="3" fill="#B5D4F4" />
                  <rect x={left} y={FLOOR - h(b.replied)} width={slot * 0.45} height={h(b.replied)} rx="3" fill="#1D9E75" />
                </g>
              );
            }
            return (
              <g key={b.key}>
                <rect x={left} y={y(b.sent)} width={w} height={h(b.sent)} rx="3" fill="#378ADD" />
                {type === "grouped" ? (
                  <rect x={left + w + 3} y={y(b.replied)} width={w} height={h(b.replied)} rx="3" fill="#1D9E75" />
                ) : prev[i] ? (
                  <rect x={left + w + 3} y={y(prev[i].sent)} width={w} height={h(prev[i].sent)} rx="3" fill="#D3D1C7" />
                ) : null}
              </g>
            );
          })
        )}
        <line x1="0" y1={FLOOR + 1} x2={W} y2={FLOOR + 1} stroke="var(--border-subtle)" strokeWidth="1" />
        {buckets.map((b, i) => (
          <text key={b.key}
            x={type === "line" || type === "area" ? x(i) : i * slot + slot * 0.42}
            y={FLOOR + 16} textAnchor="middle"
            style={{ fontSize: 10, fill: "var(--text-muted)" }}>
            {b.label}
          </text>
        ))}
      </svg>
      <div className="flex gap-3 text-[11px] text-[var(--text-muted)]">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#378ADD]" />sent</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#1D9E75]" />replied</span>
        {prev.length && type !== "grouped" && type !== "stacked" ? (
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#D3D1C7]" />comparison</span>
        ) : null}
      </div>
    </>
  );
}
