"use client";

import { useState } from "react";

/**
 * Edit a sales task in place: title, type, due date and assignee, the same four
 * fields as Sales › Tasks, saved through the same PATCH /api/sales/tasks/:id.
 */
export type EditableTask = { id: string; title: string; task_type: string; due_date: string | null; assignee_id?: string | null };

const DEFAULT_TYPES = ["Call", "Email", "Demo", "Follow-up", "Proposal"];

export function TaskEditRow({ task, staff, taskTypes = DEFAULT_TYPES, onSaved, onCancel }: {
  task: EditableTask;
  staff: Array<{ id: string; name: string }>;
  taskTypes?: string[];
  onSaved: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [taskType, setTaskType] = useState(task.task_type);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Keep a type the list doesn't have (e.g. one set in Odoo) selectable.
  const types = taskTypes.includes(task.task_type) ? taskTypes : [task.task_type, ...taskTypes];

  async function save() {
    if (!title.trim()) return setError("Give the task a title.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sales/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), taskType, dueDate: dueDate || null, assigneeId: assigneeId || null }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        return setError(data.error ?? "Couldn't save the task.");
      }
      await onSaved();
    } catch {
      setError("Couldn't save the task.");
    } finally {
      setBusy(false);
    }
  }

  const inp: React.CSSProperties = { height: 32, border: "0.5px solid #d7dbe3", borderRadius: 6, padding: "0 8px", fontSize: 12.5, color: "var(--foreground)", background: "#fff", minWidth: 0, width: "100%", boxSizing: "border-box" };
  const label: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 3, fontSize: 10.5, color: "var(--muted-foreground)" };
  return (
    <div style={{ background: "#F5F9FF", border: "0.5px solid #dce6f7", borderRadius: 8, padding: 10, margin: "4px 0 8px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.3fr)", gap: 8 }}>
        <label style={label}>Title<input value={title} onChange={(e) => setTitle(e.target.value)} style={inp} /></label>
        <label style={label}>Type<select value={taskType} onChange={(e) => setTaskType(e.target.value)} style={inp}>{types.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label style={label}>Due date<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inp} /></label>
        <label style={label}>Assignee<select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={inp}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 8 }}>
        {error ? <span role="alert" style={{ fontSize: 11.5, color: "#A32D2D", marginRight: "auto" }}>{error}</span> : null}
        <button type="button" onClick={onCancel} disabled={busy} style={{ fontSize: 12, color: "var(--foreground)", background: "#fff", border: "0.5px solid #d7dbe3", borderRadius: 7, padding: "7px 12px", cursor: "pointer" }}>Cancel</button>
        <button type="button" onClick={() => void save()} disabled={busy || !title.trim()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "7px 14px", cursor: "pointer", opacity: busy || !title.trim() ? 0.6 : 1 }}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}
