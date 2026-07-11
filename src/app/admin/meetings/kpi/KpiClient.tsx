"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const NAVY = "#0A1A40", BLUE = "#1A6CE4", MUTED = "var(--muted-foreground)";
type Period = "weekly" | "monthly" | "quarterly" | "yearly";
interface Dept { id: string; name: string }
interface Def { id: string; label: string; unit: string; department_id: string }
interface Rollup { kpi_id: string; label: string; unit: string; actual: number; goal: number; pct: number | null; owed: number }

const shortWeek = (w: string) => { const d = new Date(`${w}T00:00:00`); return `${d.getMonth() + 1}/${d.getDate()}`; };

export function KpiClient({ departments, isAdmin }: { departments: Dept[]; isAdmin: boolean }) {
  const [dept, setDept] = useState(departments[0]?.id ?? "");
  const [tab, setTab] = useState<"input" | Period>("input");

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div>
          <Link href="/admin/meetings" style={{ fontSize: 12, color: BLUE, textDecoration: "none" }}>← Meetings</Link>
          <h1 style={{ fontSize: 21, fontWeight: 600, color: NAVY, margin: "6px 0 0" }}>KPI Dashboard</h1>
        </div>
        <select value={dept} onChange={(e) => setDept(e.target.value)} style={{ fontSize: 12.5, padding: "6px 10px", borderRadius: 8, border: "0.5px solid var(--border)" }}>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: 14, borderBottom: "0.5px solid var(--border)", marginBottom: 16, flexWrap: "wrap" }}>
        {(["input", "weekly", "monthly", "quarterly", "yearly"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ paddingBottom: 8, fontSize: 12.5, background: "none", border: "none", cursor: "pointer", textTransform: "capitalize", color: tab === t ? BLUE : MUTED, fontWeight: tab === t ? 600 : 400, borderBottom: tab === t ? `2px solid ${BLUE}` : "2px solid transparent" }}>
            {t === "input" ? "Data Input" : t}
          </button>
        ))}
      </div>

      {tab === "input" ? <DataInput dept={dept} /> : <RollupView dept={dept} period={tab} isAdmin={isAdmin} />}
    </div>
  );
}

function DataInput({ dept }: { dept: string }) {
  const [defs, setDefs] = useState<Def[]>([]);
  const [weeks, setWeeks] = useState<string[]>([]);
  const [entries, setEntries] = useState<Record<string, Record<string, number>>>({});
  const [newKpi, setNewKpi] = useState({ key: "", label: "" });

  const load = useCallback(() => {
    if (!dept) return;
    fetch(`/api/admin/meetings/kpi?dept=${dept}`).then((r) => r.json()).then((d) => {
      setDefs(d.definitions ?? []); setWeeks(d.weeks ?? []); setEntries(d.entries ?? {});
    }).catch(() => {});
  }, [dept]);
  useEffect(() => { load(); }, [load]);

  const saveCell = async (kpiId: string, week: string, value: string) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    setEntries((p) => ({ ...p, [kpiId]: { ...(p[kpiId] ?? {}), [week]: num } }));
    await fetch("/api/admin/meetings/kpi/entry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kpi_id: kpiId, week_start: week, value: num }) }).catch(() => {});
  };
  const addKpi = async () => {
    if (!newKpi.key.trim() || !newKpi.label.trim()) return;
    await fetch("/api/admin/meetings/kpi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ department_id: dept, key: newKpi.key.trim(), label: newKpi.label.trim() }) }).catch(() => {});
    setNewKpi({ key: "", label: "" }); load();
  };

  return (
    <div>
      {defs.length === 0 ? <p style={{ fontSize: 12.5, color: MUTED, marginBottom: 12 }}>No KPIs for this department yet. Add one below (real definitions import from the workbooks once shared).</p> : (
        <div style={{ overflowX: "auto", border: "0.5px solid var(--border)", borderRadius: 10, marginBottom: 14 }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
            <thead><tr style={{ background: "#F6F8FB" }}>
              <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 10.5, color: MUTED, textTransform: "uppercase", position: "sticky", left: 0, background: "#F6F8FB" }}>KPI</th>
              {weeks.map((w) => <th key={w} style={{ padding: "8px 8px", fontSize: 10.5, color: MUTED }}>{shortWeek(w)}</th>)}
            </tr></thead>
            <tbody>
              {defs.map((def) => (
                <tr key={def.id} style={{ borderTop: "0.5px solid #F1F4F9" }}>
                  <td style={{ padding: "6px 10px", color: NAVY, whiteSpace: "nowrap", position: "sticky", left: 0, background: "#fff" }}>{def.label}</td>
                  {weeks.map((w) => (
                    <td key={w} style={{ padding: "2px 4px" }}>
                      <input type="number" step="any" defaultValue={entries[def.id]?.[w] ?? ""} onBlur={(e) => { if (e.target.value !== "") void saveCell(def.id, w, e.target.value); }}
                        style={{ width: 56, fontSize: 12, padding: "4px 5px", borderRadius: 5, border: "0.5px solid var(--border)", textAlign: "right" }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input value={newKpi.key} onChange={(e) => setNewKpi((p) => ({ ...p, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") }))} placeholder="key_snake_case" style={{ fontSize: 12, padding: "6px 9px", borderRadius: 7, border: "0.5px solid var(--border)", width: 160 }} />
        <input value={newKpi.label} onChange={(e) => setNewKpi((p) => ({ ...p, label: e.target.value }))} placeholder="KPI label" style={{ fontSize: 12, padding: "6px 9px", borderRadius: 7, border: "0.5px solid var(--border)", width: 200 }} />
        <button onClick={() => void addKpi()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: BLUE, border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}>+ Add KPI</button>
      </div>
    </div>
  );
}

function RollupView({ dept, period, isAdmin }: { dept: string; period: Period; isAdmin: boolean }) {
  const [rows, setRows] = useState<Rollup[]>([]);
  const load = useCallback(() => {
    if (!dept) return;
    fetch(`/api/admin/meetings/kpi/rollup?period=${period}&dept=${dept}`).then((r) => r.json()).then((d) => setRows(d.rows ?? [])).catch(() => {});
  }, [dept, period]);
  useEffect(() => { load(); }, [load]);

  const pin = async (kpiId: string) => {
    const v = window.prompt("Pin goal value (blank clears to auto):");
    if (v === null) return;
    const body = v.trim() === "" ? { kpi_id: kpiId, period, mode: "auto", pinned_value: null } : { kpi_id: kpiId, period, mode: "pinned", pinned_value: Number(v) };
    await fetch("/api/admin/meetings/kpi/goal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
    load();
  };

  const barColor = (pct: number | null) => pct == null ? "#B4B2A9" : pct >= 100 ? "#1D9E75" : pct >= 70 ? "#378ADD" : "#EF9F27";

  if (rows.length === 0) return <p style={{ fontSize: 12.5, color: MUTED }}>No KPIs to roll up yet.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((r) => {
        const frac = r.goal > 0 ? Math.min(1.2, r.actual / r.goal) : 0;
        return (
          <div key={r.kpi_id} style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: NAVY, flex: 1 }}>{r.label}</span>
              <span style={{ fontSize: 12.5, color: NAVY, fontVariantNumeric: "tabular-nums" }}>{r.actual} / {r.goal}</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, background: "#F1EFE8", color: "#5F5E5A", borderRadius: 6, padding: "2px 8px" }}>{r.pct != null ? `${r.pct}%` : "—"}</span>
              {r.owed > 0 && <span style={{ fontSize: 10.5, color: "#A32D2D" }}>owed {r.owed}</span>}
              {isAdmin && <button onClick={() => void pin(r.kpi_id)} style={{ fontSize: 10.5, color: BLUE, background: "#E6F1FB", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>Pin</button>}
            </div>
            <div style={{ height: 8, background: "#F1EFE8", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.round(frac * 83)}%`, background: barColor(r.pct), borderRadius: 99 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
