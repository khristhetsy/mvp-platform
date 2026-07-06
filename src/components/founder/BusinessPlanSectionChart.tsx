"use client";

// Inline AI charts rendered inside their business-plan section (not a standalone card).
import type { AllocationSlice, MarketSize } from "@/lib/business-plan/charts";

const ALLOC = ["#2a78d6", "#1baf7a", "#eda100", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834", "#008300"];
function money(n: number): string {
  const a = Math.abs(n);
  const s = a >= 1e9 ? `$${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `$${Math.round(a / 1e3)}k` : `$${Math.round(a)}`;
  return n < 0 ? `-${s}` : s;
}
const inp: React.CSSProperties = { fontSize: 12, padding: "6px 8px", borderRadius: 7, border: "0.5px solid var(--border-subtle, #e2e6ed)", background: "#fff", color: "inherit" };

function Head({ label, onFill, filling }: { label: string; onFill?: () => void; filling?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <span style={{ width: 20, height: 20, borderRadius: 5, background: "#EEF2FF", color: "#4338CA", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-sparkles" aria-hidden="true" /></span>
      <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>appears here and in the PDF</span>
      {onFill && <button onClick={onFill} disabled={filling} style={{ marginLeft: "auto", fontSize: 11.5, color: "#185FA5", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 7, padding: "5px 11px", cursor: "pointer" }}>{filling ? "Filling…" : "Fill from my plan"}</button>}
    </div>
  );
}

export function ProjectionsChart({ years }: { years: { revenue: number; grossProfit: number }[] }) {
  const data = years.slice(0, 3);
  if (data.length === 0) return null;
  const max = Math.max(...data.flatMap((y) => [y.revenue, y.grossProfit]), 1);
  const W = 560, H = 180, base = 154, top = 16;
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "0.5px solid var(--border-subtle, #eef1f5)" }}>
      <Head label="Projections chart" />
      <div style={{ display: "flex", gap: 16, marginBottom: 4, fontSize: 11.5, color: "var(--text-secondary)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#2a78d6" }} />Revenue</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#1baf7a" }} />Gross profit</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 180, display: "block" }} role="img" aria-label="Revenue and gross profit years 1 to 3">
        <line x1="50" y1={top} x2={W - 15} y2={top} stroke="#e1e0d9" strokeWidth={1} />
        <line x1="50" y1={(top + base) / 2} x2={W - 15} y2={(top + base) / 2} stroke="#e1e0d9" strokeWidth={1} />
        <line x1="50" y1={base} x2={W - 15} y2={base} stroke="#c3c2b7" strokeWidth={1} />
        <text x="43" y={top + 4} fontSize={9} fill="#898781" textAnchor="end">{money(max)}</text>
        <text x="43" y={(top + base) / 2 + 4} fontSize={9} fill="#898781" textAnchor="end">{money(max / 2)}</text>
        <text x="43" y={base + 4} fontSize={9} fill="#898781" textAnchor="end">$0</text>
        {data.map((y, i) => {
          const groupW = (W - 80) / data.length;
          const gx = 65 + i * groupW + groupW / 2;
          const rh = (y.revenue / max) * (base - top);
          const gh = (y.grossProfit / max) * (base - top);
          return (
            <g key={i}>
              <rect x={gx - 28} y={base - rh} width={26} height={rh} rx={3} fill="#2a78d6" />
              <rect x={gx + 2} y={base - gh} width={26} height={gh} rx={3} fill="#1baf7a" />
              <text x={gx} y={base + 18} fontSize={10} fill="#898781" textAnchor="middle">Year {i + 1}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function MarketChart({ market, setMarket, onFill, filling }: { market: MarketSize; setMarket: (m: MarketSize) => void; onFill: () => void; filling: boolean }) {
  const rows = [["TAM", market.tam], ["SAM", market.sam], ["SOM", market.som]] as const;
  const max = Math.max(...rows.map(([, v]) => v ?? 0), 1);
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "0.5px solid var(--border-subtle, #eef1f5)" }}>
      <Head label="Market size chart" onFill={onFill} filling={filling} />
      <svg viewBox="0 0 520 100" width="100%" style={{ maxHeight: 100, display: "block" }} role="img" aria-label="Market size TAM SAM SOM">
        {rows.map(([label, v], i) => {
          const y = 8 + i * 30, w = ((v ?? 0) / max) * 380;
          return (
            <g key={label}>
              <text x={0} y={y + 13} fontSize={11} fill="#898781">{label}</text>
              <rect x={40} y={y} width={Math.max(w, 3)} height={18} rx={3} fill={["#85B7EB", "#378ADD", "#185FA5"][i]} />
              <text x={40 + Math.max(w, 3) + 6} y={y + 13} fontSize={10.5} fill="#52514e">{v != null ? money(v) : "—"}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {(["tam", "sam", "som"] as const).map((k) => (
          <div key={k} style={{ flex: 1 }}>
            <label style={{ fontSize: 10.5, color: "var(--text-secondary)", textTransform: "uppercase" }}>{k}</label>
            <input value={market[k] ?? ""} onChange={(e) => setMarket({ ...market, [k]: e.target.value ? Number(e.target.value) : null })} placeholder="0" inputMode="numeric" style={{ ...inp, width: "100%", marginTop: 3, boxSizing: "border-box" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FundsChart({ allocation, setAllocation, onFill, filling }: { allocation: AllocationSlice[]; setAllocation: (a: AllocationSlice[]) => void; onFill: () => void; filling: boolean }) {
  const total = allocation.reduce((a, s) => a + (s.pct || 0), 0) || 1;
  const fracs = allocation.map((s) => (s.pct || 0) / total);
  const r = 34, cx = 42, cy = 42, sw = 16, circ = 2 * Math.PI * r;
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "0.5px solid var(--border-subtle, #eef1f5)" }}>
      <Head label="Use of funds chart" onFill={onFill} filling={filling} />
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <svg viewBox="0 0 84 84" width={84} height={84} role="img" aria-label="Use of funds donut">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef1f5" strokeWidth={sw} />
          {fracs.map((frac, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={ALLOC[i % ALLOC.length]} strokeWidth={sw} strokeDasharray={`${frac * circ} ${circ - frac * circ}`} strokeDashoffset={-fracs.slice(0, i).reduce((a, b) => a + b, 0) * circ} transform={`rotate(-90 ${cx} ${cy})`} />
          ))}
        </svg>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
          {allocation.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: ALLOC[i % ALLOC.length], flexShrink: 0 }} />
              <input value={a.label} onChange={(e) => setAllocation(allocation.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} style={{ ...inp, flex: 1, minWidth: 0 }} />
              <input value={a.pct} onChange={(e) => setAllocation(allocation.map((x, j) => j === i ? { ...x, pct: Number(e.target.value) || 0 } : x))} inputMode="numeric" style={{ ...inp, width: 46, textAlign: "center" }} />
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
