"use client";

import { useState, useCallback } from "react";
import type { Task, TaskStatus, TaskPriority, InternalUser } from "@/lib/tasks/types";

// ─── helpers ─────────────────────────────────────────────────────────────────
const PRIORITY_MAP: Record<TaskPriority, { bg: string; color: string }> = {
  high:   { bg: "#FCEBEB", color: "#A32D2D" },
  medium: { bg: "#FAEEDA", color: "#854F0B" },
  low:    { bg: "#E1F5EE", color: "#0F6E56" },
};

const STATUS_MAP: Record<TaskStatus, { bg: string; color: string; label: string }> = {
  todo:        { bg: "#F1EFE8", color: "#5F5E5A", label: "To-do" },
  in_progress: { bg: "#E6F1FB", color: "#185FA5", label: "In progress" },
  done:        { bg: "#E1F5EE", color: "#0F6E56", label: "Done" },
  cancelled:   { bg: "#FCEBEB", color: "#A32D2D", label: "Cancelled" },
};

function initials(name: string | null | undefined, email: string | null | undefined): string {
  if (name) return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  if (email) return email[0].toUpperCase();
  return "?";
}

function avatarColor(str: string): string {
  const palette = ["#534AB7", "#1D9E75", "#185FA5", "#854F0B", "#A32D2D"];
  let n = 0;
  for (let i = 0; i < str.length; i++) n += str.charCodeAt(i);
  return palette[n % palette.length];
}

function relativeDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Math.round((d.getTime() - Date.now()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 0) return `In ${diff}d`;
  return `${Math.abs(diff)}d ago`;
}

// ─── Column ───────────────────────────────────────────────────────────────────
function Column({
  status,
  tasks,
  onStatusChange,
  onDelete,
}: {
  status: TaskStatus;
  tasks: Task[];
  onStatusChange: (id: string, s: TaskStatus) => void;
  onDelete: (id: string) => void;
}) {
  const sc = STATUS_MAP[status];
  return (
    <div style={{ flex: 1, minWidth: 240 }}>
      {/* Column header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6, marginBottom: 10,
        padding: "6px 10px", borderRadius: 8, background: sc.bg,
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: sc.color }}>{sc.label}</span>
        <span style={{ fontSize: 11, padding: "1px 5px", borderRadius: 8, background: "rgba(0,0,0,0.07)", color: sc.color }}>
          {tasks.length}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tasks.map((task) => {
          const pc = PRIORITY_MAP[task.priority];
          const assignee = task.assignee;
          return (
            <div
              key={task.id}
              style={{
                background: "var(--background)",
                border: "0.5px solid var(--border)",
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              {/* Title + delete */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", lineHeight: 1.4, flex: 1 }}>
                  {task.title}
                </div>
                <button
                  onClick={() => onDelete(task.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 11, flexShrink: 0, opacity: 0.6 }}
                  title="Delete task"
                >
                  ✕
                </button>
              </div>

              {/* Description */}
              {task.description && (
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 8, lineHeight: 1.5 }}>
                  {task.description}
                </div>
              )}

              {/* Badges row */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: pc.bg, color: pc.color, fontWeight: 500 }}>
                  {task.priority}
                </span>
                {task.due_date && (
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>📅 {relativeDate(task.due_date)}</span>
                )}
              </div>

              {/* Assignee */}
              {assignee ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    background: avatarColor(assignee.id),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 700, color: "#fff",
                  }}>
                    {initials(assignee.full_name, assignee.email)}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                    {assignee.full_name ?? assignee.email ?? "Assignee"}
                  </span>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 8, fontStyle: "italic" }}>
                  Unassigned
                </div>
              )}

              {/* Move to status */}
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {(["todo", "in_progress", "done", "cancelled"] as TaskStatus[])
                  .filter((s) => s !== status)
                  .map((s) => {
                    const ssc = STATUS_MAP[s];
                    return (
                      <button
                        key={s}
                        onClick={() => onStatusChange(task.id, s)}
                        style={{
                          fontSize: 10, padding: "2px 7px", borderRadius: 6,
                          border: `0.5px solid ${ssc.color}20`,
                          background: ssc.bg, color: ssc.color, cursor: "pointer",
                        }}
                      >
                        → {ssc.label}
                      </button>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TasksClient (main) ───────────────────────────────────────────────────────
interface Props {
  initialTasks: Task[];
  internalUsers: InternalUser[];
  currentUserId: string;
}

export function TasksClient({ initialTasks, internalUsers, currentUserId }: Props) {
  const [tasks, setTasks]       = useState<Task[]>(initialTasks);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({
    title:       "",
    description: "",
    assigned_to: "",
    priority:    "medium" as TaskPriority,
    due_date:    "",
    context_type: "internal" as const,
  });

  const reload = useCallback(async () => {
    const res = await fetch("/api/tasks");
    if (res.ok) setTasks(await res.json());
  }, []);

  async function handleCreate() {
    if (!form.title.trim()) return;
    setSaving(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title:        form.title.trim(),
        description:  form.description.trim() || null,
        assigned_to:  form.assigned_to || null,
        priority:     form.priority,
        due_date:     form.due_date || null,
        context_type: "internal",
      }),
    });
    setSaving(false);
    setForm({ title: "", description: "", assigned_to: "", priority: "medium", due_date: "", context_type: "internal" });
    setShowForm(false);
    reload();
  }

  async function handleStatusChange(id: string, status: TaskStatus) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    reload();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    reload();
  }

  const byStatus = (s: TaskStatus) => tasks.filter((t) => t.status === s);

  // Stats
  const total   = tasks.length;
  const todo    = byStatus("todo").length;
  const inProg  = byStatus("in_progress").length;
  const done    = byStatus("done").length;

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "var(--foreground)", marginBottom: 4 }}>Team Tasks</h1>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            {total} total · {todo} to-do · {inProg} in progress · {done} done
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Assign task
        </button>
      </div>

      {/* Create / Assign form */}
      {showForm && (
        <div style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "18px 20px", marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Create & assign task</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Title */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Task title *</label>
              <input
                autoFocus
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="What needs to be done?"
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)" }}
              />
            </div>
            {/* Description */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Description (optional)</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="Additional context…"
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)", resize: "vertical" }}
              />
            </div>
            {/* Assign to */}
            <div>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Assign to</label>
              <select
                value={form.assigned_to}
                onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)" }}
              >
                <option value="">— Unassigned —</option>
                {internalUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name ?? u.email ?? u.id}{u.id === currentUserId ? " (me)" : ""}
                  </option>
                ))}
              </select>
            </div>
            {/* Priority */}
            <div>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)" }}
              >
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
            {/* Due date */}
            <div>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Due date (optional)</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)" }}
              />
            </div>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button
              onClick={handleCreate}
              disabled={saving || !form.title.trim()}
              style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer", opacity: !form.title.trim() ? 0.5 : 1 }}
            >
              {saving ? "Creating…" : "Create task"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Kanban board */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", overflowX: "auto", paddingBottom: 8 }}>
        {(["todo", "in_progress", "done", "cancelled"] as TaskStatus[]).map((s) => (
          <Column
            key={s}
            status={s}
            tasks={byStatus(s)}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
