"use client";

/**
 * "Follow-up results" — what came of the emails sent through sequences, per period,
 * against a comparison period. Chart (sent bars, replied / won lines, comparison dashed,
 * optional value labels, hover tooltip) → comparison strip → per-sequence table whose
 * rows expand in place (conversion chain, by-step, six-week trend, who replied / booked / won).
 * Data: /api/sales/analytics/followup — errors are shown, never rendered as zeros.
 */
import { useEffect, useMemo, useState } from "react";
import type { FollowupResults as Results, SequenceDetail, Grain, Compare, Series } from "@/lib/sales/followup-analytics";

type MetricKey = "sent" | "opened" | "replied" | "meetings" | "won" | "conversion";
const METRICS: Array<{ key: MetricKey; label: string; color: string }> = [
  { key: "sent", label: "Sent", color: "#B5D4F4" }, { key: "opened", label: "Opened", color: "#378ADD" },
  { key: "replied", label: "Replied", color: "#1D9E75" }, { key: "meetings", label: "Meetings", color: "#7F77DD" },
  { key: "won", label: "Won", color: "#639922" }, { key: "conversion", label: "Conversion %", color: "#D85A30" },
];
const MUTED = "var(--muted-foreground)";
const money = (c: number) => `$${(c / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const pctTxt = (n: number | null) => (n == null ? "—" : `${n}%`);
const loadLS = <T,>(k: string, d: T): T => { if (typeof window === "undefined") return d; try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };

function delta(cur: number | null, prev: number | null, unit: "pct" | "n" | "pts"): { txt: string; color: string } {
  if (cur == null || prev == null) return { txt: "—", color: MUTED };
  if (unit === "pts") { const d = Math.round((cur - prev) * 10) / 10; return { txt: d === 0 ? "0 pts" : `${d > 0 ? "▲" : "▼"} ${Math.abs(d)} pts`, color: d > 0 ? "#0F6E56" : d < 0 ? "#A32D2D" : MUTED }; }
  if (unit === "n") { const d = cur - prev; return { txt: d === 0 ? "0" : `${d > 0 ? "▲" : "▼"} ${Math.abs(d)}`, color: d > 0 ? "#0F6E56" : d < 0 ? "#A32D2D" : MUTED }; }
  if (prev === 0) return { txt: cur === 0 ? "0%" : "new", color: cur === 0 ? MUTED : "#0F6E56" };
  const d = Math.round(((cur - prev) / prev) * 100);
  return { txt: `${d > 0 ? "▲" : d < 0 ? "▼" : ""} ${Math.abs(d)}%`, color: d > 0 ? "#0F6E56" : d < 0 ? "#A32D2D" : MUTED };
}

export function FollowupResults({ grain, compare }: { grain: Grain; compare: Compare }) {
  const [showValues, setShowValues] = useState<boolean>(() => loadLS("salesFollowup.values", true));
  const [metrics, setMetrics] = useState<MetricKey[]>(() => loadLS<MetricKey[]>("salesFollowup.metrics", ["sent", "replied", "won"]));
  const [data, setData] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, SequenceDetail | { error: string } | undefined>>({});
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => { try { localStorage.setItem("salesFollowup.values", JSON.stringify(showValues)); localStorage.setItem("salesFollowup.metrics", JSON.stringify(metrics)); } catch { /* ignore */ } }, [showValues, metrics]);

  useEffect(() => {
    let live = true;
    setLoading(true); setError(null); setOpen(null); setDetail({});
    fetch(`/api/sales/analytics/followup?grain=${grain}&compare=${compare}`).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!live) return;
      if (!r.ok) { setError(d.error ?? `Couldn't load follow-up results (HTTP ${r.status})`); setData(null); }
      else setData(d as Results);
    }).catch((e) => { if (live) setError(e instanceof Error ? e.message : "Couldn't load follow-up results."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [grain, compare, reloadKey]);

  async function toggleRow(id: string) {
    if (open === id) { setOpen(null); return; }
    setOpen(id);
    if (detail[id]) return;
    try {
      const r = await fetch(`/api/sales/analytics/followup?grain=${grain}&sequence=${id}`);
      const d = await r.json().catch(() => ({}));
      setDetail((p) => ({ ...p, [id]: r.ok ? (d as SequenceDetail) : { error: d.error ?? "Couldn't load this sequence." } }));
    } catch (e) { setDetail((p) => ({ ...p, [id]: { error: e instanceof Error ? e.message : "Couldn't load this sequence." } })); }
  }

  const t = data?.totals, p = data?.prevTotals;

  return (
    <div>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <span style={{ fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: ".04em" }}>Show on chart</span>
          {METRICS.map((m) => {
            const on = metrics.includes(m.key);
            return <button key={m.key} type="button" onClick={() => setMetrics((cur) => on ? (cur.length > 1 ? cur.filter((k) => k !== m.key) : cur) : [...cur, m.key])}
              style={{ fontSize: 11, padding: "3px 9px", borderRadius: 10, cursor: "pointer", border: `0.5px solid ${on ? m.color : "var(--border)"}`, background: on ? "#F5F9FF" : "transparent", color: on ? "#0C447C" : MUTED }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: m.color, marginRight: 5, verticalAlign: "middle", opacity: on ? 1 : 0.4 }} />{m.label}
            </button>;
          })}
          <label style={{ marginLeft: "auto", fontSize: 11, color: MUTED, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            Values on chart <input type="checkbox" checked={showValues} onChange={(e) => setShowValues(e.target.checked)} />
          </label>
        </div>

        {error ? (
          <div role="alert" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#FCEBEB", border: "0.5px solid #F4B5B5", borderRadius: 8, color: "#A32D2D", fontSize: 12.5 }}>
            <i className="ti ti-alert-triangle" aria-hidden="true" /><span style={{ flex: 1 }}><b>Couldn&rsquo;t load follow-up results.</b> {error}</span>
            <button type="button" onClick={() => setReloadKey((k) => k + 1)} style={{ fontSize: 11.5, fontWeight: 600, color: "#A32D2D", background: "#fff", border: "0.5px solid #F4B5B5", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}>Retry</button>
          </div>
        ) : !data ? (
          <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, color: MUTED }}>{loading ? "Loading…" : ""}</div>
        ) : (
          <>
            <Chart series={data.series} prev={data.prevSeries} metrics={metrics} showValues={showValues} compare={compare} />
            {t && p && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginTop: 10 }}>
                <Kpi label="Sent" value={t.sent.toLocaleString()} prev={p.sent.toLocaleString()} d={delta(t.sent, p.sent, "pct")} />
                <Kpi label="Opened" value={pctTxt(t.openPct)} prev={pctTxt(p.openPct)} d={delta(t.openPct, p.openPct, "pts")} />
                <Kpi label="Replied" value={`${t.replied} · ${pctTxt(t.replyPct)}`} prev={`${p.replied} · ${pctTxt(p.replyPct)}`} d={delta(t.replyPct, p.replyPct, "pts")} />
                <Kpi label="Meetings" value={String(t.meetings)} prev={String(p.meetings)} d={delta(t.meetings, p.meetings, "pct")} />
                <Kpi label="Won" value={`${t.won} · ${money(t.wonCents)}`} prev={`${p.won} · ${money(p.wonCents)}`} d={delta(t.won, p.won, "n")} />
                <Kpi label="Conversion" value={pctTxt(t.conversionPct)} prev={pctTxt(p.conversionPct)} d={delta(t.conversionPct, p.conversionPct, "pts")} hint={`${t.won} won of ${t.enrolled} enrolled`} />
              </div>
            )}
          </>
        )}
      </div>

      {data && !error && (
        <div style={{ marginTop: 12, border: "0.5px solid #e2e6ed", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: ".04em", padding: "8px 10px 0" }}>By sequence</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, tableLayout: "fixed" }}>
            <thead>
              <tr style={{ textAlign: "left", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em", color: MUTED }}>
                {["Sequence", "Enrolled", "Sent", "Open rate", "Reply rate", "Meetings", "Won", "Conversion"].map((h, i) => (
                  <th key={h} style={{ padding: "8px 10px", fontWeight: 600, width: i === 0 ? "28%" : undefined, background: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.sequences.length === 0 && <tr><td colSpan={8} style={{ padding: 16, color: MUTED, textAlign: "center" }}>No follow-up emails went out in this period.</td></tr>}
              {data.sequences.map((s) => {
                const isOpen = open === s.id;
                const d = detail[s.id];
                return (
                  <FragmentRow key={s.id}>
                    <tr onClick={() => void toggleRow(s.id)} style={{ cursor: "pointer", background: isOpen ? "#F5F9FF" : undefined }}>
                      <td style={{ padding: "9px 10px", borderTop: "0.5px solid #eef1f5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        <span style={{ color: MUTED, marginRight: 6 }}>{isOpen ? "▾" : "▸"}</span>
                        <a href="/admin/sales/sequences" onClick={(e) => e.stopPropagation()} style={{ color: "#185FA5", textDecoration: "none" }}>{s.name}</a>
                      </td>
                      <Td>{s.enrolled.toLocaleString()}</Td><Td>{s.sent.toLocaleString()}</Td>
                      <Td><Bar pct={s.openPct} color="#B5D4F4" /></Td><Td><Bar pct={s.replyPct} color="#9FE1CB" /></Td>
                      <Td>{s.meetings}</Td><Td>{s.won}{s.wonCents ? <span style={{ color: MUTED }}> · {money(s.wonCents)}</span> : null}</Td>
                      <Td><Bar pct={s.conversionPct} color="#CECBF6" /></Td>
                    </tr>
                    {isOpen && (
                      <tr><td colSpan={8} style={{ padding: 0, borderTop: "0.5px solid #eef1f5" }}>
                        {!d ? <div style={{ padding: 14, fontSize: 12, color: MUTED }}>Loading…</div>
                          : "error" in d ? <div style={{ padding: 14, fontSize: 12, color: "#A32D2D" }}>{d.error}</div>
                          : <Detail d={d} seq={s} />}
                      </td></tr>
                    )}
                  </FragmentRow>
                );
              })}
              <tr>
                <td style={{ padding: "9px 10px", borderTop: "0.5px solid #eef1f5", color: MUTED }}>One-off emails (Inbox compose)</td>
                <Td>—</Td><Td>{data.oneOff.sent.toLocaleString()}</Td><Td>—</Td><Td>—</Td><Td>—</Td><Td>—</Td><Td>—</Td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) { return <>{children}</>; }
function Td({ children }: { children: React.ReactNode }) { return <td style={{ padding: "9px 10px", borderTop: "0.5px solid #eef1f5", whiteSpace: "nowrap" }}>{children}</td>; }
function Bar({ pct, color }: { pct: number | null; color: string }) {
  if (pct == null) return <span style={{ color: MUTED }}>—</span>;
  return <span><span style={{ display: "inline-block", height: 6, borderRadius: 3, background: color, width: Math.max(2, Math.min(60, pct * 0.6)), marginRight: 6, verticalAlign: "middle" }} />{pct}%</span>;
}
function Kpi({ label, value, prev, d, hint }: { label: string; value: string; prev: string; d: { txt: string; color: string }; hint?: string }) {
  return (
    <div style={{ background: "var(--surface-1, #F6F8FB)", borderRadius: 8, padding: "8px 10px", fontSize: 11, color: MUTED }} title={hint}>
      {label}<div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: "2px 0" }}>{value}</div>
      <span>prev {prev}</span> <span style={{ color: d.color, fontWeight: 500 }}>{d.txt}</span>
    </div>
  );
}

/** SVG chart: bars for sent, lines for the rest; comparison period dashed; values + hover tooltip. */
function Chart({ series, prev, metrics, showValues, compare }: { series: Series; prev: Series; metrics: MetricKey[]; showValues: boolean; compare: Compare }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 900, H = 230, L = 40, R = 12, T = 18, B = 26;
  const n = series.labels.length;
  const conv = useMemo(() => series.won.map((w, i) => (series.sent[i] > 0 ? Math.round((w / series.sent[i]) * 1000) / 10 : 0)), [series]);
  const valuesOf = (s: Series, k: MetricKey) => (k === "conversion" ? conv : s[k]);
  const maxCount = Math.max(1, ...metrics.filter((k) => k !== "conversion").flatMap((k) => [...valuesOf(series, k), ...valuesOf(prev, k)]));
  const maxPct = Math.max(1, ...conv);
  const x = (i: number) => L + ((i + 0.5) / n) * (W - L - R);
  const y = (v: number, k: MetricKey) => T + (1 - v / (k === "conversion" ? maxPct : maxCount)) * (H - T - B);
  const slot = (W - L - R) / n, bw = Math.max(3, slot * 0.55);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxCount * f));
  const labelEvery = n > 16 ? Math.ceil(n / 8) : 1;
  const linesOf = (s: Series, k: MetricKey) => valuesOf(s, k).map((v, i) => `${x(i)},${y(v, k)}`).join(" ");
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Follow-up over time" style={{ display: "block", fontFamily: "inherit" }}
        onMouseLeave={() => setHover(null)} onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; const i = Math.floor((px - L) / slot); setHover(i >= 0 && i < n ? i : null); }}>
        {ticks.map((tk, i) => <g key={i}><line x1={L} x2={W - R} y1={y(tk, "sent")} y2={y(tk, "sent")} stroke="#eef1f5" /><text x={L - 6} y={y(tk, "sent") + 3} fontSize="10" fill={MUTED} textAnchor="end">{tk}</text></g>)}
        {metrics.includes("sent") && series.sent.map((v, i) => (
          <g key={i}>
            <rect x={x(i) - bw / 2} y={y(v, "sent")} width={bw} height={Math.max(0, H - B - y(v, "sent"))} fill="#B5D4F4" opacity={hover === null || hover === i ? 1 : 0.6} />
            {showValues && v > 0 && <text x={x(i)} y={y(v, "sent") - 3} fontSize="9.5" fill="#0C447C" textAnchor="middle">{v}</text>}
          </g>
        ))}
        {metrics.includes("sent") && <polyline fill="none" stroke="#888780" strokeWidth="1.5" strokeDasharray="4 3" points={linesOf(prev, "sent")} />}
        {metrics.filter((k) => k !== "sent").map((k) => {
          const m = METRICS.find((mm) => mm.key === k)!; const vals = valuesOf(series, k);
          return (
            <g key={k}>
              {compare && k !== "conversion" && <polyline fill="none" stroke={m.color} strokeOpacity="0.45" strokeWidth="1.2" strokeDasharray="3 3" points={linesOf(prev, k)} />}
              <polyline fill="none" stroke={m.color} strokeWidth="2" points={linesOf(series, k)} />
              {vals.map((v, i) => v > 0 && (
                <g key={i}>
                  <circle cx={x(i)} cy={y(v, k)} r={k === "won" ? 3.5 : 2.5} fill={m.color} />
                  {showValues && <text x={x(i)} y={y(v, k) + (k === "won" ? 14 : -5)} fontSize="9.5" fill={m.color} fontWeight={k === "won" ? 600 : 400} textAnchor="middle">{k === "won" ? `${v} won` : k === "conversion" ? `${v}%` : v}</text>}
                </g>
              ))}
            </g>
          );
        })}
        {series.labels.map((lb, i) => (i % labelEvery === 0 || i === n - 1) && <text key={i} x={x(i)} y={H - 8} fontSize="10" fill={MUTED} textAnchor="middle">{lb}</text>)}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#94a3b8" strokeDasharray="2 2" />}
      </svg>
      {hover !== null && (
        <div style={{ position: "absolute", top: 8, left: `${Math.min(78, Math.max(2, (x(hover) / W) * 100 + 2))}%`, background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 8, padding: "8px 10px", fontSize: 11, boxShadow: "0 6px 18px rgba(0,0,0,.1)", pointerEvents: "none", minWidth: 170, zIndex: 5 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{series.labels[hover]} <span style={{ color: MUTED, fontWeight: 400 }}>vs {prev.labels[hover] ?? "—"}</span></div>
          {([["Sent", "sent"], ["Opened", "opened"], ["Replied", "replied"], ["Meetings", "meetings"], ["Won", "won"]] as Array<[string, keyof Series]>).map(([lb, k]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ color: MUTED }}>{lb}</span><span>{(series[k] as number[])[hover]}{k === "won" && series.wonCents[hover] ? ` (${money(series.wonCents[hover])})` : ""} <span style={{ color: MUTED }}>· prev {(prev[k] as number[])[hover] ?? "—"}</span></span></div>
          ))}
        </div>
      )}
    </div>
  );
}

function Detail({ d, seq }: { d: SequenceDetail; seq: { id: string; name: string; enrolled: number; conversionPct: number | null } }) {
  const c = d.chain;
  const rate = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
  const stage = (n: number | string, label: string, accent?: boolean) => (
    <div style={{ background: "#fff", border: `0.5px solid ${accent ? "#97C459" : "#e2e6ed"}`, borderRadius: 8, padding: "6px 12px", minWidth: 90 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: accent ? "#27500A" : "var(--foreground)" }}>{n}</div><div style={{ fontSize: 11, color: MUTED }}>{label}</div>
    </div>
  );
  const arrow = (r: string, label: string) => <div style={{ textAlign: "center", minWidth: 46, fontSize: 11, color: MUTED }}><div style={{ fontWeight: 600, color: "var(--foreground)" }}>{r}</div>{label} →</div>;
  const maxT = Math.max(1, ...d.trend.map((w) => w.sent));
  const csv = () => {
    const rows = [["Name", "Company", "Email", "Outcome", "Date"], ...d.people.map((p) => [p.name, p.company ?? "", p.email, p.outcome, p.at.slice(0, 10)])];
    const blob = new Blob([rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${seq.name.replace(/[^\w]+/g, "-")}-followup.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  const tag: Record<string, { bg: string; fg: string; t: string }> = { won: { bg: "#EAF3DE", fg: "#27500A", t: "Won" }, meeting: { bg: "#EEEDFE", fg: "#3C3489", t: "Meeting" }, replied: { bg: "#E1F5EE", fg: "#085041", t: "Replied" } };
  const h = (t: string) => <div style={{ fontSize: 10.5, letterSpacing: ".04em", textTransform: "uppercase", color: MUTED, marginBottom: 6 }}>{t}</div>;
  return (
    <div style={{ background: "#F8FAFD", padding: "12px 14px" }}>
      {h("Conversion chain")}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {stage(c.enrolled, "enrolled")}{arrow(rate(c.opened, c.enrolled), "opened")}
        {stage(c.opened, "opened")}{arrow(rate(c.replied, c.opened), "replied")}
        {stage(c.replied, "replied")}{arrow(rate(c.meetings, c.replied), "booked")}
        {stage(c.meetings, "meetings")}{arrow(rate(c.won, c.meetings), "won")}
        {stage(c.won, `won${c.wonCents ? ` · ${money(c.wonCents)}` : ""}`, true)}
        <span style={{ fontSize: 11, color: MUTED, marginLeft: 6 }}>Overall {c.won} won ÷ {c.enrolled} enrolled = {c.enrolled ? `${Math.round((c.won / c.enrolled) * 1000) / 10}%` : "—"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16 }}>
        <div>
          {h("By step")}
          <table style={{ borderCollapse: "collapse", fontSize: 11.5, width: "100%" }}>
            <thead><tr style={{ color: MUTED, textAlign: "left" }}>{["Step", "Sent", "Opened", "Replied", "Bounced"].map((x) => <th key={x} style={{ padding: "3px 6px", fontWeight: 500 }}>{x}</th>)}</tr></thead>
            <tbody>
              {d.steps.length === 0 && <tr><td colSpan={5} style={{ padding: 6, color: MUTED }}>No steps.</td></tr>}
              {d.steps.map((s) => (
                <tr key={s.id} style={{ borderTop: "0.5px solid #eef1f5" }}>
                  <td style={{ padding: "4px 6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{s.order} · {s.name} <span style={{ color: MUTED }}>(day {s.delayDays})</span></td>
                  <td style={{ padding: "4px 6px" }}>{s.sent}</td>
                  <td style={{ padding: "4px 6px" }}>{s.opened}{s.sent ? <span style={{ color: MUTED }}> · {Math.round((s.opened / s.sent) * 100)}%</span> : null}</td>
                  <td style={{ padding: "4px 6px" }}>{s.replied}{s.sent ? <span style={{ color: MUTED }}> · {Math.round((s.replied / s.sent) * 100)}%</span> : null}</td>
                  <td style={{ padding: "4px 6px" }}>{s.bounced}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10 }}>{h("Last 6 weeks · sent vs replied")}</div>
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 30 }}>
            {d.trend.map((w) => (
              <span key={w.weekStart} title={`${w.weekStart}: ${w.sent} sent · ${w.replied} replied`} style={{ display: "inline-flex", gap: 2, alignItems: "flex-end" }}>
                <i style={{ display: "inline-block", width: 12, height: Math.max(2, (w.sent / maxT) * 28), background: "#B5D4F4", borderRadius: "2px 2px 0 0" }} />
                <i style={{ display: "inline-block", width: 12, height: Math.max(1, (w.replied / maxT) * 28), background: "#9FE1CB", borderRadius: "2px 2px 0 0" }} />
              </span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>Active {d.states.active} · Completed {d.states.completed} · Unsubscribed {d.states.unsubscribed} · Bounced {d.states.bounced}</div>
        </div>
        <div>
          {h(`Replied · booked · won (${d.people.length} of ${c.enrolled})`)}
          <div style={{ fontSize: 11.5, maxHeight: 220, overflowY: "auto" }}>
            {d.people.length === 0 && <div style={{ color: MUTED }}>No replies, meetings or wins in this period.</div>}
            {d.people.map((pp) => {
              const tg = tag[pp.outcome];
              return (
                <div key={pp.email} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", borderTop: "0.5px solid #eef1f5" }}>
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {pp.crmId ? <a href={`/admin/sales/contacts/${pp.crmId}`} target="_blank" rel="noopener" style={{ color: "#185FA5", textDecoration: "none" }}>{pp.name}</a> : pp.name}
                    {pp.company ? <span style={{ color: MUTED }}> · {pp.company}</span> : null}
                  </span>
                  <span style={{ fontSize: 10.5, padding: "1px 7px", borderRadius: 10, background: tg.bg, color: tg.fg }}>{tg.t}</span>
                  <span style={{ color: MUTED, width: 52, textAlign: "right" }}>{new Date(pp.at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 11, marginTop: 10 }}>
            <a href="/admin/sales/sequences" target="_blank" rel="noopener" style={{ color: "#185FA5", textDecoration: "none" }}>Open sequence ↗</a>
            <a href="/admin/sales/sequences" target="_blank" rel="noopener" style={{ color: "#185FA5", textDecoration: "none" }}>View all {c.enrolled} enrolled ↗</a>
            <button type="button" onClick={csv} style={{ fontSize: 11, color: "#185FA5", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Export CSV</button>
          </div>
        </div>
      </div>
    </div>
  );
}
