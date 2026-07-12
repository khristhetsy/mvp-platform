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
  // Default to the first non-admin department (that's where seeded KPIs live);
  // Admin has no KPI definitions so it would otherwise open on an empty grid.
  const defaultDept = (departments.find((d) => d.name.toLowerCase() !== "admin") ?? departments[0])?.id ?? "";
  const [dept, setDept] = useState(defaultDept);
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

interface Agent { id: string; name: string; position: number }
interface Cell { goal: number | null; actual: number | null }
type CellMap = Record<string, Record<string, Record<string, Cell>>>; // [kpiId][agentId][week]

const owedColor = (owed: number) => owed > 0 ? "#A32D2D" : owed < 0 ? "#1D9E75" : MUTED;

function DataInput({ dept }: { dept: string }) {
  const [defs, setDefs] = useState<Def[]>([]);
  const [weeks, setWeeks] = useState<string[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [cells, setCells] = useState<CellMap>({});
  const [newKpi, setNewKpi] = useState({ key: "", label: "" });
  const [newAgent, setNewAgent] = useState("");

  const load = useCallback(() => {
    if (!dept) return;
    fetch(`/api/admin/meetings/kpi?dept=${dept}`).then((r) => r.json()).then((d) => {
      setDefs(d.definitions ?? []); setWeeks(d.weeks ?? []); setAgents(d.agents ?? []); setCells(d.agentEntries ?? {});
    }).catch(() => {});
  }, [dept]);
  useEffect(() => { load(); }, [load]);

  const saveCell = async (kpiId: string, agentId: string, week: string, field: "goal" | "actual", raw: string) => {
    const num = raw.trim() === "" ? null : Number(raw);
    if (num !== null && !Number.isFinite(num)) return;
    setCells((p) => {
      const prevCell = p[kpiId]?.[agentId]?.[week] ?? { goal: null, actual: null };
      return { ...p, [kpiId]: { ...(p[kpiId] ?? {}), [agentId]: { ...(p[kpiId]?.[agentId] ?? {}), [week]: { ...prevCell, [field]: num } } } };
    });
    await fetch("/api/admin/meetings/kpi/agent-entry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kpi_id: kpiId, agent_id: agentId, week_start: week, [field]: num }) }).catch(() => {});
  };
  const addKpi = async () => {
    if (!newKpi.key.trim() || !newKpi.label.trim()) return;
    await fetch("/api/admin/meetings/kpi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ department_id: dept, key: newKpi.key.trim(), label: newKpi.label.trim() }) }).catch(() => {});
    setNewKpi({ key: "", label: "" }); load();
  };
  const addAgent = async () => {
    if (!newAgent.trim()) return;
    await fetch("/api/admin/meetings/kpi/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ department_id: dept, name: newAgent.trim() }) }).catch(() => {});
    setNewAgent(""); load();
  };

  const numInput = (defVal: number | null, onSave: (v: string) => void, tint: string) => (
    <input type="number" step="any" defaultValue={defVal ?? ""} onBlur={(e) => onSave(e.target.value)}
      style={{ width: 44, fontSize: 11.5, padding: "3px 4px", borderRadius: 4, border: "0.5px solid var(--border)", textAlign: "right", color: tint }} />
  );

  return (
    <div>
      {defs.length === 0 ? (
        <p style={{ fontSize: 12.5, color: MUTED, marginBottom: 12 }}>No KPIs for this department yet. Add one below.</p>
      ) : agents.length === 0 ? (
        <p style={{ fontSize: 12.5, color: MUTED, marginBottom: 12 }}>Add an agent below to start entering weekly goals and actuals.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 16 }}>
          {defs.map((def) => (
            <div key={def.id} style={{ border: "0.5px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ background: "#F6F8FB", padding: "8px 12px", borderBottom: "0.5px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{def.label}</span>
                <span style={{ fontSize: 10, color: MUTED }}>goal · actual · owed</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", fontSize: 11.5, fontVariantNumeric: "tabular-nums", minWidth: "100%" }}>
                  <thead><tr>
                    <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, color: MUTED, textTransform: "uppercase", position: "sticky", left: 0, background: "#fff", minWidth: 130 }}>Agent</th>
                    {weeks.map((w) => <th key={w} style={{ padding: "6px 8px", fontSize: 10, color: MUTED, fontWeight: 500, borderLeft: "0.5px solid #F1F4F9" }}>wk {shortWeek(w)}</th>)}
                  </tr></thead>
                  <tbody>
                    {agents.map((ag) => (
                      <tr key={ag.id} style={{ borderTop: "0.5px solid #F1F4F9" }}>
                        <td style={{ padding: "5px 10px", color: NAVY, whiteSpace: "nowrap", position: "sticky", left: 0, background: "#fff" }}>{ag.name}</td>
                        {weeks.map((w) => {
                          const c = cells[def.id]?.[ag.id]?.[w] ?? { goal: null, actual: null };
                          const owed = (c.goal ?? 0) - (c.actual ?? 0);
                          const hasData = c.goal !== null || c.actual !== null;
                          return (
                            <td key={w} style={{ padding: "3px 6px", borderLeft: "0.5px solid #F1F4F9", textAlign: "center" }}>
                              <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                                {numInput(c.goal, (v) => void saveCell(def.id, ag.id, w, "goal", v), NAVY)}
                                {numInput(c.actual, (v) => void saveCell(def.id, ag.id, w, "actual", v), BLUE)}
                              </div>
                              <div style={{ fontSize: 10, marginTop: 2, color: hasData ? owedColor(owed) : "transparent" }}>{hasData ? (owed > 0 ? `owed ${owed}` : owed < 0 ? `+${-owed}` : "met") : "·"}</div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input value={newAgent} onChange={(e) => setNewAgent(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void addAgent(); }} placeholder="Agent name" style={{ fontSize: 12, padding: "6px 9px", borderRadius: 7, border: "0.5px solid var(--border)", width: 170 }} />
          <button onClick={() => void addAgent()} style={{ fontSize: 12, fontWeight: 600, color: BLUE, background: "#E6F1FB", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}>+ Agent</button>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <input value={newKpi.key} onChange={(e) => setNewKpi((p) => ({ ...p, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") }))} placeholder="key_snake_case" style={{ fontSize: 12, padding: "6px 9px", borderRadius: 7, border: "0.5px solid var(--border)", width: 150 }} />
          <input value={newKpi.label} onChange={(e) => setNewKpi((p) => ({ ...p, label: e.target.value }))} placeholder="KPI label" style={{ fontSize: 12, padding: "6px 9px", borderRadius: 7, border: "0.5px solid var(--border)", width: 190 }} />
          <button onClick={() => void addKpi()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: BLUE, border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}>+ Add KPI</button>
        </div>
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
