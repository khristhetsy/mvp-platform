"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/ui/format-display";
import { ALL_DRIVER_KEYS, type ForecastOutput, type MonthSegmentRow, type ActualsAnchor, type Segment } from "@/lib/forecast/engine";

const NAVY = "#04143D", BLUE = "#0056F4", BRIGHT = "#0D6BFF", MUTED = "var(--muted-foreground)";

interface Scenario { id: string; name: string; kind: string; horizon_months: number; start_month: string; is_active: boolean; notes: string | null }
interface SnapshotMeta { id: string; scenario_id: string; computed_at: string; engine_version: string; assumptions_hash: string }
interface Assumption { id?: string; driver_key: string; segment: string | null; month_from: number; month_to: number; value: number }
interface StageWeight { stage_id: string; stage_name: string; sort_order: number; is_won: boolean; win_probability: number; expected_lag_days: number; is_active: boolean }
interface ActualsPoint { month: string; segment: string; ending_mrr_cents: number; new_mrr_cents: number; churned_mrr_cents: number; active_subs: number }
interface VarianceRow { month: string; monthIndex: number; projectedMrrCents: number; actualMrrCents: number; deltaCents: number; deltaPct: number | null }

const money = (cents: number) => formatCurrency(Math.round(cents), { cents: true });
const SEGMENTS_OPT = ["", "founder", "investor", "hot", "warm", "cold"];
type SubTab = "overview" | "assumptions" | "projection" | "weights" | "variance";

export function ForecastClient(props: {
  scenarios: Scenario[];
  activeScenarioId: string | null;
  initialSnapshot: { meta: SnapshotMeta; output: ForecastOutput } | null;
  anchor: ActualsAnchor;
  actualsSeries: ActualsPoint[];
}) {
  const [tab, setTab] = useState<SubTab>("overview");
  const [scenarioId, setScenarioId] = useState<string | null>(props.activeScenarioId);
  const [snapshot, setSnapshot] = useState<{ meta: SnapshotMeta; output: ForecastOutput } | null>(props.initialSnapshot);
  const [computing, setComputing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const scenario = props.scenarios.find((s) => s.id === scenarioId) ?? null;

  // Actuals ending-MRR total per calendar month (sum segments).
  const actualsByMonth = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of props.actualsSeries) {
      const k = String(p.month).slice(0, 7);
      m.set(k, (m.get(k) ?? 0) + (Number(p.ending_mrr_cents) || 0));
    }
    return m;
  }, [props.actualsSeries]);

  const currentMrr = props.anchor.endingMrrCents.founder + props.anchor.endingMrrCents.investor;
  const projectedArr = snapshot ? snapshot.output.totals.arrByMonth[snapshot.output.totals.arrByMonth.length - 1] : null;

  // Variance to date = latest actual month vs the snapshot's projection for that month index.
  const varianceToDate = useMemo(() => {
    if (!snapshot) return null;
    const start = new Date(snapshot.output.startMonth);
    let latest: { actual: number; projected: number } | null = null;
    for (let i = 0; i < snapshot.output.totals.endingMrrByMonth.length; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (actualsByMonth.has(key)) latest = { actual: actualsByMonth.get(key)!, projected: snapshot.output.totals.endingMrrByMonth[i] };
    }
    return latest ? latest.actual - latest.projected : null;
  }, [snapshot, actualsByMonth]);

  const compute = useCallback(async () => {
    if (!scenarioId) return;
    setComputing(true); setMsg(null);
    try {
      const r = await fetch(`/api/sales/forecast/scenarios/${scenarioId}/compute`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) { setMsg(typeof d.error === "string" ? d.error : "Compute failed."); return; }
      const s = await fetch(`/api/sales/forecast/scenarios/${scenarioId}/snapshots?latest=1`).then((x) => x.json());
      if (s.output) setSnapshot({ meta: s.snapshot, output: s.output });
      setMsg("Forecast computed.");
    } catch { setMsg("Compute failed."); }
    finally { setComputing(false); }
  }, [scenarioId]);

  // Refresh the shown snapshot when switching scenarios.
  useEffect(() => {
    let alive = true;
    if (!scenarioId) return;
    fetch(`/api/sales/forecast/scenarios/${scenarioId}/snapshots?latest=1`).then((x) => x.json()).then((s) => {
      if (alive) setSnapshot(s.output ? { meta: s.snapshot, output: s.output } : null);
    }).catch(() => {});
    return () => { alive = false; };
  }, [scenarioId]);

  const TABS: Array<[SubTab, string]> = [
    ["overview", "Overview"], ["assumptions", "Assumptions"], ["projection", "Projection"], ["weights", "Pipeline Weights"], ["variance", "Variance"],
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: NAVY, margin: 0 }}>Sales Forecast &amp; Projection</h1>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <select value={scenarioId ?? ""} onChange={(e) => setScenarioId(e.target.value || null)}
            style={{ fontSize: 12.5, padding: "6px 10px", borderRadius: 8, border: "0.5px solid var(--border)" }}>
            {props.scenarios.length === 0 && <option value="">No scenarios</option>}
            {props.scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}{s.is_active ? " · active" : ""}</option>)}
          </select>
          <button onClick={() => void compute()} disabled={computing || !scenarioId}
            style={{ fontSize: 12.5, fontWeight: 600, padding: "7px 14px", borderRadius: 8, border: "none", background: BLUE, color: "#fff", cursor: "pointer", opacity: computing || !scenarioId ? 0.6 : 1 }}>
            {computing ? "Computing…" : "Compute forecast"}
          </button>
        </div>
      </div>

      {msg && <div style={{ fontSize: 12, marginBottom: 10, color: /fail/i.test(msg) ? "#A32D2D" : "#0F6E56" }}>{msg}</div>}

      <div style={{ display: "flex", gap: 14, borderBottom: "0.5px solid var(--border)", marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ paddingBottom: 8, fontSize: 12.5, background: "none", border: "none", cursor: "pointer",
              color: tab === k ? BRIGHT : MUTED, fontWeight: tab === k ? 600 : 400,
              borderBottom: tab === k ? `2px solid ${BRIGHT}` : "2px solid transparent" }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <Overview currentMrr={currentMrr} currentArr={currentMrr * 12} projectedArr={projectedArr} varianceToDate={varianceToDate}
          snapshot={snapshot} actualsByMonth={actualsByMonth} />
      )}
      {tab === "assumptions" && <Assumptions scenarioId={scenarioId} onComputed={compute} />}
      {tab === "projection" && <Projection snapshot={snapshot} />}
      {tab === "weights" && <Weights />}
      {tab === "variance" && <Variance scenarioId={scenarioId} />}

      {scenario && (
        <p style={{ fontSize: 11, color: MUTED, marginTop: 16 }}>
          Internal revenue planning only — projections, not funding-probability or outcome claims.
          {snapshot ? ` Snapshot ${snapshot.meta.id.slice(0, 8)} · engine ${snapshot.meta.engine_version} · ${new Date(snapshot.meta.computed_at).toLocaleString()}` : " No snapshot yet — Compute forecast to generate one."}
        </p>
      )}
    </div>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: "var(--surface-1, #F6F8FB)", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 12, color: MUTED, display: "flex", alignItems: "center", gap: 5 }}>{label} <span style={{ color: BRIGHT }}>✦</span></div>
      <div style={{ fontSize: 22, fontWeight: 600, color: NAVY, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function Overview({ currentMrr, currentArr, projectedArr, varianceToDate, snapshot, actualsByMonth }: {
  currentMrr: number; currentArr: number; projectedArr: number | null; varianceToDate: number | null;
  snapshot: { meta: SnapshotMeta; output: ForecastOutput } | null; actualsByMonth: Map<string, number>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Card label="Current MRR" value={money(currentMrr)} />
        <Card label="Current ARR" value={money(currentArr)} />
        <Card label="Projected ARR" value={projectedArr != null ? money(projectedArr) : "—"} sub={projectedArr != null ? "end of horizon" : "compute a forecast"} />
        <Card label="Variance to date" value={varianceToDate != null ? `${varianceToDate >= 0 ? "+" : ""}${money(varianceToDate)}` : "—"} sub="actual vs projection" />
      </div>
      <div style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 10 }}>MRR — actuals vs projection</div>
        {snapshot ? <MrrChart snapshot={snapshot} actualsByMonth={actualsByMonth} /> : <p style={{ fontSize: 12.5, color: MUTED }}>Compute a forecast to see the projection curve.</p>}
      </div>
    </div>
  );
}

function MrrChart({ snapshot, actualsByMonth }: { snapshot: { output: ForecastOutput }; actualsByMonth: Map<string, number> }) {
  const proj = snapshot.output.totals.endingMrrByMonth;
  const start = new Date(snapshot.output.startMonth);
  const blend = snapshot.output.blendMonths;
  const actualPts: Array<{ i: number; v: number }> = [];
  for (let i = 0; i < proj.length; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (actualsByMonth.has(key)) actualPts.push({ i, v: actualsByMonth.get(key)! });
  }
  const W = 640, H = 200, PADX = 8, PADY = 12;
  const maxV = Math.max(1, ...proj, ...actualPts.map((p) => p.v));
  const x = (i: number) => PADX + (i / (proj.length - 1)) * (W - 2 * PADX);
  const y = (v: number) => H - PADY - (v / maxV) * (H - 2 * PADY);
  const projPath = proj.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const actPath = actualPts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="MRR actuals versus projection">
      <rect x={x(0)} y={PADY} width={x(blend) - x(0)} height={H - 2 * PADY} fill={BRIGHT} opacity={0.06} />
      <path d={projPath} fill="none" stroke={BLUE} strokeWidth={2} strokeDasharray="5 4" />
      {actPath && <path d={actPath} fill="none" stroke={NAVY} strokeWidth={2} />}
      <text x={x(0)} y={H - 1} fontSize={9} fill={MUTED}>month 0</text>
      <text x={W - 24} y={H - 1} fontSize={9} fill={MUTED}>+{proj.length - 1}</text>
    </svg>
  );
}

function Projection({ snapshot }: { snapshot: { meta: SnapshotMeta; output: ForecastOutput } | null }) {
  const [seg, setSeg] = useState<"all" | Segment>("all");
  if (!snapshot) return <p style={{ fontSize: 12.5, color: MUTED }}>Compute a forecast to populate the projection table.</p>;
  const rows = snapshot.output.rows.filter((r) => (seg === "all" ? true : r.segment === seg) && r.month > 0);
  const cols: Array<[keyof MonthSegmentRow, string, boolean]> = [
    ["month", "Mo", false], ["segment", "Segment", false], ["leads", "Leads", false], ["new_subs", "New", false],
    ["new_mrr", "New MRR", true], ["churned_mrr", "Churn MRR", true], ["ending_mrr", "Ending MRR", true], ["arr", "ARR", true],
  ];
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <select value={seg} onChange={(e) => setSeg(e.target.value as "all" | Segment)} style={{ fontSize: 12, padding: "5px 9px", borderRadius: 7, border: "0.5px solid var(--border)" }}>
          <option value="all">All segments</option><option value="founder">Founder</option><option value="investor">Investor</option>
        </select>
        <a href={`/api/sales/forecast/export?snapshot=${snapshot.meta.id}&format=csv`} style={{ fontSize: 12, color: BLUE, textDecoration: "none" }}>Export CSV</a>
        <a href={`/api/sales/forecast/export?snapshot=${snapshot.meta.id}&format=xlsx`} style={{ fontSize: 12, color: BLUE, textDecoration: "none" }}>Export XLSX</a>
      </div>
      <div style={{ overflowX: "auto", border: "0.5px solid var(--border)", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
          <thead><tr style={{ background: "#F6F8FB" }}>{cols.map(([, h]) => <th key={h} style={{ textAlign: "left", padding: "7px 10px", fontWeight: 600, color: MUTED, fontSize: 10.5, textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: "0.5px solid #F1F4F9" }}>
                {cols.map(([k, , isMoney]) => (
                  <td key={String(k)} style={{ padding: "6px 10px", color: NAVY }}>
                    {k === "month" && r.month <= snapshot.output.blendMonths
                      ? <span>{r.month} <span style={{ fontSize: 9, background: "#E6F1FB", color: "#0C447C", borderRadius: 4, padding: "1px 4px" }}>BLEND</span></span>
                      : isMoney ? money(r[k] as number) : String(r[k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Assumptions({ scenarioId, onComputed }: { scenarioId: string | null; onComputed: () => void }) {
  const [rows, setRows] = useState<Assumption[]>([]);
  const [loaded, setLoaded] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!scenarioId) return;
    fetch(`/api/sales/forecast/scenarios/${scenarioId}/assumptions`).then((r) => r.json()).then((d) => {
      if (!alive) return;
      const list = (d.assumptions ?? []) as Assumption[];
      setRows(list); setLoaded(JSON.stringify(list)); setDirty(false);
    }).catch(() => {});
    return () => { alive = false; };
  }, [scenarioId]);

  const update = (i: number, patch: Partial<Assumption>) => {
    setRows((prev) => { const next = prev.map((r, j) => (j === i ? { ...r, ...patch } : r)); setDirty(JSON.stringify(next) !== loaded); return next; });
  };
  const addRow = () => { setRows((p) => [...p, { driver_key: ALL_DRIVER_KEYS[0], segment: null, month_from: 0, month_to: 999, value: 0 }]); setDirty(true); };
  const removeRow = (i: number) => { setRows((p) => p.filter((_, j) => j !== i)); setDirty(true); };

  const save = async () => {
    if (!scenarioId) return;
    setSaving(true); setNote(null);
    try {
      const payload = rows.map((r) => ({ driver_key: r.driver_key, segment: r.segment || null, month_from: r.month_from, month_to: r.month_to, value: r.value }));
      const r = await fetch(`/api/sales/forecast/scenarios/${scenarioId}/assumptions`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assumptions: payload }) });
      const d = await r.json();
      if (!r.ok) { setNote("Save failed — check ranges/values."); return; }
      const list = (d.assumptions ?? []) as Assumption[];
      setRows(list); setLoaded(JSON.stringify(list)); setDirty(false); setNote("Saved.");
    } catch { setNote("Save failed."); } finally { setSaving(false); }
  };

  if (!scenarioId) return <p style={{ fontSize: 12.5, color: MUTED }}>Select a scenario.</p>;
  return (
    <div>
      {dirty && <div style={{ fontSize: 12, background: "#FAEEDA", color: "#854F0B", borderRadius: 8, padding: "7px 11px", marginBottom: 10 }}>Unsaved changes — save, then Compute forecast to snapshot.</div>}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <button onClick={addRow} style={btn("#EEF3FC", BLUE)}>+ Driver row</button>
        <button onClick={() => void save()} disabled={saving} style={btn(NAVY, "#fff")}>{saving ? "Saving…" : "Save"}</button>
        <button onClick={() => onComputed()} style={btn("#E1F5EE", "#0F6E56")}>Compute forecast</button>
        {note && <span style={{ fontSize: 12, color: /fail/i.test(note) ? "#A32D2D" : "#0F6E56", alignSelf: "center" }}>{note}</span>}
      </div>
      <div style={{ overflowX: "auto", border: "0.5px solid var(--border)", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ background: "#F6F8FB" }}>{["Driver", "Segment", "From", "To", "Value", ""].map((h) => <th key={h} style={{ textAlign: "left", padding: "7px 10px", fontSize: 10.5, color: MUTED, textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: "0.5px solid #F1F4F9" }}>
                <td style={{ padding: "4px 8px" }}><select value={r.driver_key} onChange={(e) => update(i, { driver_key: e.target.value })} style={inp(150)}>{ALL_DRIVER_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}</select></td>
                <td style={{ padding: "4px 8px" }}><select value={r.segment ?? ""} onChange={(e) => update(i, { segment: e.target.value || null })} style={inp(90)}>{SEGMENTS_OPT.map((s) => <option key={s} value={s}>{s || "global"}</option>)}</select></td>
                <td style={{ padding: "4px 8px" }}><input type="number" value={r.month_from} onChange={(e) => update(i, { month_from: Number(e.target.value) })} style={inp(56)} /></td>
                <td style={{ padding: "4px 8px" }}><input type="number" value={r.month_to} onChange={(e) => update(i, { month_to: Number(e.target.value) })} style={inp(56)} /></td>
                <td style={{ padding: "4px 8px" }}><input type="number" step="any" value={r.value} onChange={(e) => update(i, { value: Number(e.target.value) })} style={inp(96)} /></td>
                <td style={{ padding: "4px 8px" }}><button onClick={() => removeRow(i)} style={{ background: "none", border: "none", color: "#A32D2D", cursor: "pointer", fontSize: 13 }} aria-label="Remove">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>Rates are 0–1; arpu_monthly is in cents. A missing driver is a hard error at compute time.</p>
    </div>
  );
}

function Weights() {
  const [rows, setRows] = useState<StageWeight[]>([]);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/sales/forecast/pipeline-weights").then((r) => r.json()).then((d) => { if (alive) setRows((d.weights ?? []) as StageWeight[]); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const update = (i: number, patch: Partial<StageWeight>) => setRows((p) => p.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const save = async () => {
    setSaving(true); setNote(null);
    try {
      const payload = rows.map((r) => ({ stage_id: r.stage_id, win_probability: r.win_probability, expected_lag_days: r.expected_lag_days, is_active: r.is_active }));
      const r = await fetch("/api/sales/forecast/pipeline-weights", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ weights: payload }) });
      if (!r.ok) { setNote("Save failed."); return; }
      setNote("Saved.");
    } catch { setNote("Save failed."); } finally { setSaving(false); }
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
        <button onClick={() => void save()} disabled={saving} style={btn(NAVY, "#fff")}>{saving ? "Saving…" : "Save weights"}</button>
        {note && <span style={{ fontSize: 12, color: /fail/i.test(note) ? "#A32D2D" : "#0F6E56" }}>{note}</span>}
      </div>
      <div style={{ overflowX: "auto", border: "0.5px solid var(--border)", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ background: "#F6F8FB" }}>{["Stage", "Win probability", "Lag (days)", "Active"].map((h) => <th key={h} style={{ textAlign: "left", padding: "7px 10px", fontSize: 10.5, color: MUTED, textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.stage_id} style={{ borderTop: "0.5px solid #F1F4F9" }}>
                <td style={{ padding: "6px 10px", color: NAVY }}>{r.stage_name}{r.is_won && <span style={{ fontSize: 9, marginLeft: 6, background: "#E1F5EE", color: "#0F6E56", borderRadius: 4, padding: "1px 4px" }}>WON</span>}</td>
                <td style={{ padding: "4px 8px" }}><input type="number" step="0.01" min="0" max="1" value={r.win_probability} onChange={(e) => update(i, { win_probability: Number(e.target.value) })} style={inp(80)} /></td>
                <td style={{ padding: "4px 8px" }}><input type="number" min="0" value={r.expected_lag_days} onChange={(e) => update(i, { expected_lag_days: Number(e.target.value) })} style={inp(70)} /></td>
                <td style={{ padding: "4px 8px" }}><input type="checkbox" checked={r.is_active} onChange={(e) => update(i, { is_active: e.target.checked })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Variance({ scenarioId }: { scenarioId: string | null }) {
  const [rows, setRows] = useState<VarianceRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!scenarioId) return;
    fetch(`/api/sales/forecast/variance?scenario=${scenarioId}`).then((r) => r.json()).then((d) => { if (alive) { setRows((d.rows ?? []) as VarianceRow[]); setLoaded(true); } }).catch(() => {});
    return () => { alive = false; };
  }, [scenarioId]);
  if (!scenarioId) return <p style={{ fontSize: 12.5, color: MUTED }}>Select a scenario.</p>;
  if (loaded && rows.length === 0) return <p style={{ fontSize: 12.5, color: MUTED }}>No elapsed months with actuals to compare yet — compute a snapshot, then check back after a month of actuals.</p>;
  return (
    <div style={{ overflowX: "auto", border: "0.5px solid var(--border)", borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
        <thead><tr style={{ background: "#F6F8FB" }}>{["Month", "Projected", "Actual", "Δ", "Δ%"].map((h) => <th key={h} style={{ textAlign: "left", padding: "7px 10px", fontSize: 10.5, color: MUTED, textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month} style={{ borderTop: "0.5px solid #F1F4F9" }}>
              <td style={{ padding: "6px 10px", color: NAVY }}>{r.month}</td>
              <td style={{ padding: "6px 10px" }}>{money(r.projectedMrrCents)}</td>
              <td style={{ padding: "6px 10px" }}>{money(r.actualMrrCents)}</td>
              <td style={{ padding: "6px 10px", color: r.deltaCents >= 0 ? "#0F6E56" : "#A32D2D" }}>{r.deltaCents >= 0 ? "+" : ""}{money(r.deltaCents)}</td>
              <td style={{ padding: "6px 10px", color: (r.deltaPct ?? 0) >= 0 ? "#0F6E56" : "#A32D2D" }}>{r.deltaPct != null ? `${(r.deltaPct * 100).toFixed(1)}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const btn = (bg: string, color: string): CSSProperties => ({ fontSize: 12, fontWeight: 600, color, background: bg, border: "none", borderRadius: 8, padding: "7px 13px", cursor: "pointer" });
const inp = (w: number): CSSProperties => ({ width: w, fontSize: 12, padding: "5px 7px", borderRadius: 6, border: "0.5px solid var(--border)" });
