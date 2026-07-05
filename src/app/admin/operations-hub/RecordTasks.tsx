"use client";

// Inline task list for a record — assign, edit (inline), save, complete, archive.
// Fetches from /api/operations/tasks. Used inside the Lifecycle queue rows.

import { useCallback, useEffect, useState } from "react";

type Task = { id: string; title: string; assignee_id: string | null; assignee_name: string | null; due_date: string | null; status: "open" | "in_progress" | "done"; archived: boolean };
type Assignee = { id: string; name: string };
type Draft = { title: string; assigneeId: string; dueDate: string; status: Task["status"] };

const STATUS_BADGE: Record<Task["status"], { text: string; color: string; bg: string }> = {
  open: { text: "Open", color: "#854F0B", bg: "#FAEEDA" },
  in_progress: { text: "In progress", color: "#185FA5", bg: "#E6F1FB" },
  done: { text: "Done", color: "#0F6E56", bg: "#E1F5EE" },
};

const INP: React.CSSProperties = { fontSize: 11.5, padding: "5px 8px", borderRadius: 6, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" };

function TaskEditRow({ draft, setDraft, assignees, onSave, onCancel, busy }: { draft: Draft; setDraft: (d: Draft) => void; assignees: Assignee[]; onSave: () => void; onCancel: () => void; busy: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 110px 96px 74px", gap: 8, padding: "8px 12px", background: "#F5F9FF", alignItems: "center" }}>
      <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Task title" autoFocus style={{ ...INP, borderColor: "#2E78F5" }} />
      <select value={draft.assigneeId} onChange={(e) => setDraft({ ...draft, assigneeId: e.target.value })} style={INP}><option value="">Unassigned</option>{assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <input type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} style={INP} />
      <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Task["status"] })} style={INP}><option value="open">Open</option><option value="in_progress">In progress</option><option value="done">Done</option></select>
      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
        <button onClick={onSave} disabled={busy || !draft.title.trim()} style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 5, padding: "4px 9px", cursor: "pointer", opacity: busy || !draft.title.trim() ? 0.5 : 1 }}>Save</button>
        <button onClick={onCancel} style={{ fontSize: 10.5, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
      </div>
    </div>
  );
}

export function RecordTasks({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null); // task id or "new"
  const [draft, setDraft] = useState<Draft>({ title: "", assigneeId: "", dueDate: "", status: "open" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/operations/tasks?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`);
      const data = res.ok ? await res.json() : { tasks: [], assignees: [] };
      setTasks(data.tasks ?? []);
      setAssignees(data.assignees ?? []);
    } catch { setTasks([]); }
    setLoading(false);
  }, [entityType, entityId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load tasks on mount
  useEffect(() => { void load(); }, [load]);

  function startNew() { setEditing("new"); setDraft({ title: "", assigneeId: "", dueDate: "", status: "open" }); }
  function startEdit(t: Task) { setEditing(t.id); setDraft({ title: t.title, assigneeId: t.assignee_id ?? "", dueDate: t.due_date ?? "", status: t.status }); }

  async function save() {
    if (!draft.title.trim()) return;
    setBusy(true);
    try {
      if (editing === "new") {
        await fetch("/api/operations/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: draft.title, entityType, entityId, assigneeId: draft.assigneeId || null, dueDate: draft.dueDate || null }) });
      } else if (editing) {
        await fetch(`/api/operations/tasks/${editing}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: draft.title, assigneeId: draft.assigneeId || null, dueDate: draft.dueDate || null, status: draft.status }) });
      }
      setEditing(null);
      await load();
    } finally { setBusy(false); }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/operations/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      await load();
    } finally { setBusy(false); }
  }

  return (
    <div style={{ border: "0.5px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "0.5px solid var(--border)" }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted-foreground)" }}>Tasks</span>
        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{tasks.filter((t) => t.status !== "done").length} open</span>
        <button onClick={startNew} style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>+ Assign task</button>
      </div>

      {editing === "new" && <TaskEditRow draft={draft} setDraft={setDraft} assignees={assignees} onSave={save} onCancel={() => setEditing(null)} busy={busy} />}

      {loading ? (
        <p style={{ padding: 14, fontSize: 11.5, color: "var(--muted-foreground)", textAlign: "center" }}>Loading…</p>
      ) : tasks.length === 0 && editing !== "new" ? (
        <p style={{ padding: 14, fontSize: 11.5, color: "var(--muted-foreground)", textAlign: "center" }}>No tasks yet. Assign one to get started.</p>
      ) : tasks.map((t) => editing === t.id ? <TaskEditRow key={t.id} draft={draft} setDraft={setDraft} assignees={assignees} onSave={save} onCancel={() => setEditing(null)} busy={busy} /> : (
        <div key={t.id} style={{ display: "grid", gridTemplateColumns: "22px 1.6fr 1fr 100px 84px 60px", gap: 6, padding: "9px 12px", borderTop: "0.5px solid #eef1f5", alignItems: "center", fontSize: 12, opacity: t.status === "done" ? 0.6 : 1 }}>
          <input type="checkbox" checked={t.status === "done"} onChange={() => patch(t.id, { status: t.status === "done" ? "open" : "done" })} style={{ accentColor: "#0F6E56" }} aria-label="Toggle done" />
          <span style={{ fontWeight: 500, textDecoration: t.status === "done" ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.assignee_name ?? "Unassigned"}</span>
          <span style={{ fontSize: 11, color: t.due_date && new Date(t.due_date) < new Date() && t.status !== "done" ? "#A32D2D" : "var(--muted-foreground)" }}>{t.due_date ?? "—"}</span>
          <span><span style={{ fontSize: 10, fontWeight: 600, color: STATUS_BADGE[t.status].color, background: STATUS_BADGE[t.status].bg, borderRadius: 10, padding: "2px 8px" }}>{STATUS_BADGE[t.status].text}</span></span>
          <span style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => startEdit(t)} title="Edit" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 12 }}>✎</button>
            <button onClick={() => patch(t.id, { archived: true })} title="Archive" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 12 }}>🗑</button>
          </span>
        </div>
      ))}
    </div>
  );
}
