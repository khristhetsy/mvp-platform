"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FollowupResults } from "./FollowupResults";
import { SalesViewControl } from "@/app/admin/sales/SalesViewControl";
import { periodRange, type Grain, type Compare } from "@/lib/sales/followup-period";

const NAVY = "#04143D", BLUE = "#0056F4", ACCENT = "#0D6BFF", MUTED = "var(--muted-foreground)";

interface SalesMetric { key: string; group: "pipeline" | "performance"; label: string; value: string; delta: string; series: number[]; drivers: Array<{ label: string; value: string }>; note?: string; compare?: { prev: string; change: string; dir: "up" | "down" | "flat" } }
const GRAINS: Array<{ id: Grain; label: string }> = [{ id: "week", label: "Week" }, { id: "30d", label: "30 days" }, { id: "quarter", label: "Quarter" }, { id: "year", label: "Year" }];
const loadLS = <T,>(k: string, d: T): T => { if (typeof window === "undefined") return d; try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
interface Insight { metric_key: string; narrative: string; model: string | null; drivers: Array<{ label: string; value: string }>; suggested_actions: Array<{ text: string; action_key: string }>; cached: boolean }

const ACTION_HREF: Record<string, string> = {
  open_opportunities: "/admin/sales/opportunities", open_pipeline: "/admin/sales/pipeline",
  open_forecast: "/admin/sales/forecast", open_tasks: "/admin/sales/tasks", open_contacts: "/admin/sales/contacts",
};

/**
 * Page layout: one header (title, subtitle, Period + Compare-to that drive every section,
 * exact date ranges) and three numbered section cards — Follow-up results, Pipeline &
 * revenue, Performance & activity — each with a titled header row and its own controls.
 */
export function SalesAnalyticsClient({ metrics: initialMetrics }: { metrics: SalesMetric[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [grain, setGrain] = useState<Grain>(() => loadLS<Grain>("salesAnalytics.grain", "30d"));
  const [compare, setCompare] = useState<Compare>(() => loadLS<Compare>("salesAnalytics.compare", "prev"));
  const [metrics, setMetrics] = useState<SalesMetric[]>(initialMetrics);
  const [metricsErr, setMetricsErr] = useState<string | null>(null);
  const viewAs = useSearchParams().get("viewAs");
  useEffect(() => { try { localStorage.setItem("salesAnalytics.grain", JSON.stringify(grain)); localStorage.setItem("salesAnalytics.compare", JSON.stringify(compare)); } catch { /* ignore */ } }, [grain, compare]);
  // The server rendered the default (30d vs previous); re-fetch when the page controls differ from it.
  useEffect(() => {
    let live = true;
    if (grain === "30d" && compare === "prev") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the server-rendered default
      setMetrics(initialMetrics); setMetricsErr(null);
      return () => { live = false; };
    }
    fetch(`/api/sales/analytics/metrics?grain=${grain}&compare=${compare}${viewAs ? `&viewAs=${encodeURIComponent(viewAs)}` : ""}`)
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!live) return; if (!r.ok) setMetricsErr(d.error ?? `HTTP ${r.status}`); else { setMetrics(d.metrics ?? []); setMetricsErr(null); } })
      .catch((e) => { if (live) setMetricsErr(e instanceof Error ? e.message : "Couldn't load metrics."); });
    return () => { live = false; };
  }, [grain, compare, viewAs, initialMetrics]);

  const pipeline = metrics.filter((m) => m.group === "pipeline");
  const performance = metrics.filter((m) => m.group === "performance");
  const { cur, cmp } = periodRange(grain, new Date(), compare);
  const seg = (on: boolean): React.CSSProperties => ({ fontSize: 12, padding: "5px 11px", border: "none", cursor: "pointer", background: on ? "var(--foreground)" : "transparent", color: on ? "#fff" : MUTED });
  const lab: React.CSSProperties = { fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: ".04em" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", paddingBottom: 12, borderBottom: "0.5px solid #e2e6ed", marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: NAVY, margin: 0 }}>Sales analytics</h1>
          <p style={{ fontSize: 12.5, color: MUTED, margin: "2px 0 0" }}>Follow-up results, pipeline health and team activity. Click any card for its trend and an AI read.</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span style={lab}>Period</span>
          <span style={{ display: "inline-flex", border: "0.5px solid var(--border)", borderRadius: 7, overflow: "hidden" }}>
            {GRAINS.map((g) => <button key={g.id} type="button" onClick={() => setGrain(g.id)} style={seg(grain === g.id)}>{g.label}</button>)}
          </span>
          <span style={lab}>Compare to</span>
          <span style={{ display: "inline-flex", border: "0.5px solid var(--border)", borderRadius: 7, overflow: "hidden" }}>
            <button type="button" onClick={() => setCompare("prev")} style={seg(compare === "prev")}>Previous period</button>
            <button type="button" onClick={() => setCompare("yoy")} style={seg(compare === "yoy")}>Same period last year</button>
          </span>
          <span style={{ flexBasis: "100%", textAlign: "right", fontSize: 11, color: MUTED }}>
            <b style={{ fontWeight: 500, color: "var(--foreground)" }}>This period</b> {fmtDate(cur.start)} – {fmtDate(cur.end)} · <b style={{ fontWeight: 500, color: "var(--foreground)" }}>Compared to</b> {fmtDate(cmp.start)} – {fmtDate(cmp.end)}
          </span>
        </div>
      </div>

      <Section n={1} title="Follow-up results" desc="What came of emails sent through sequences and campaigns">
        <FollowupResults grain={grain} compare={compare} />
      </Section>
      <Section n={2} title="Pipeline and revenue" desc="Open deals, weighted value, expected MRR, deal size" right={<SalesViewControl />}>
        {metricsErr && <p style={{ fontSize: 12, color: "#A32D2D", margin: "0 0 8px" }}>Couldn&rsquo;t refresh for this period: {metricsErr}</p>}
        <Group metrics={pipeline} onOpen={setActive} />
      </Section>
      <Section n={3} title="Performance and activity" desc="Win rate, cycle time, new deals, stalls, logged activity">
        <Group metrics={performance} onOpen={setActive} />
      </Section>
      {active && <InsightDrawer metricKey={active} label={metrics.find((m) => m.key === active)?.label ?? ""} onClose={() => setActive(null)} />}
    </div>
  );
}

function Section({ n, title, desc, right, children }: { n: number; title: string; desc: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "0.5px solid #eef1f5", background: "var(--surface-1, #F6F8FB)", flexWrap: "wrap" }}>
        <span style={{ width: 22, height: 22, borderRadius: "50%", background: NAVY, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{n}</span>
        <div><div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{title}</div><div style={{ fontSize: 11.5, color: MUTED }}>{desc}</div></div>
        {right && <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>{right}</div>}
      </div>
      <div style={{ padding: "12px 14px" }}>{children}</div>
    </section>
  );
}

function Group({ metrics, onOpen }: { metrics: SalesMetric[]; onOpen: (k: string) => void }) {
  if (metrics.length === 0) return <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>No data.</p>;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        {metrics.map((m) => (
          <div key={m.key} role="button" tabIndex={0} onClick={() => onOpen(m.key)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(m.key); } }}
            style={{ background: "var(--surface-1, #F6F8FB)", borderRadius: 10, padding: "12px 13px", cursor: "pointer", border: "1.5px solid transparent" }}>
            <div style={{ fontSize: 12, color: MUTED, display: "flex", alignItems: "center", gap: 5 }}>{m.label} <span style={{ color: ACCENT }} title="AI insight"><i className="ti ti-sparkles" aria-hidden="true" /></span></div>
            <div style={{ fontSize: 21, fontWeight: 600, color: NAVY, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{m.value}</div>
            <div style={{ fontSize: 11, color: MUTED }}>{m.delta}{m.compare && <> · prev {m.compare.prev} <span style={{ color: m.compare.dir === "up" ? "#0F6E56" : m.compare.dir === "down" ? "#A32D2D" : MUTED, fontWeight: 500 }}>{m.compare.change}</span></>}</div>
            <Bars series={m.series} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Bars({ series }: { series: number[] }) {
  if (!series || series.length < 2) return <div style={{ height: 22, marginTop: 6 }} />;
  const mx = Math.max(1, ...series);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 22, marginTop: 6 }}>
      {series.map((v, i) => <div key={i} style={{ flex: 1, height: `${Math.round((v / mx) * 20) + 2}px`, background: i === series.length - 1 ? BLUE : "#B5D4F4", borderRadius: "2px 2px 0 0" }} />)}
    </div>
  );
}

function InsightDrawer({ metricKey, label, onClose }: { metricKey: string; label: string; onClose: () => void }) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback((force: boolean) => {
    fetch(`/api/admin/sales-analytics/insights/${metricKey}`, { method: force ? "POST" : "GET" })
      .then((r) => r.json()).then((d) => setInsight(d.insight ?? null)).catch(() => {}).finally(() => setLoading(false));
  }, [metricKey]);
  useEffect(() => { load(false); }, [load]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`AI insight — ${label}`} style={{ width: "min(440px, 96vw)", height: "100%", background: "#fff", overflowY: "auto", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}><i className="ti ti-sparkles" aria-hidden="true" /> AI Sales Analyst — {label}</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: MUTED }}>×</button>
        </div>
        {loading ? <p style={{ fontSize: 12.5, color: MUTED }}>Analyzing…</p> : insight ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: NAVY }}>{insight.narrative}</p>
            {insight.drivers.length > 0 && (
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", color: MUTED, marginBottom: 6 }}>Drivers</div>
                {insight.drivers.map((d, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", borderBottom: "0.5px solid #F1F4F9" }}><span style={{ color: MUTED }}>{d.label}</span><span style={{ color: NAVY }}>{d.value}</span></div>)}
              </div>
            )}
            {insight.suggested_actions.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {insight.suggested_actions.map((a, i) => (
                  <button key={i} onClick={() => { const href = ACTION_HREF[a.action_key]; if (href) window.location.href = href; }}
                    style={{ fontSize: 11.5, fontWeight: 600, color: BLUE, background: "#EEF3FC", border: "none", borderRadius: 8, padding: "6px 11px", cursor: "pointer" }}>{a.text}</button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => { setLoading(true); load(true); }} style={{ fontSize: 12, fontWeight: 600, color: NAVY, background: "#F1EFE8", border: "none", borderRadius: 8, padding: "7px 13px", cursor: "pointer" }}>↻ Regenerate</button>
              <span style={{ fontSize: 10.5, color: MUTED }}>{insight.model ? `${insight.cached ? "cached" : "fresh"} · ${insight.model}` : "heuristic (AI not configured)"}</span>
            </div>
          </div>
        ) : <p style={{ fontSize: 12.5, color: MUTED }}>No insight available.</p>}
        <p style={{ fontSize: 10.5, color: MUTED, marginTop: 20, lineHeight: 1.5 }}>Read-only commentary on internal sales activity — current metrics, never a close guarantee. Suggestions are links; every action needs a human click.</p>
      </div>
    </div>
  );
}
