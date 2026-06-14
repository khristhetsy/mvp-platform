"use client";

import { useState, useEffect, useCallback } from "react";
import type { Task, TaskStatus, TaskPriority } from "@/lib/tasks/types";

const PRIORITY_STYLES: Record<TaskPriority, { bg: string; color: string; label: string }> = {
  high:   { bg: "bg-red-50",    color: "text-red-700",    label: "High" },
  medium: { bg: "bg-amber-50",  color: "text-amber-700",  label: "Medium" },
  low:    { bg: "bg-emerald-50", color: "text-emerald-700", label: "Low" },
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

function CheckCircle({ done }: { done: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle
        cx="9" cy="9" r="8"
        stroke={done ? "#534AB7" : "#cbd5e1"}
        strokeWidth="1.5"
        fill={done ? "#534AB7" : "transparent"}
      />
      {done && (
        <path d="M5.5 9l2.5 2.5 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/* ────────────────────────────────────── */
export function InvestorTasksPageClient({
  googleConnected = false,
}: Readonly<{ googleConnected?: boolean }>) {
  const [tasks, setTasks]             = useState<Task[]>([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<TabKey>("active");
  const [query, setQuery]             = useState("");

  /* quick-add form */
  const [showForm, setShowForm]       = useState(false);
  const [newTitle, setNewTitle]       = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newDueDate, setNewDueDate]   = useState("");
  const [saving, setSaving]           = useState(false);

  /* inline edit */
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [editForm, setEditForm]       = useState<{
    title: string;
    description: string;
    priority: TaskPriority;
    due_date: string;
  } | null>(null);
  const [editSaving, setEditSaving]   = useState(false);

  /* per-task actions */
  const [calSyncing, setCalSyncing]   = useState<string | null>(null);
  const [toggling, setToggling]       = useState<string | null>(null);
  const [deleting, setDeleting]       = useState<string | null>(null);

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

  /* ── quick create ── */
  async function handleCreate() {
    if (!newTitle.trim()) return;
    setSaving(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle.trim(),
        priority: newPriority,
        due_date: newDueDate || null,
        context_type: "personal",
      }),
    });
    setSaving(false);
    setNewTitle("");
    setNewPriority("medium");
    setNewDueDate("");
    setShowForm(false);
    void load();
  }

  /* ── toggle done ── */
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

  /* ── delete ── */
  async function handleDelete(id: string) {
    setDeleting(id);
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    setDeleting(null);
    if (expandedId === id) setExpandedId(null);
    void load();
  }

  /* ── expand / collapse row ── */
  function toggleExpand(task: Task) {
    if (expandedId === task.id) {
      setExpandedId(null);
      setEditForm(null);
      return;
    }
    setExpandedId(task.id);
    setEditForm({
      title:       task.title,
      description: task.description ?? "",
      priority:    task.priority,
      due_date:    task.due_date?.slice(0, 10) ?? "",
    });
  }

  /* ── save edits ── */
  async function handleEditSave(taskId: string) {
    if (!editForm || !editForm.title.trim()) return;
    setEditSaving(true);
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title:       editForm.title.trim(),
        description: editForm.description || null,
        priority:    editForm.priority,
        due_date:    editForm.due_date || null,
      }),
    });
    setEditSaving(false);
    if (res.ok) {
      setExpandedId(null);
      setEditForm(null);
      void load();
    }
  }

  /* ── Google Calendar sync ── */
  async function syncToCalendar(task: Task) {
    setCalSyncing(task.id);
    await fetch(`/api/tasks/${task.id}/calendar`, { method: "POST" });
    setCalSyncing(null);
    void load();
  }

  async function unsyncFromCalendar(task: Task) {
    setCalSyncing(task.id);
    await fetch(`/api/tasks/${task.id}/calendar`, { method: "DELETE" });
    setCalSyncing(null);
    void load();
  }

  /* ── derived lists ── */
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

  /* ── render ── */
  return (
    <div>
      {/* Stat row */}
      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-200 pb-5">
        {[
          { label: "Active",  value: activeTasks.length,  extra: "" },
          { label: "Overdue", value: overdueTasks.length, extra: overdueTasks.length > 0 ? "text-red-600" : "" },
          { label: "Done",    value: doneTasks.length,    extra: "text-emerald-600" },
          { label: "Total",   value: tasks.length,        extra: "" },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5">
            <span className={`text-xl font-semibold leading-none text-slate-900 ${s.extra}`}>{s.value}</span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {(["active", "all", "done"] as TabKey[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                tab === t
                  ? "border border-slate-200 bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t === "active" ? "Active" : t === "done" ? "Done" : "All"}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search tasks…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-[160px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
        >
          + Add task
        </button>
      </div>

      {/* Quick-add form */}
      {showForm && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <input
            autoFocus
            type="text"
            placeholder="Task title…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
              if (e.key === "Escape") setShowForm(false);
            }}
            className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <div className="flex gap-2">
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none"
            >
              <option value="high">High priority</option>
              <option value="medium">Medium priority</option>
              <option value="low">Low priority</option>
            </select>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={saving || !newTitle.trim()}
              className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {saving ? "…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Section label */}
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {tab === "active" ? "Active" : tab === "done" ? "Completed" : "All"} · {visible.length} task{visible.length !== 1 ? "s" : ""}
      </p>

      {/* Task list */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
          <p className="text-sm text-slate-500">
            {tab === "active" ? "All caught up — no active tasks." : "No tasks found."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {visible.map((task, idx) => {
            const isDone   = task.status === "done";
            const overdue  = !isDone && isOverdue(task.due_date);
            const pc       = PRIORITY_STYLES[task.priority];
            const isOpen   = expandedId === task.id;
            const isSynced = !!task.google_calendar_event_id;
            const hasDue   = !!(editForm?.due_date || task.due_date);

            return (
              <div key={task.id} className={idx > 0 ? "border-t border-slate-100" : ""}>
                {/* ── Row ── */}
                <div
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${isOpen ? "bg-slate-50" : "hover:bg-slate-50/60"} ${isDone ? "opacity-55" : ""}`}
                >
                  {/* Check */}
                  <button
                    type="button"
                    onClick={() => void toggleDone(task)}
                    disabled={toggling === task.id}
                    className="mt-0.5 shrink-0 cursor-pointer border-none bg-transparent p-0"
                    aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                  >
                    <CheckCircle done={isDone} />
                  </button>

                  {/* Title + meta */}
                  <button
                    type="button"
                    className="min-w-0 flex-1 cursor-pointer border-none bg-transparent p-0 text-left"
                    onClick={() => toggleExpand(task)}
                  >
                    <p className={`text-sm font-medium leading-snug text-slate-900 ${isDone ? "line-through" : ""}`}>
                      {task.title}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pc.bg} ${pc.color}`}>
                        {pc.label}
                      </span>
                      {task.due_date && (
                        <span className={`text-[11px] ${overdue ? "text-red-500" : "text-slate-400"}`}>
                          📅 {relativeDate(task.due_date)}
                        </span>
                      )}
                      {isSynced && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                          📆 In Google Calendar
                        </span>
                      )}
                      {task.description && !isOpen && (
                        <span className="max-w-[200px] truncate text-[10.5px] italic text-slate-400">
                          {task.description}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Chevron + delete */}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleExpand(task)}
                      className="rounded-md p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                      aria-label={isOpen ? "Collapse" : "Expand"}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path
                          d={isOpen ? "M3 9l4-4 4 4" : "M3 5l4 4 4-4"}
                          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    {deleting === task.id ? (
                      <span className="px-1 text-xs text-slate-300">…</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleDelete(task.id)}
                        className="rounded-md p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                        aria-label="Delete task"
                      >
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                          <path d="M2 2l9 9M11 2l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Inline detail panel ── */}
                {isOpen && editForm && (
                  <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-4">
                    <div className="mb-3 grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="mb-1 block text-[10.5px] font-medium text-slate-500">Title</label>
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10.5px] font-medium text-slate-500">Priority</label>
                        <select
                          value={editForm.priority}
                          onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as TaskPriority })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
                        >
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10.5px] font-medium text-slate-500">Due date</label>
                        <input
                          type="date"
                          value={editForm.due_date}
                          onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="mb-1 block text-[10.5px] font-medium text-slate-500">Notes</label>
                        <textarea
                          rows={3}
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          placeholder="Add context, links, or next steps…"
                          className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Google Calendar row */}
                    <div className="mb-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <rect x="3" y="4" width="18" height="18" rx="2" stroke="#185FA5" strokeWidth="1.5"/>
                            <path d="M16 2v4M8 2v4M3 10h18" stroke="#185FA5" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-medium text-slate-900">Google Calendar</p>
                          <p className="mt-0.5 text-[10.5px] text-slate-400">
                            {!googleConnected
                              ? "Connect Google in Settings to enable"
                              : !hasDue
                              ? "Set a due date to add to calendar"
                              : isSynced
                              ? "Event added — Google will send reminders"
                              : "Adds an all-day event with Google's built-in reminders"}
                          </p>
                        </div>
                        {googleConnected && hasDue && !isDone && (
                          isSynced ? (
                            <button
                              type="button"
                              onClick={() => void unsyncFromCalendar(task)}
                              disabled={calSyncing === task.id}
                              className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                            >
                              {calSyncing === task.id ? "…" : "Remove"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void syncToCalendar(task)}
                              disabled={calSyncing === task.id}
                              className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-100 disabled:opacity-50"
                            >
                              {calSyncing === task.id ? "Adding…" : "Add to Calendar"}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Save / cancel */}
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => { setExpandedId(null); setEditForm(null); }}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleEditSave(task.id)}
                        disabled={editSaving || !editForm.title.trim()}
                        className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                      >
                        {editSaving ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Footer */}
          <div className="flex gap-3 border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-400">
            <span>{activeTasks.length} active</span>
            <span>·</span>
            <span>{overdueTasks.length} overdue</span>
            <span>·</span>
            <span>{doneTasks.length} done</span>
          </div>
        </div>
      )}
    </div>
  );
}
