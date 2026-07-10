"use client";

import { useCallback, useEffect, useState } from "react";

const NAVY = "#04143D", BLUE = "#0056F4", ACCENT = "#0D6BFF", MUTED = "var(--muted-foreground)";

interface SalesMetric { key: string; group: "pipeline" | "performance"; label: string; value: string; delta: string; series: number[]; drivers: Array<{ label: string; value: string }>; note?: string }
interface Insight { metric_key: string; narrative: string; model: string | null; drivers: Array<{ label: string; value: string }>; suggested_actions: Array<{ text: string; action_key: string }>; cached: boolean }

const ACTION_HREF: Record<string, string> = {
  open_opportunities: "/admin/sales/opportunities", open_pipeline: "/admin/sales/pipeline",
  open_forecast: "/admin/sales/forecast", open_tasks: "/admin/sales/tasks", open_contacts: "/admin/sales/contacts",
};

export function SalesAnalyticsClient({ metrics }: { metrics: SalesMetric[] }) {
  const [active, setActive] = useState<string | null>(null);
  const pipeline = metrics.filter((m) => m.group === "pipeline");
  const performance = metrics.filter((m) => m.group === "performance");
  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: NAVY, margin: "0 0 4px" }}>Sales Analytics</h1>
      <p style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>Click any card for its trend and an AI Sales analyst read. Read-only — current pipeline health.</p>
      <Group label="Pipeline & revenue" metrics={pipeline} onOpen={setActive} />
      <Group label="Performance & activity" metrics={performance} onOpen={setActive} />
      {active && <InsightDrawer metricKey={active} label={metrics.find((m) => m.key === active)?.label ?? ""} onClose={() => setActive(null)} />}
    </div>
  );
}

function Group({ label, metrics, onOpen }: { label: string; metrics: SalesMetric[]; onOpen: (k: string) => void }) {
  if (metrics.length === 0) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".4px", color: MUTED, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        {metrics.map((m) => (
          <div key={m.key} role="button" tabIndex={0} onClick={() => onOpen(m.key)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(m.key); } }}
            style={{ background: "var(--surface-1, #F6F8FB)", borderRadius: 10, padding: "12px 13px", cursor: "pointer", border: "1.5px solid transparent" }}>
            <div style={{ fontSize: 12, color: MUTED, display: "flex", alignItems: "center", gap: 5 }}>{m.label} <span style={{ color: ACCENT }} title="AI insight">✦</span></div>
            <div style={{ fontSize: 21, fontWeight: 600, color: NAVY, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{m.value}</div>
            <div style={{ fontSize: 11, color: MUTED }}>{m.delta}</div>
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
          <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>✦ AI Sales Analyst — {label}</div>
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
