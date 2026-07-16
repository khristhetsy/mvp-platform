"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
type SubTab = "overview" | "comparison" | "assumptions" | "projection" | "weights" | "variance" | "journal";
type MetricKey = "mrr" | "arr" | "proj" | "variance";

export function ForecastClient(props: {
  scenarios: Scenario[];
  activeScenarioId: string | null;
  initialSnapshot: { meta: SnapshotMeta; output: ForecastOutput } | null;
  anchor: ActualsAnchor;
  actualsSeries: ActualsPoint[];
  canToggleScope?: boolean;
  viewScope: "all" | "mine";
}) {
  const router = useRouter();
  const scopeQ = `scope=${props.viewScope}`;
  const [tab, setTab] = useState<SubTab>("overview");
  const [scenarioId, setScenarioId] = useState<string | null>(props.activeScenarioId);
  const [snapshot, setSnapshot] = useState<{ meta: SnapshotMeta; output: ForecastOutput } | null>(props.initialSnapshot);
  const [computing, setComputing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [drawerMetric, setDrawerMetric] = useState<MetricKey | null>(null);

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
      const r = await fetch(`/api/sales/forecast/scenarios/${scenarioId}/compute?${scopeQ}`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) { setMsg(typeof d.error === "string" ? d.error : "Compute failed."); return; }
      const s = await fetch(`/api/sales/forecast/scenarios/${scenarioId}/snapshots?latest=1&${scopeQ}`).then((x) => x.json());
      if (s.output) setSnapshot({ meta: s.snapshot, output: s.output });
      setMsg("Forecast computed.");
    } catch { setMsg("Compute failed."); }
    finally { setComputing(false); }
  }, [scenarioId, scopeQ]);

  // Refresh the shown snapshot when switching scenarios.
  useEffect(() => {
    let alive = true;
    if (!scenarioId) return;
    fetch(`/api/sales/forecast/scenarios/${scenarioId}/snapshots?latest=1&${scopeQ}`).then((x) => x.json()).then((s) => {
      if (alive) setSnapshot(s.output ? { meta: s.snapshot, output: s.output } : null);
    }).catch(() => {});
    return () => { alive = false; };
  }, [scenarioId, scopeQ]);

  const TABS: Array<[SubTab, string]> = [
    ["overview", "Overview"], ["comparison", "Comparison"], ["assumptions", "Assumptions"],
    ["projection", "Projection"], ["weights", "Pipeline Weights"], ["variance", "Variance"], ["journal", "Journal"],
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: NAVY, margin: 0 }}>Sales Forecast &amp; Projection</h1>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {props.canToggleScope && (
            <div style={{ display: "inline-flex", border: "0.5px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
              {([["all", "All company"], ["mine", "My pipeline"]] as const).map(([val, label]) => (
                <button key={val} onClick={() => router.push(`/admin/sales/forecast?scope=${val}`)}
                  style={{ fontSize: 12, fontWeight: props.viewScope === val ? 600 : 400, color: props.viewScope === val ? "#fff" : MUTED, background: props.viewScope === val ? BLUE : "transparent", border: "none", padding: "6px 12px", cursor: "pointer" }}>{label}</button>
              ))}
            </div>
          )}
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
          snapshot={snapshot} actualsByMonth={actualsByMonth} onOpenInsight={setDrawerMetric} />
      )}
      {tab === "comparison" && <Comparison />}
      {tab === "assumptions" && <Assumptions scenarioId={scenarioId} onComputed={compute} />}
      {tab === "projection" && <Projection snapshot={snapshot} scopeQ={scopeQ} />}
      {tab === "weights" && <Weights />}
      {tab === "variance" && <Variance scenarioId={scenarioId} scopeQ={scopeQ} />}
      {tab === "journal" && <Journal />}

      {drawerMetric && scenarioId && (
        <InsightDrawer metric={drawerMetric} scenarioId={scenarioId} onClose={() => setDrawerMetric(null)}
          onAction={(key) => {
            setDrawerMetric(null);
            if (key === "edit_assumptions") setTab("assumptions");
            else if (key === "compute_forecast") void compute();
            else if (key === "open_pipeline") setTab("projection");
            else if (key === "view_accounts") window.location.href = "/admin/sales/opportunities";
          }} />
      )}

      {scenario && (
        <p style={{ fontSize: 11, color: MUTED, marginTop: 16 }}>
          Internal revenue planning only — projections, not funding-probability or outcome claims.
          {snapshot ? ` Snapshot ${snapshot.meta.id.slice(0, 8)} · engine ${snapshot.meta.engine_version} · ${new Date(snapshot.meta.computed_at).toLocaleString()}` : " No snapshot yet — Compute forecast to generate one."}
        </p>
      )}
    </div>
  );
}

function Card({ label, value, sub, onClick }: { label: string; value: string; sub?: string; onClick?: () => void }) {
  return (
    <div role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      onClick={onClick} onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      style={{ background: "var(--surface-1, #F6F8FB)", borderRadius: 10, padding: "12px 14px", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontSize: 12, color: MUTED, display: "flex", alignItems: "center", gap: 5 }}>{label} <span style={{ color: BRIGHT }} title="AI insight">✦</span></div>
      <div style={{ fontSize: 22, fontWeight: 600, color: NAVY, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function Overview({ currentMrr, currentArr, projectedArr, varianceToDate, snapshot, actualsByMonth, onOpenInsight }: {
  currentMrr: number; currentArr: number; projectedArr: number | null; varianceToDate: number | null;
  snapshot: { meta: SnapshotMeta; output: ForecastOutput } | null; actualsByMonth: Map<string, number>;
  onOpenInsight: (m: MetricKey) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Card label="Current MRR" value={money(currentMrr)} onClick={() => onOpenInsight("mrr")} />
        <Card label="Current ARR" value={money(currentArr)} onClick={() => onOpenInsight("arr")} />
        <Card label="Projected ARR" value={projectedArr != null ? money(projectedArr) : "—"} sub={projectedArr != null ? "end of horizon" : "compute a forecast"} onClick={() => onOpenInsight("proj")} />
        <Card label="Variance to date" value={varianceToDate != null ? `${varianceToDate >= 0 ? "+" : ""}${money(varianceToDate)}` : "—"} sub="actual vs projection" onClick={() => onOpenInsight("variance")} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)", gap: 14, alignItems: "start" }}>
        <div style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 10 }}>MRR — actuals vs projection</div>
          {snapshot ? <MrrChart snapshot={snapshot} actualsByMonth={actualsByMonth} /> : <p style={{ fontSize: 12.5, color: MUTED }}>Compute a forecast to see the projection curve.</p>}
        </div>
        <OpenTasks />
      </div>
    </div>
  );
}

interface Task { id: string; title: string; status: string; due_date: string | null; source_kind?: string | null }
function OpenTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => {
    fetch("/api/sales/tasks?scope=all").then((r) => r.json()).then((d) => setTasks(((d.tasks ?? []) as Task[]).filter((t) => t.status === "open").slice(0, 8))).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    if (!title.trim()) return;
    setAdding(true);
    try {
      await fetch("/api/sales/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim() }) });
      setTitle(""); load();
    } finally { setAdding(false); }
  };
  const complete = async (id: string) => {
    await fetch(`/api/sales/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "done" }) }).catch(() => {});
    load();
  };
  return (
    <div style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 8 }}>Open tasks</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void add(); }} placeholder="New task…" style={{ flex: 1, ...inp(0), width: "auto" }} />
        <button onClick={() => void add()} disabled={adding} style={btn(BLUE, "#fff")}>+</button>
      </div>
      {tasks.length === 0 ? <p style={{ fontSize: 12, color: MUTED }}>No open tasks.</p> : tasks.map((t) => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: "0.5px solid #F1F4F9", fontSize: 12.5 }}>
          <input type="checkbox" onChange={() => void complete(t.id)} aria-label={`Complete ${t.title}`} />
          <span style={{ color: NAVY, flex: 1 }}>{t.title}</span>
          {t.source_kind && t.source_kind !== "manual" && <span style={{ fontSize: 9, background: "#EEF3FC", color: "#185FA5", borderRadius: 4, padding: "1px 5px" }}>{t.source_kind === "ai_insight" ? "AI" : t.source_kind}</span>}
        </div>
      ))}
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

function Projection({ snapshot, scopeQ }: { snapshot: { meta: SnapshotMeta; output: ForecastOutput } | null; scopeQ: string }) {
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
        <a href={`/api/sales/forecast/export?snapshot=${snapshot.meta.id}&format=csv&${scopeQ}`} style={{ fontSize: 12, color: BLUE, textDecoration: "none" }}>Export CSV</a>
        <a href={`/api/sales/forecast/export?snapshot=${snapshot.meta.id}&format=xlsx&${scopeQ}`} style={{ fontSize: 12, color: BLUE, textDecoration: "none" }}>Export XLSX</a>
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

function Variance({ scenarioId, scopeQ }: { scenarioId: string | null; scopeQ: string }) {
  const [rows, setRows] = useState<VarianceRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!scenarioId) return;
    fetch(`/api/sales/forecast/variance?scenario=${scenarioId}&${scopeQ}`).then((r) => r.json()).then((d) => { if (alive) { setRows((d.rows ?? []) as VarianceRow[]); setLoaded(true); } }).catch(() => {});
    return () => { alive = false; };
  }, [scenarioId, scopeQ]);
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

interface PeriodPoint { label: string; newMrrCents: number; endingMrrCents: number; count: number }
interface ComparisonData { grain: string; series: PeriodPoint[]; current: PeriodPoint | null; previous: PeriodPoint | null; deltaPct: number | null; footnote: string }
function Comparison() {
  const [grain, setGrain] = useState<"weekly" | "monthly" | "quarterly" | "yearly">("monthly");
  const [data, setData] = useState<ComparisonData | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/sales/comparison?grain=${grain}`).then((r) => r.json()).then((d) => { if (alive) setData(d as ComparisonData); }).catch(() => {});
    return () => { alive = false; };
  }, [grain]);
  const isWeekly = grain === "weekly";
  const val = (p: PeriodPoint | null) => (p ? (isWeekly ? p.count : p.newMrrCents) : 0);
  const fmt = (n: number) => (isWeekly ? String(n) : money(n));
  const series = data?.series ?? [];
  const maxV = Math.max(1, ...series.map((p) => (isWeekly ? p.count : p.newMrrCents)));
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {(["weekly", "monthly", "quarterly", "yearly"] as const).map((g) => (
          <button key={g} onClick={() => setGrain(g)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 99, border: g === grain ? `1px solid ${BRIGHT}` : "0.5px solid var(--border)", background: g === grain ? "#E6F1FB" : "transparent", color: g === grain ? "#0C447C" : MUTED, cursor: "pointer", textTransform: "capitalize" }}>{g}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
        <Card label={isWeekly ? "New opps (current)" : "New MRR (current)"} value={fmt(val(data?.current ?? null))} sub={data?.current?.label} />
        <Card label="Previous" value={fmt(val(data?.previous ?? null))} sub={data?.previous?.label} />
        <Card label="Change" value={data?.deltaPct != null ? `${data.deltaPct >= 0 ? "+" : ""}${(data.deltaPct * 100).toFixed(1)}%` : "—"} />
      </div>
      <div style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140 }}>
          {series.map((p, i) => (
            <div key={p.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: "70%", height: `${((isWeekly ? p.count : p.newMrrCents) / maxV) * 110}px`, background: i === series.length - 1 ? BLUE : "#B5D4F4", borderRadius: "4px 4px 0 0" }} />
              <span style={{ fontSize: 9, color: MUTED, whiteSpace: "nowrap" }}>{p.label.slice(-5)}</span>
            </div>
          ))}
        </div>
      </div>
      {data && <p style={{ fontSize: 11, color: MUTED, marginTop: 10 }}>{data.footnote}</p>}
    </div>
  );
}

interface JournalEntry { id: string; entry_type: string; body: string; tags: string[]; pinned: boolean; author_name: string | null; created_at: string }
const JTYPES: Array<[string, string]> = [["all", "All"], ["note", "Notes"], ["win", "Wins"], ["loss", "Losses"], ["deal", "Deals"], ["system", "System"]];
function Journal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [filter, setFilter] = useState("all");
  const [type, setType] = useState<"note" | "win" | "loss" | "deal">("note");
  const [body, setBody] = useState("");
  const load = useCallback((f: string) => {
    fetch(`/api/sales/journal?filter=${f}`).then((r) => r.json()).then((d) => setEntries((d.entries ?? []) as JournalEntry[])).catch(() => {});
  }, []);
  useEffect(() => { load(filter); }, [filter, load]);
  const add = async () => {
    if (!body.trim()) return;
    await fetch("/api/sales/journal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entry_type: type, body: body.trim() }) }).catch(() => {});
    setBody(""); load(filter);
  };
  const pin = async (id: string, pinned: boolean) => {
    await fetch(`/api/sales/journal/${id}/pin`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned }) }).catch(() => {});
    load(filter);
  };
  const TONE: Record<string, { bg: string; c: string }> = { win: { bg: "#E1F5EE", c: "#0F6E56" }, loss: { bg: "#FCEBEB", c: "#A32D2D" }, deal: { bg: "#EEF3FC", c: "#185FA5" }, system: { bg: "#F1EFE8", c: "#5F5E5A" }, note: { bg: "#FAEEDA", c: "#854F0B" } };
  return (
    <div>
      <div style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 12, padding: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)} style={inp(90)}>
            <option value="note">Note</option><option value="win">Win</option><option value="loss">Loss</option><option value="deal">Deal</option>
          </select>
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void add(); }} rows={2} placeholder="What happened? Use #tags. ⌘/Ctrl+Enter to save." style={{ width: "100%", fontSize: 12.5, padding: "7px 9px", borderRadius: 8, border: "0.5px solid var(--border)" }} />
        <div style={{ marginTop: 8 }}><button onClick={() => void add()} style={btn(NAVY, "#fff")}>Add entry</button></div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {JTYPES.map(([k, label]) => <button key={k} onClick={() => setFilter(k)} style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 99, border: k === filter ? `1px solid ${BRIGHT}` : "0.5px solid var(--border)", background: k === filter ? "#E6F1FB" : "transparent", color: k === filter ? "#0C447C" : MUTED, cursor: "pointer" }}>{label}</button>)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {entries.length === 0 && <p style={{ fontSize: 12.5, color: MUTED }}>No entries yet.</p>}
        {entries.map((e) => {
          const t = TONE[e.entry_type] ?? TONE.note;
          return (
            <div key={e.id} style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 600, background: t.bg, color: t.c, borderRadius: 5, padding: "1px 7px", textTransform: "uppercase" }}>{e.entry_type}</span>
                <span style={{ fontSize: 11, color: MUTED }}>{e.author_name ?? "System"} · {new Date(e.created_at).toLocaleString()}</span>
                <button onClick={() => void pin(e.id, !e.pinned)} title="Pin" style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: e.pinned ? BRIGHT : MUTED }}>{e.pinned ? "★" : "☆"}</button>
              </div>
              <div style={{ fontSize: 12.5, color: NAVY, whiteSpace: "pre-wrap" }}>{e.body}</div>
              {e.tags.length > 0 && <div style={{ marginTop: 4, display: "flex", gap: 5, flexWrap: "wrap" }}>{e.tags.map((tag) => <span key={tag} style={{ fontSize: 10, color: "#185FA5" }}>#{tag}</span>)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface Insight { metric_key: string; narrative: string; model: string | null; drivers: Array<{ label: string; value: string }>; suggested_actions: Array<{ text: string; action_key: string }>; cached: boolean }
function InsightDrawer({ metric, scenarioId, onClose, onAction }: { metric: MetricKey; scenarioId: string; onClose: () => void; onAction: (key: string) => void }) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback((force: boolean) => {
    const url = `/api/sales/forecast/insights/${metric}${force ? "/refresh" : ""}?scenario=${scenarioId}`;
    fetch(url, { method: force ? "POST" : "GET" }).then((r) => r.json()).then((d) => setInsight(d.insight ?? null)).catch(() => {}).finally(() => setLoading(false));
  }, [metric, scenarioId]);
  useEffect(() => { load(false); }, [load]);
  const LABEL: Record<string, string> = { mrr: "Current MRR", arr: "Current ARR", proj: "Projected ARR", variance: "Variance to date" };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`AI insight — ${LABEL[metric]}`} style={{ width: "min(440px, 96vw)", height: "100%", background: "#fff", overflowY: "auto", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>✦ AI Sales — {LABEL[metric]}</div>
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
                {insight.suggested_actions.map((a, i) => <button key={i} onClick={() => onAction(a.action_key)} style={btn("#EEF3FC", BLUE)}>{a.text}</button>)}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => { setLoading(true); load(true); }} style={btn("#F1EFE8", NAVY)}>↻ Regenerate</button>
              <span style={{ fontSize: 10.5, color: MUTED }}>{insight.model ? `${insight.cached ? "cached" : "fresh"} · ${insight.model}` : "heuristic (AI not configured)"}</span>
            </div>
          </div>
        ) : <p style={{ fontSize: 12.5, color: MUTED }}>No insight available.</p>}
        <p style={{ fontSize: 10.5, color: MUTED, marginTop: 20, lineHeight: 1.5 }}>AI Sales offers read-only commentary on internal subscription-revenue projections. Projections and scenarios only — never guarantees or funding-outcome claims. All actions require a human click.</p>
      </div>
    </div>
  );
}

const btn = (bg: string, color: string): CSSProperties => ({ fontSize: 12, fontWeight: 600, color, background: bg, border: "none", borderRadius: 8, padding: "7px 13px", cursor: "pointer" });
const inp = (w: number): CSSProperties => ({ width: w || undefined, fontSize: 12, padding: "5px 7px", borderRadius: 6, border: "0.5px solid var(--border)" });
