"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FeatureControlsClient } from "@/components/admin/FeatureControlsClient";

type Dept = { id: string; key: string; name: string; hubKey: string; isAdmin: boolean };
type Feature = { id: string; key: string; label: string; hubKey: string; path: string; sortOrder: number };
type Matrix = { departments: Dept[]; features: Feature[]; grants: Record<string, boolean> };
type Member = { userId: string; name: string | null; email: string | null; departmentIds: string[] };
type Audit = { id: number; actorName: string | null; action: string; departmentName: string | null; featureLabel: string | null; targetName: string | null; createdAt: string };

const HUB_LABEL: Record<string, string> = { general_admin: "General Admin", investor_relations: "Investor Relations", marketing: "Marketing", sales: "Sales" };
const navy = "#0A1A40", royal = "#1A6CE4";
const TABS = [["global", "Global Features"], ["departments", "Departments"], ["members", "Members"], ["audit", "Audit Log"]] as const;

export function DepartmentsControls() {
  const [tab, setTab] = useState<string>("departments");
  return (
    <div>
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid #E4E8F0", marginBottom: 18 }}>
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding: "9px 16px", fontSize: 13, fontWeight: 600, color: tab === key ? navy : "#6B7690", background: "none", border: "none", borderBottom: tab === key ? `2px solid ${royal}` : "2px solid transparent", marginBottom: -1, cursor: "pointer" }}>{label}</button>
        ))}
      </div>
      {tab === "global" && <FeatureControlsClient />}
      {tab === "departments" && <DepartmentMatrix />}
      {tab === "members" && <MembersTab />}
      {tab === "audit" && <AuditTab />}
    </div>
  );
}

/* ── Departments matrix ────────────────────────────────────────────────────── */

function DepartmentMatrix() {
  const [data, setData] = useState<Matrix | null>(null);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [viewAs, setViewAs] = useState<string>("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/departments/matrix");
    if (res.ok) { const d: Matrix = await res.json(); setData(d); setDraft({ ...d.grants }); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load matrix on mount
  useEffect(() => { void load(); }, [load]);

  const changes = useMemo(() => {
    if (!data) return [] as Array<{ departmentId: string; featureId: string; enabled: boolean }>;
    const out: Array<{ departmentId: string; featureId: string; enabled: boolean }> = [];
    for (const d of data.departments) {
      if (d.isAdmin) continue;
      for (const f of data.features) {
        const k = `${d.id}:${f.id}`;
        const cur = draft[k] ?? false, orig = data.grants[k] ?? false;
        if (cur !== orig) out.push({ departmentId: d.id, featureId: f.id, enabled: cur });
      }
    }
    return out;
  }, [data, draft]);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/departments/grants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grants: changes }) });
      if (res.ok) await load();
    } finally { setBusy(false); }
  }

  if (!data) return <p style={{ fontSize: 13, color: "#6B7690" }}>Loading…</p>;
  const nonAdmin = data.departments.filter((d) => !d.isAdmin);
  const byHub = data.features.reduce((acc, f) => { (acc[f.hubKey] ??= []).push(f); return acc; }, {} as Record<string, Feature[]>);
  const grid = `1.7fr repeat(${data.departments.length}, 1fr)`;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: "#B45309", background: "#FDF3E3", border: "1px solid #F4D9A0", borderRadius: 10, padding: "8px 12px" }}>
          <b>Fail-closed:</b> a feature with no toggle on is denied for that department. Admin is full-access by code.
        </div>
        <select value={viewAs} onChange={(e) => setViewAs(e.target.value)} style={sel}>
          <option value="">View as… (preview)</option>
          {nonAdmin.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <div style={{ border: "1px solid #E4E8F0", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
        <div style={{ display: "grid", gridTemplateColumns: grid, background: "#F6F8FB", borderBottom: "1px solid #E4E8F0" }}>
          <div style={{ padding: "10px 14px", fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "#6B7690" }}>Feature</div>
          {data.departments.map((d) => <div key={d.id} style={{ padding: "10px 8px", textAlign: "center", fontSize: 12, fontWeight: 700, color: navy }}>{d.name}</div>)}
        </div>

        {Object.entries(byHub).map(([hub, feats]) => (
          <div key={hub}>
            <div style={{ display: "grid", gridTemplateColumns: grid, background: "#EEF3FC", borderBottom: "1px solid #E4E8F0", borderTop: "1px solid #E4E8F0" }}>
              <div style={{ gridColumn: "1 / -1", padding: "7px 14px", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: royal }}>{HUB_LABEL[hub] ?? hub}</div>
            </div>
            {feats.map((f) => {
              const dim = viewAs && !(draft[`${viewAs}:${f.id}`] ?? false);
              return (
                <div key={f.id} style={{ display: "grid", gridTemplateColumns: grid, borderBottom: "1px solid #F1F4F9", alignItems: "center", opacity: dim ? 0.4 : 1 }}>
                  <div style={{ padding: "9px 14px", fontSize: 12.5 }}>{f.label} <code style={{ fontSize: 10.5, color: "#94a3b8" }}>{f.path}</code></div>
                  {data.departments.map((d) => d.isAdmin ? (
                    <div key={d.id} style={{ textAlign: "center" }}><span style={{ fontSize: 10, color: "#12A150", background: "#E6F6EC", borderRadius: 10, padding: "2px 8px" }}>Full</span></div>
                  ) : (
                    <div key={d.id} style={{ textAlign: "center" }}>
                      <Toggle on={draft[`${d.id}:${f.id}`] ?? false} onChange={(v) => setDraft((p) => ({ ...p, [`${d.id}:${f.id}`]: v }))} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {changes.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: navy, color: "#fff", borderRadius: 10, padding: "10px 16px", marginTop: 12 }}>
          <span style={{ fontSize: 12.5 }}>{changes.length} change{changes.length === 1 ? "" : "s"} staged</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => data && setDraft({ ...data.grants })} style={{ background: "transparent", border: "1px solid rgba(255,255,255,.3)", color: "#fff", borderRadius: 8, padding: "6px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Discard</button>
          <button onClick={save} disabled={busy} style={{ background: royal, border: "none", color: "#fff", borderRadius: 8, padding: "6px 15px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{busy ? "Saving…" : "Save changes"}</button>
        </div>
      )}
    </div>
  );
}

/* ── Members ───────────────────────────────────────────────────────────────── */

function MembersTab() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [m, mx] = await Promise.all([fetch("/api/admin/departments/members"), fetch("/api/admin/departments/matrix")]);
    if (m.ok) setMembers((await m.json()).members);
    if (mx.ok) setDepts((await mx.json()).departments);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load members on mount
  useEffect(() => { void load(); }, [load]);

  async function toggle(userId: string, departmentId: string, member: boolean) {
    setMsg(null);
    setMembers((prev) => prev?.map((u) => u.userId === userId ? { ...u, departmentIds: member ? [...u.departmentIds, departmentId] : u.departmentIds.filter((x) => x !== departmentId) } : u) ?? prev);
    const res = await fetch("/api/admin/departments/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, departmentId, member }) });
    if (!res.ok) { setMsg((await res.json().catch(() => ({}))).error ?? "Failed."); void load(); }
  }

  if (!members) return <p style={{ fontSize: 13, color: "#6B7690" }}>Loading…</p>;
  return (
    <div>
      {msg && <div style={{ fontSize: 12, color: "#A32D2D", marginBottom: 10 }}>{msg}</div>}
      <div style={{ border: "1px solid #E4E8F0", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
        {members.map((u, i) => (
          <div key={u.userId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderTop: i ? "1px solid #F1F4F9" : "none", flexWrap: "wrap" }}>
            <div style={{ minWidth: 200 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{u.name ?? u.email}</div>
              <div style={{ fontSize: 11.5, color: "#6B7690" }}>{u.email}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginLeft: "auto" }}>
              {depts.map((d) => {
                const on = u.departmentIds.includes(d.id);
                return (
                  <button key={d.id} onClick={() => toggle(u.userId, d.id, !on)} style={{ fontSize: 11.5, fontWeight: 600, borderRadius: 16, padding: "4px 11px", cursor: "pointer", border: on ? `1px solid ${royal}` : "1px solid #E4E8F0", background: on ? "#E8F0FD" : "#fff", color: on ? royal : "#6B7690" }}>
                    {on ? "✓ " : "+ "}{d.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {members.length === 0 && <div style={{ padding: 20, fontSize: 12.5, color: "#6B7690" }}>No internal users.</div>}
      </div>
    </div>
  );
}

/* ── Audit ─────────────────────────────────────────────────────────────────── */

const ACTION_LABEL: Record<string, string> = { grant_enabled: "enabled feature", grant_disabled: "disabled feature", member_added: "added member", member_removed: "removed member", feature_registered: "registered feature", department_created: "created department" };

function AuditTab() {
  const [rows, setRows] = useState<Audit[] | null>(null);
  useEffect(() => { void (async () => { const r = await fetch("/api/admin/departments/audit"); if (r.ok) setRows((await r.json()).rows); })(); }, []);
  if (!rows) return <p style={{ fontSize: 13, color: "#6B7690" }}>Loading…</p>;
  return (
    <div style={{ border: "1px solid #E4E8F0", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
      {rows.length === 0 && <div style={{ padding: 20, fontSize: 12.5, color: "#6B7690" }}>No changes logged yet.</div>}
      {rows.map((r, i) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: i ? "1px solid #F1F4F9" : "none", fontSize: 12.5 }}>
          <span style={{ fontWeight: 500 }}>{r.actorName}</span>
          <span style={{ color: "#6B7690" }}>{ACTION_LABEL[r.action] ?? r.action}</span>
          {r.featureLabel && <span style={{ fontWeight: 500 }}>{r.featureLabel}</span>}
          {r.targetName && <span style={{ fontWeight: 500 }}>{r.targetName}</span>}
          {r.departmentName && <span style={{ fontSize: 10.5, color: royal, background: "#E8F0FD", borderRadius: 10, padding: "1px 8px" }}>{r.departmentName}</span>}
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>{new Date(r.createdAt).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on} style={{ width: 34, height: 19, borderRadius: 10, border: "none", background: on ? "#12A150" : "#D3D9E6", position: "relative", cursor: "pointer" }}>
      <span style={{ position: "absolute", top: 2, left: on ? 17 : 2, width: 15, height: 15, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
    </button>
  );
}

const sel: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, border: "1px solid #E4E8F0", borderRadius: 8, padding: "7px 11px", background: "#fff", color: "#16213E" };
