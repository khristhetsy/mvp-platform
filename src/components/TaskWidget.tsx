"use client";

import { useState, useEffect, useCallback } from "react";
import type { Task, TaskStatus, TaskPriority } from "@/lib/tasks/types";

// ─── colour maps ──────────────────────────────────────────────────────────────
const PRIORITY_MAP: Record<TaskPriority, { bg: string; color: string; dot: string }> = {
  high:   { bg: "#FCEBEB", color: "#A32D2D", dot: "#E05252" },
  medium: { bg: "#FAEEDA", color: "#854F0B", dot: "#F0A535" },
  low:    { bg: "#E1F5EE", color: "#0F6E56", dot: "#1D9E75" },
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo:        "To-do",
  in_progress: "In progress",
  done:        "Done",
  cancelled:   "Cancelled",
};

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

function CheckIcon({ done }: { done: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle
        cx="8" cy="8" r="7"
        stroke={done ? "#534AB7" : "var(--border)"}
        strokeWidth="1.5"
        fill={done ? "#534AB7" : "transparent"}
      />
      {done && (
        <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

// ─── TaskWidget ───────────────────────────────────────────────────────────────
export function TaskWidget() {
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [filter, setFilter]       = useState<"active" | "all">("active");
  const [form, setForm]           = useState({ title: "", priority: "medium" as TaskPriority, due_date: "" });
  const [saving, setSaving]       = useState(false);
  const [toggling, setToggling]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) setTasks(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.title.trim()) return;
    setSaving(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title:        form.title.trim(),
        priority:     form.priority,
        due_date:     form.due_date || null,
        context_type: "personal",
      }),
    });
    setSaving(false);
    setForm({ title: "", priority: "medium", due_date: "" });
    setShowForm(false);
    load();
  }

  async function toggleDone(task: Task) {
    setToggling(task.id);
    const next: TaskStatus = task.status === "done" ? "todo" : "done";
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setToggling(null);
    load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    load();
  }

  const visible = filter === "active"
    ? tasks.filter((t) => t.status !== "done" && t.status !== "cancelled")
    : tasks;

  const activeCnt = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length;
  const doneCnt   = tasks.filter((t) => t.status === "done").length;

  return (
    <div style={{
      background: "var(--background)",
      border: "0.5px solid var(--border)",
      borderRadius: 12,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 16px 12px",
        borderBottom: "0.5px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>My Tasks</span>
          {activeCnt > 0 && (
            <span style={{ fontSize: 10, fontWeight: 500, padding: "1px 6px", borderRadius: 10, background: "#EEEDFE", color: "#534AB7" }}>
              {activeCnt}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Filter toggle */}
          <div style={{ display: "flex", background: "var(--muted)", borderRadius: 6, padding: 2 }}>
            {(["active", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "none", cursor: "pointer",
                  background: filter === f ? "var(--background)" : "transparent",
                  color: filter === f ? "var(--foreground)" : "var(--muted-foreground)",
                  fontWeight: filter === f ? 500 : 400,
                  boxShadow: filter === f ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                }}
              >
                {f === "active" ? "Active" : `All (${tasks.length})`}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Add
          </button>
        </div>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--border)", background: "var(--muted)" }}>
          <input
            autoFocus
            type="text"
            placeholder="Task title…"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowForm(false); }}
            style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
              style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", flex: 1 }}
            >
              <option value="high">🔴 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </select>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", flex: 1 }}
            />
            <button
              onClick={handleCreate}
              disabled={saving || !form.title.trim()}
              style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer", opacity: !form.title.trim() ? 0.5 : 1 }}
            >
              {saving ? "…" : "Save"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: "20px 16px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 12 }}>
            Loading…
          </div>
        ) : visible.length === 0 ? (
          <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
            {filter === "active" ? "All caught up! No active tasks." : "No tasks yet — add one above."}
          </div>
        ) : (
          visible.map((task) => {
            const pc = PRIORITY_MAP[task.priority];
            const isDone = task.status === "done";
            const isAssigned = !!task.assigned_to;
            return (
              <div
                key={task.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "10px 16px",
                  borderBottom: "0.5px solid var(--border)",
                  opacity: isDone ? 0.55 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleDone(task)}
                  disabled={toggling === task.id}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 1, flexShrink: 0 }}
                >
                  <CheckIcon done={isDone} />
                </button>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--foreground)", textDecoration: isDone ? "line-through" : "none", lineHeight: 1.4 }}>
                    {task.title}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4, alignItems: "center" }}>
                    {/* Priority */}
                    <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: pc.bg, color: pc.color, fontWeight: 500 }}>
                      {task.priority}
                    </span>
                    {/* Due date */}
                    {task.due_date && (
                      <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
                        📅 {relativeDate(task.due_date)}
                      </span>
                    )}
                    {/* Assigned badge */}
                    {isAssigned && (
                      <span style={{ fontSize: 10, color: "#534AB7", background: "#EEEDFE", padding: "1px 6px", borderRadius: 10 }}>
                        → Assigned
                      </span>
                    )}
                    {/* Status */}
                    {task.status !== "todo" && (
                      <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
                        {STATUS_LABEL[task.status]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(task.id)}
                  title="Delete task"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", padding: "0 2px", fontSize: 12, flexShrink: 0, opacity: 0.5 }}
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer summary */}
      {tasks.length > 0 && (
        <div style={{
          padding: "8px 16px",
          display: "flex",
          gap: 12,
          fontSize: 11,
          color: "var(--muted-foreground)",
          borderTop: "0.5px solid var(--border)",
        }}>
          <span>{activeCnt} active</span>
          <span>·</span>
          <span>{doneCnt} done</span>
          <span>·</span>
          <span>{tasks.length} total</span>
        </div>
      )}
    </div>
  );
}
