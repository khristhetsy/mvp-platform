"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Alloc = { label: string; pct: number };
type Market = { tam: number | null; sam: number | null; som: number | null };
type Year = { revenue: number; grossProfit: number };
const ALLOC_COLORS = ["#2a78d6", "#1baf7a", "#eda100", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834", "#008300"];

function money(n: number): string {
  const a = Math.abs(n);
  const s = a >= 1e9 ? `$${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `$${Math.round(a / 1e3)}k` : `$${Math.round(a)}`;
  return n < 0 ? `-${s}` : s;
}

export function BusinessPlanCharts() {
  const [alloc, setAlloc] = useState<Alloc[]>([]);
  const [market, setMarket] = useState<Market>({ tam: null, sam: null, som: null });
  const [years, setYears] = useState<Year[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/founder/business-plan");
      if (res.ok) {
        const d = await res.json();
        const c = (d.plan?.charts ?? {}) as { allocation?: Alloc[]; market?: Market };
        setAlloc(c.allocation?.length ? c.allocation : [{ label: "Engineering", pct: 45 }, { label: "Go-to-market", pct: 30 }, { label: "Operations", pct: 15 }, { label: "Reserve", pct: 10 }]);
        setMarket(c.market ?? { tam: null, sam: null, som: null });
        const yrs = (d.plan?.projections?.years ?? []) as Array<{ revenue: number; grossProfit: number }>;
        setYears(yrs.slice(0, 3).map((y) => ({ revenue: y.revenue, grossProfit: y.grossProfit })));
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
  useEffect(() => { void load(); }, [load]);

  async function aiFill() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/founder/business-plan/charts", { method: "POST" });
      const d = await res.json();
      if (d.charts) { setAlloc(d.charts.allocation ?? alloc); setMarket(d.charts.market ?? market); setMsg("Filled from your plan."); }
    } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/founder/business-plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ charts: { allocation: alloc, market } }) });
      setMsg(res.ok ? "Saved." : "Save failed.");
    } finally { setBusy(false); }
  }

  const allocTotal = useMemo(() => alloc.reduce((a, x) => a + (x.pct || 0), 0), [alloc]);
  const inp: React.CSSProperties = { fontSize: 12, padding: "6px 8px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" };

  if (loading) return null;

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: 16, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: "#EEF2FF", color: "#4338CA", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-sparkles" aria-hidden="true" /></span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>AI charts</span>
        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>auto-generated from your plan · included in the PDF</span>
        <div style={{ flex: 1 }} />
        <button onClick={aiFill} disabled={busy} style={{ fontSize: 12, color: "#185FA5", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}><i className="ti ti-sparkles" aria-hidden="true" /> Fill from my plan</button>
        <button onClick={save} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}>Save charts</button>
        {msg && <span style={{ fontSize: 11.5, color: msg.includes("fail") ? "#A32D2D" : "#0F6E56", width: "100%" }}>{msg}</span>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Projections */}
        <div style={{ gridColumn: "1 / -1", border: "0.5px solid #eef1f5", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>Financial projections</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 10 }}>Revenue and gross profit, years 1–3</div>
          {years.length ? <ProjectionsChart years={years} /> : <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>Confirm your projection assumptions above to draw this chart.</div>}
        </div>

        {/* Use of funds */}
        <div style={{ border: "0.5px solid #eef1f5", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>Use of funds</div>
          <div style={{ fontSize: 11, color: allocTotal === 100 ? "var(--muted-foreground)" : "#A32D2D", marginBottom: 10 }}>Allocation {allocTotal !== 100 ? `(totals ${allocTotal}% — should be 100)` : ""}</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Donut slices={alloc} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
              {alloc.map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: ALLOC_COLORS[i % ALLOC_COLORS.length], flexShrink: 0 }} />
                  <input value={a.label} onChange={(e) => setAlloc((p) => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} style={{ ...inp, flex: 1, minWidth: 0 }} />
                  <input value={a.pct} onChange={(e) => setAlloc((p) => p.map((x, j) => j === i ? { ...x, pct: Number(e.target.value) || 0 } : x))} inputMode="numeric" style={{ ...inp, width: 46, textAlign: "center" }} />
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Market */}
        <div style={{ border: "0.5px solid #eef1f5", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>Market size</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 10 }}>TAM / SAM / SOM (dollars)</div>
          <MarketChart market={market} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {(["tam", "sam", "som"] as const).map((k) => (
              <div key={k} style={{ flex: 1 }}>
                <label style={{ fontSize: 10.5, color: "var(--muted-foreground)", textTransform: "uppercase" }}>{k}</label>
                <input value={market[k] ?? ""} onChange={(e) => setMarket((m) => ({ ...m, [k]: e.target.value ? Number(e.target.value) : null }))} placeholder="0" inputMode="numeric" style={{ ...inp, width: "100%", marginTop: 3 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectionsChart({ years }: { years: Year[] }) {
  const max = Math.max(...years.flatMap((y) => [y.revenue, y.grossProfit]), 1);
  const W = 560, H = 180, pad = 30, groupW = (W - pad * 2) / years.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Revenue and gross profit years 1 to 3">
      {[0, 0.5, 1].map((f) => <line key={f} x1={pad} x2={W - pad} y1={H - 24 - f * (H - 44)} y2={H - 24 - f * (H - 44)} stroke="#e1e0d9" strokeWidth={1} />)}
      {years.map((y, i) => {
        const gx = pad + i * groupW + groupW / 2;
        const bw = 22;
        const rh = (y.revenue / max) * (H - 44);
        const gh = (y.grossProfit / max) * (H - 44);
        return (
          <g key={i}>
            <rect x={gx - bw - 3} y={H - 24 - rh} width={bw} height={rh} rx={3} fill="#2a78d6" />
            <rect x={gx + 3} y={H - 24 - gh} width={bw} height={gh} rx={3} fill="#1baf7a" />
            <text x={gx} y={H - 8} fontSize={10} fill="#898781" textAnchor="middle">Year {i + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Donut({ slices }: { slices: Alloc[] }) {
  const total = slices.reduce((a, s) => a + (s.pct || 0), 0) || 1;
  const r = 34, cx = 42, cy = 42, sw = 16;
  const circ = 2 * Math.PI * r;
  const fracs = slices.map((s) => (s.pct || 0) / total);
  const arcs = fracs.map((frac, i) => ({
    i, dash: frac * circ,
    offset: -fracs.slice(0, i).reduce((a, b) => a + b, 0) * circ,
    color: ALLOC_COLORS[i % ALLOC_COLORS.length],
  }));
  return (
    <svg viewBox="0 0 84 84" width={84} height={84} role="img" aria-label="Use of funds allocation">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef1f5" strokeWidth={sw} />
      {arcs.map((a) => (
        <circle key={a.i} cx={cx} cy={cy} r={r} fill="none" stroke={a.color} strokeWidth={sw} strokeDasharray={`${a.dash} ${circ - a.dash}`} strokeDashoffset={a.offset} transform={`rotate(-90 ${cx} ${cy})`} />
      ))}
    </svg>
  );
}

function MarketChart({ market }: { market: Market }) {
  const rows = [["TAM", market.tam, "#85B7EB"], ["SAM", market.sam, "#378ADD"], ["SOM", market.som, "#185FA5"]] as const;
  const max = Math.max(...rows.map(([, v]) => v ?? 0), 1);
  return (
    <svg viewBox="0 0 320 96" width="100%" role="img" aria-label="Market size TAM SAM SOM">
      {rows.map(([label, v, color], i) => {
        const y = 8 + i * 30;
        const w = ((v ?? 0) / max) * 210;
        return (
          <g key={label}>
            <text x={0} y={y + 13} fontSize={11} fill="#898781">{label}</text>
            <rect x={38} y={y} width={Math.max(w, 2)} height={18} rx={3} fill={color} />
            <text x={38 + Math.max(w, 2) + 6} y={y + 13} fontSize={10.5} fill="#52514e">{v != null ? money(v) : "—"}</text>
          </g>
        );
      })}
    </svg>
  );
}
