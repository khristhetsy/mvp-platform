"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const NAVY = "#0A1A40", BLUE = "#1A6CE4", MUTED = "var(--muted-foreground)";
type Status = "on_track" | "at_risk" | "off_track" | "done";
interface Dept { id: string; name: string }
interface Staff { id: string; name: string }
interface Milestone { id: string; title: string; owner_name: string | null; due_date: string | null; done: boolean }
interface Objective { id: string; department_id: string | null; department_name: string | null; title: string; description: string | null; period_label: string | null; target_date: string | null; status: Status; milestones: Milestone[]; progress: number }

const STATUS_TONE: Record<Status, { bg: string; c: string; label: string }> = {
  on_track: { bg: "#E1F5EE", c: "#0F6E56", label: "On track" },
  at_risk: { bg: "#FAEEDA", c: "#854F0B", label: "At risk" },
  off_track: { bg: "#FCEBEB", c: "#A32D2D", label: "Off track" },
  done: { bg: "#E6F1FB", c: "#0C447C", label: "Done" },
};
const BAR_COLOR: Record<Status, string> = { on_track: "#1D9E75", at_risk: "#EF9F27", off_track: "#D2534E", done: "#378ADD" };

export function PlanClient({ departments, staff }: { departments: Dept[]; staff: Staff[] }) {
  const [dept, setDept] = useState("");
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(() => {
    const qs = dept ? `?dept=${dept}` : "";
    fetch(`/api/admin/meetings/plan${qs}`).then((r) => r.json()).then((d) => setObjectives((d.objectives ?? []) as Objective[])).catch(() => {});
  }, [dept]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <Link href="/admin/meetings" style={{ fontSize: 12, color: BLUE, textDecoration: "none" }}>← Meetings</Link>
          <h1 style={{ fontSize: 21, fontWeight: 600, color: NAVY, margin: "6px 0 0" }}>Plan of Action</h1>
          <p style={{ fontSize: 12.5, color: MUTED, margin: "2px 0 0" }}>Strategic objectives and milestones reviewed each meeting.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={dept} onChange={(e) => setDept(e.target.value)} style={{ fontSize: 12.5, padding: "6px 10px", borderRadius: 8, border: "0.5px solid var(--border)" }}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button onClick={() => setShowNew(true)} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: BLUE, border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer" }}>+ Objective</button>
        </div>
      </div>

      {objectives.length === 0 ? (
        <p style={{ fontSize: 12.5, color: MUTED }}>No objectives yet. Add one to start the plan.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {objectives.map((o) => <ObjectiveCard key={o.id} obj={o} staff={staff} onChange={load} />)}
        </div>
      )}

      {showNew && <NewObjectiveModal departments={departments} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function ObjectiveCard({ obj, staff, onChange }: { obj: Objective; staff: Staff[]; onChange: () => void }) {
  const [adding, setAdding] = useState(false);
  const [msTitle, setMsTitle] = useState("");
  const [msOwner, setMsOwner] = useState("");
  const tone = STATUS_TONE[obj.status];

  const setStatus = async (status: Status) => {
    await fetch(`/api/admin/meetings/plan/${obj.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => {});
    onChange();
  };
  const archive = async () => {
    if (!window.confirm("Archive this objective?")) return;
    await fetch(`/api/admin/meetings/plan/${obj.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: true }) }).catch(() => {});
    onChange();
  };
  const toggleMs = async (id: string, done: boolean) => {
    await fetch(`/api/admin/meetings/plan/milestones/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done }) }).catch(() => {});
    onChange();
  };
  const addMs = async () => {
    if (!msTitle.trim()) return;
    await fetch(`/api/admin/meetings/plan/${obj.id}/milestones`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: msTitle.trim(), owner_id: msOwner || null }) }).catch(() => {});
    setMsTitle(""); setMsOwner(""); setAdding(false); onChange();
  };

  return (
    <div style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: NAVY, flex: 1 }}>{obj.title}</span>
        {obj.department_name && <span style={{ fontSize: 10.5, background: "#EEF3FC", color: "#185FA5", borderRadius: 5, padding: "1px 6px" }}>{obj.department_name}</span>}
        {obj.period_label && <span style={{ fontSize: 10.5, color: MUTED }}>{obj.period_label}</span>}
        <select value={obj.status} onChange={(e) => void setStatus(e.target.value as Status)} style={{ fontSize: 11, padding: "3px 6px", borderRadius: 6, border: "0.5px solid var(--border)", background: tone.bg, color: tone.c, fontWeight: 600 }}>
          <option value="on_track">On track</option><option value="at_risk">At risk</option><option value="off_track">Off track</option><option value="done">Done</option>
        </select>
      </div>
      {obj.description && <p style={{ fontSize: 12, color: MUTED, margin: "0 0 8px" }}>{obj.description}</p>}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, height: 8, background: "#F1EFE8", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${obj.progress}%`, background: BAR_COLOR[obj.status], borderRadius: 99 }} />
        </div>
        <span style={{ fontSize: 11, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{obj.progress}%</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {obj.milestones.map((m) => (
          <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
            <input type="checkbox" checked={m.done} onChange={(e) => void toggleMs(m.id, e.target.checked)} />
            <span style={{ flex: 1, color: m.done ? MUTED : NAVY, textDecoration: m.done ? "line-through" : "none" }}>{m.title}</span>
            {m.owner_name && <span style={{ fontSize: 10.5, color: MUTED }}>{m.owner_name}</span>}
            {m.due_date && <span style={{ fontSize: 10.5, color: !m.done && m.due_date < new Date().toISOString().slice(0, 10) ? "#A32D2D" : MUTED }}>{m.due_date}</span>}
          </label>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
        {adding ? (
          <>
            <input value={msTitle} onChange={(e) => setMsTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void addMs(); }} placeholder="Milestone…" autoFocus style={{ flex: 1, fontSize: 12, padding: "5px 8px", borderRadius: 7, border: "0.5px solid var(--border)" }} />
            <select value={msOwner} onChange={(e) => setMsOwner(e.target.value)} style={{ fontSize: 11.5, padding: "5px 7px", borderRadius: 7, border: "0.5px solid var(--border)" }}><option value="">Owner…</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <button onClick={() => void addMs()} style={smallBtn(BLUE, "#fff")}>Add</button>
            <button onClick={() => { setAdding(false); setMsTitle(""); setMsOwner(""); }} style={smallBtn("#F1EFE8", NAVY)}>Cancel</button>
          </>
        ) : (
          <>
            <button onClick={() => setAdding(true)} style={smallBtn("#E6F1FB", BLUE)}>+ Milestone</button>
            <button onClick={() => void archive()} style={{ ...smallBtn("transparent", MUTED), border: "0.5px solid var(--border)", marginLeft: "auto" }}>Archive</button>
          </>
        )}
      </div>
    </div>
  );
}

function smallBtn(bg: string, color: string): React.CSSProperties {
  return { fontSize: 11.5, fontWeight: 600, color, background: bg, border: "none", borderRadius: 7, padding: "5px 10px", cursor: "pointer" };
}

function NewObjectiveModal({ departments, onClose, onCreated }: { departments: Dept[]; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [dept, setDept] = useState("");
  const [period, setPeriod] = useState("");
  const [target, setTarget] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const create = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/meetings/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), department_id: dept || null, period_label: period || null, target_date: target || null, description: description || null }) });
      if (r.ok) onCreated();
    } finally { setBusy(false); }
  };
  const field: React.CSSProperties = { width: "100%", fontSize: 12.5, padding: "7px 9px", borderRadius: 8, border: "0.5px solid var(--border)", marginTop: 4 };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="New objective" style={{ width: "min(460px, 94vw)", background: "#fff", borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: NAVY, marginBottom: 12 }}>New objective</div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Objective title" style={field} autoFocus />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2} style={{ ...field, resize: "vertical" }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <select value={dept} onChange={(e) => setDept(e.target.value)} style={field}><option value="">Company-wide</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Period (e.g. Q3 2026)" style={field} />
          <input type="date" value={target} onChange={(e) => setTarget(e.target.value)} style={field} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={() => void create()} disabled={busy || !title.trim()} style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: BLUE, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>{busy ? "Creating…" : "Create objective"}</button>
          <button onClick={onClose} style={{ fontSize: 12.5, fontWeight: 600, color: NAVY, background: "#F1EFE8", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
