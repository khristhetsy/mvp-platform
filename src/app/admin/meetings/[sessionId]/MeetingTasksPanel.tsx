"use client";

import { useCallback, useEffect, useState } from "react";

const NAVY = "#0A1A40", BLUE = "#1A6CE4", MUTED = "var(--muted-foreground)";

type TaskStatus = "not_started" | "in_progress" | "done" | "cancelled";
interface Task {
  id: string; title: string; department_name: string | null; assignee_name: string | null;
  priority: string; status: TaskStatus; due_date: string | null; agent_note: string | null; ceo_note: string | null;
}
interface Meta { departments: Array<{ id: string; name: string }>; staff: Array<{ id: string; name: string }> }

const STATUS_TONE: Record<string, { bg: string; c: string }> = {
  not_started: { bg: "#F1EFE8", c: "#5F5E5A" }, in_progress: { bg: "#FAEEDA", c: "#854F0B" },
  done: { bg: "#E1F5EE", c: "#0F6E56" }, cancelled: { bg: "#FCEBEB", c: "#A32D2D" },
};
const PRIO_TONE: Record<string, string> = { urgent: "#A32D2D", high: "#854F0B", med: "#185FA5", low: "#5F5E5A" };

export function CarryoverPanel({ sessionId }: { sessionId: string }) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/meetings/${sessionId}/carryover`).then((r) => r.json()).then((d) => { if (alive) setTasks((d.tasks ?? []) as Task[]); }).catch(() => { if (alive) setTasks([]); });
    return () => { alive = false; };
  }, [sessionId]);
  if (!tasks || tasks.length === 0) return null;
  return (
    <div style={{ background: "#FFF9EE", border: "0.5px solid #FAC775", borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#854F0B", marginBottom: 8 }}>Carryover · {tasks.length} open from prior meetings</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {tasks.slice(0, 12).map((t) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: PRIO_TONE[t.priority] ?? "#5F5E5A" }} />
            <span style={{ color: NAVY, flex: 1 }}>{t.title}</span>
            {t.department_name && <span style={{ fontSize: 10.5, color: MUTED }}>{t.department_name}</span>}
            {t.due_date && <span style={{ fontSize: 10.5, color: t.due_date < new Date().toISOString().slice(0, 10) ? "#A32D2D" : MUTED }}>{t.due_date}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TasksPanel({ sessionId, isAdmin, refreshToken = 0 }: { sessionId: string; isAdmin: boolean; refreshToken?: number }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meta, setMeta] = useState<Meta>({ departments: [], staff: [] });
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/admin/meetings/tasks?session=${sessionId}`).then((r) => r.json()).then((d) => setTasks((d.tasks ?? []) as Task[])).catch(() => {});
  }, [sessionId]);
  useEffect(() => { load(); }, [load, refreshToken]);
  useEffect(() => {
    fetch("/api/admin/meetings/meta").then((r) => r.json()).then((d) => setMeta({ departments: d.departments ?? [], staff: d.staff ?? [] })).catch(() => {});
  }, []);

  const patch = async (id: string, body: Record<string, unknown>) => {
    await fetch(`/api/admin/meetings/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
    load();
  };

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>Tasks · {tasks.length}</div>
        <button onClick={() => setShowNew(true)} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: BLUE, border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>+ New task</button>
      </div>
      <div style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {tasks.length === 0 ? <div style={{ padding: 14, fontSize: 12.5, color: MUTED }}>No tasks in this meeting yet.</div> : tasks.map((t, i) => (
          <div key={t.id} style={{ padding: "10px 14px", borderTop: i ? "0.5px solid #F1F4F9" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: PRIO_TONE[t.priority] ?? "#5F5E5A" }} />
              <span style={{ fontSize: 12.5, fontWeight: 500, color: NAVY, flex: 1 }}>{t.title}</span>
              {t.department_name && <span style={{ fontSize: 10.5, background: "#EEF3FC", color: "#185FA5", borderRadius: 5, padding: "1px 6px" }}>{t.department_name}</span>}
              {t.assignee_name && <span style={{ fontSize: 10.5, color: MUTED }}>{t.assignee_name}</span>}
              <select value={t.status} onChange={(e) => void patch(t.id, { status: e.target.value })} style={{ fontSize: 11, padding: "3px 6px", borderRadius: 6, border: "0.5px solid var(--border)", background: (STATUS_TONE[t.status] ?? STATUS_TONE.not_started).bg, color: (STATUS_TONE[t.status] ?? STATUS_TONE.not_started).c }}>
                <option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="done">Done</option><option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
              <NoteField label="Agent note" value={t.agent_note ?? ""} onSave={(v) => void patch(t.id, { agent_note: v })} disabled={false} />
              <NoteField label="CEO note" value={t.ceo_note ?? ""} onSave={(v) => void patch(t.id, { ceo_note: v })} disabled={!isAdmin} />
            </div>
          </div>
        ))}
      </div>
      {showNew && <NewTaskModal sessionId={sessionId} meta={meta} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function NoteField({ label, value, onSave, disabled }: { label: string; value: string; onSave: (v: string) => void; disabled: boolean }) {
  const [v, setV] = useState(value);
  return (
    <div>
      <div style={{ fontSize: 10, color: MUTED, marginBottom: 2 }}>{label}{disabled ? " (CEO only)" : ""}</div>
      <input value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== value) onSave(v); }} disabled={disabled}
        placeholder={disabled ? "—" : "Add a note…"} style={{ width: "100%", fontSize: 11.5, padding: "5px 7px", borderRadius: 6, border: "0.5px solid var(--border)", background: disabled ? "#F6F8FB" : "#fff", color: disabled ? MUTED : NAVY }} />
    </div>
  );
}

function NewTaskModal({ sessionId, meta, onClose, onCreated }: { sessionId: string; meta: Meta; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [dept, setDept] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState("high");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const create = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/meetings/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), department_id: dept || null, assignee_id: assignee || null, priority, due_date: due || null, session_id: sessionId }) });
      if (r.ok) onCreated();
    } finally { setBusy(false); }
  };
  const field: React.CSSProperties = { width: "100%", fontSize: 12.5, padding: "7px 9px", borderRadius: 8, border: "0.5px solid var(--border)", marginTop: 4 };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="New task" style={{ width: "min(420px, 94vw)", background: "#fff", borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: NAVY, marginBottom: 12 }}>New task</div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" style={field} autoFocus />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <select value={dept} onChange={(e) => setDept(e.target.value)} style={field}><option value="">Department…</option>{meta.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} style={field}><option value="">Assignee…</option>{meta.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} style={field}><option value="urgent">Urgent</option><option value="high">High</option><option value="med">Med</option><option value="low">Low</option></select>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} style={field} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={() => void create()} disabled={busy || !title.trim()} style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: BLUE, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>{busy ? "Creating…" : "Create task"}</button>
          <button onClick={onClose} style={{ fontSize: 12.5, fontWeight: 600, color: NAVY, background: "#F1EFE8", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
