"use client";

import { useState, useEffect, useCallback } from "react";
import type { Task, TaskStatus, TaskPriority } from "@/lib/tasks/types";

const PRIORITY_MAP: Record<TaskPriority, { bg: string; color: string }> = {
  high:   { bg: "#FCEBEB", color: "#A32D2D" },
  medium: { bg: "#FAEEDA", color: "#854F0B" },
  low:    { bg: "#E1F5EE", color: "#0F6E56" },
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

function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

type TabKey = "active" | "all" | "done";

function CheckIcon({ done }: { done: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle
        cx="9" cy="9" r="8"
        stroke={done ? "#534AB7" : "#e2e6ed"}
        strokeWidth="1.5"
        fill={done ? "#534AB7" : "transparent"}
      />
      {done && (
        <path d="M5.5 9l2.5 2.5 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export function InvestorTasksPageClient() {
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<TabKey>("active");
  const [query, setQuery]       = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ title: "", priority: "medium" as TaskPriority, due_date: "" });
  const [saving, setSaving]     = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) setTasks(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate() {
    if (!form.title.trim()) return;
    setSaving(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: form.title.trim(), priority: form.priority, due_date: form.due_date || null, context_type: "personal" }),
    });
    setSaving(false);
    setForm({ title: "", priority: "medium", due_date: "" });
    setShowForm(false);
    void load();
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
    void load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    void load();
  }

  // Derived counts
  const activeTasks  = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const doneTasks    = tasks.filter((t) => t.status === "done");
  const overdueTasks = activeTasks.filter((t) => isOverdue(t.due_date));

  const tabFiltered =
    tab === "active" ? activeTasks :
    tab === "done"   ? doneTasks :
    tasks;

  const visible = query.trim()
    ? tabFiltered.filter((t) => t.title.toLowerCase().includes(query.toLowerCase()))
    : tabFiltered;

  const stats = [
    { label: "Active",  val: activeTasks.length,  color: "#534AB7" },
    { label: "Overdue", val: overdueTasks.length,  color: "#E05252" },
    { label: "Done",    val: doneTasks.length,     color: "#1D9E75" },
    { label: "Total",   val: tasks.length,          color: "#0f172a" },
  ];

  return (
    <div>
      {/* Stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 10, padding: "12px 14px", textAlign: "center", boxShadow: "0 1px 3px rgba(12,35,64,.04)" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Main card */}
      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(12,35,64,.05)" }}>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid #f1f5f9", gap: 10, flexWrap: "wrap" }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 2 }}>
            {(["active", "all", "done"] as TabKey[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  fontSize: 12, padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                  background: tab === t ? "#534AB7" : "transparent",
                  color: tab === t ? "#fff" : "#94a3b8",
                  fontWeight: tab === t ? 600 : 400,
                }}
              >
                {t === "active" ? "Active" : t === "done" ? "Done" : "All"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Search */}
            <input
              type="search"
              placeholder="Search tasks…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "0.5px solid #e2e6ed", background: "#f8fafc", color: "#475569", outline: "none", width: 200 }}
            />
            {/* Add task */}
            <button
              onClick={() => setShowForm(!showForm)}
              style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#fff", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add task
            </button>
          </div>
        </div>

        {/* Inline create form */}
        {showForm && (
          <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #f1f5f9", background: "#f8fafc" }}>
            <input
              autoFocus
              type="text"
              placeholder="Task title…"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); if (e.key === "Escape") setShowForm(false); }}
              style={{ width: "100%", fontSize: 13, padding: "8px 12px", borderRadius: 8, border: "0.5px solid #e2e6ed", background: "#fff", marginBottom: 8, boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
                style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #e2e6ed", background: "#fff", flex: 1 }}
              >
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #e2e6ed", background: "#fff", flex: 1 }}
              />
              <button
                onClick={() => void handleCreate()}
                disabled={saving || !form.title.trim()}
                style={{ fontSize: 12, padding: "6px 16px", borderRadius: 6, border: "none", background: "#534AB7", color: "#fff", cursor: "pointer", opacity: !form.title.trim() ? 0.5 : 1 }}
              >
                {saving ? "…" : "Save"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, border: "0.5px solid #e2e6ed", background: "transparent", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Task list */}
        {loading ? (
          <div style={{ padding: "32px 16px", textAlign: "center", fontSize: 13, color: "#94a3b8" }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={{ padding: "40px 16px", textAlign: "center", fontSize: 13, color: "#94a3b8" }}>
            {tab === "active" ? "All caught up — no active tasks." : "No tasks found."}
          </div>
        ) : (
          visible.map((task) => {
            const pc = PRIORITY_MAP[task.priority];
            const isDone = task.status === "done";
            const overdue = !isDone && isOverdue(task.due_date);
            return (
              <div
                key={task.id}
                style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", borderBottom: "0.5px solid #f8fafc", opacity: isDone ? 0.55 : 1 }}
              >
                <button
                  onClick={() => void toggleDone(task)}
                  disabled={toggling === task.id}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 1, flexShrink: 0 }}
                >
                  <CheckIcon done={isDone} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", textDecoration: isDone ? "line-through" : "none", lineHeight: 1.4 }}>
                    {task.title}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5, alignItems: "center" }}>
                    <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: pc.bg, color: pc.color, fontWeight: 500 }}>
                      {task.priority}
                    </span>
                    {task.due_date && (
                      <span style={{ fontSize: 10, color: overdue ? "#E05252" : "#94a3b8" }}>
                        📅 {relativeDate(task.due_date)}
                      </span>
                    )}
                    {isDone && (
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>Done</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => void handleDelete(task.id)}
                  title="Delete"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: 13, padding: "0 2px", flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
            );
          })
        )}

        {/* Footer */}
        {tasks.length > 0 && (
          <div style={{ padding: "10px 16px", borderTop: "0.5px solid #f1f5f9", display: "flex", gap: 10, fontSize: 11, color: "#94a3b8" }}>
            <span>{activeTasks.length} active</span>
            <span>·</span>
            <span>{overdueTasks.length} overdue</span>
            <span>·</span>
            <span>{doneTasks.length} done</span>
            <span>·</span>
            <span>{tasks.length} total</span>
          </div>
        )}
      </div>
    </div>
  );
}
