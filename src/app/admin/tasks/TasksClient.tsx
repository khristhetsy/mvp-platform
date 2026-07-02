"use client";

import { useState, useCallback, useMemo } from "react";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import type { Task, TaskStatus, TaskPriority, TaskCategory, InternalUser } from "@/lib/tasks/types";
import type { GoogleConnectionStatus } from "@/lib/integrations/connected-accounts";

const GCAL_PURPLE = "#2E78F5";
const GCAL_LIGHT  = "#EEEDFE";

type ViewMode = "kanban" | "list";
type ActiveCat = TaskCategory | "all";

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

const DEPT_MAP: Record<TaskCategory, { bg: string; color: string; dot: string; label: string }> = {
  marketing: { bg: "#EEEDFE", color: "#1A6CE4", dot: "#2E78F5", label: "Marketing"  },
  ir_dept:   { bg: "#E6F1FB", color: "#0C447C", dot: "#185FA5", label: "IR Dept"    },
  admin_dept:{ bg: "#F1EFE8", color: "#444441", dot: "#5F5E5A", label: "Admin Dept" },
  sales_dept:{ bg: "#E1F5EE", color: "#085041", dot: "#0F6E56", label: "Sales Dept" },
};

const DEPT_KEYS: TaskCategory[] = ["marketing", "ir_dept", "admin_dept", "sales_dept"];

function initials(name: string | null | undefined, email: string | null | undefined): string {
  if (name) return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  if (email) return email[0].toUpperCase();
  return "?";
}

function avatarColor(str: string): string {
  const palette = ["#2E78F5", "#1D9E75", "#185FA5", "#854F0B", "#A32D2D"];
  let n = 0;
  for (let i = 0; i < str.length; i++) n += str.charCodeAt(i);
  return palette[n % palette.length];
}

function relativeDate(iso: string | null): { label: string; overdue: boolean } {
  if (!iso) return { label: "", overdue: false };
  const d = new Date(iso);
  const diff = Math.round((d.getTime() - Date.now()) / 86400000);
  if (diff === 0) return { label: "Today", overdue: true };
  if (diff === 1) return { label: "Tomorrow", overdue: false };
  if (diff === -1) return { label: "Yesterday", overdue: true };
  if (diff > 0) return { label: `In ${diff}d`, overdue: false };
  return { label: `${Math.abs(diff)}d ago`, overdue: true };
}

const cardBase: React.CSSProperties = {
  background: "#ffffff",
  border: "0.5px solid #e2e6ed",
  borderRadius: 10,
  padding: "12px 14px",
  boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 12,
  padding: "5px 8px",
  borderRadius: 6,
  border: "0.5px solid #e2e6ed",
  background: "#f5f6f8",
  color: "#0c2340",
  boxSizing: "border-box" as const,
};

// ─── TaskCard ─────────────────────────────────────────────────────────────────
function TaskCard({
  task,
  internalUsers,
  googleConnected,
  onStatusChange,
  onDelete,
  onSave,
  onCalendarUpdate,
}: {
  task: Task;
  internalUsers: InternalUser[];
  googleConnected: boolean;
  onStatusChange: (id: string, s: TaskStatus) => void;
  onDelete: (id: string) => void;
  onSave: (id: string, patch: Partial<Task>) => Promise<void>;
  onCalendarUpdate: (id: string, eventId: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calLoading, setCalLoading] = useState(false);
  const [form, setForm] = useState({
    title:         task.title,
    description:   task.description ?? "",
    priority:      task.priority,
    due_date:      task.due_date ? task.due_date.slice(0, 10) : "",
    assigned_to:   task.assigned_to ?? "",
    task_category: task.task_category ?? ("" as TaskCategory | ""),
  });

  const pc = PRIORITY_MAP[task.priority];
  const assignee = task.assigned_to
    ? internalUsers.find((u) => u.id === task.assigned_to) ?? null
    : null;
  const { label: dateLabel, overdue } = relativeDate(task.due_date);

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    await onSave(task.id, {
      title:         form.title.trim(),
      description:   form.description.trim() || null,
      priority:      form.priority,
      due_date:      form.due_date || null,
      assigned_to:   form.assigned_to || null,
      task_category: (form.task_category || null) as TaskCategory | null,
    } as Partial<Task>);
    setSaving(false);
    setEditing(false);
  }

  function handleCancel() {
    setForm({
      title:         task.title,
      description:   task.description ?? "",
      priority:      task.priority,
      due_date:      task.due_date ? task.due_date.slice(0, 10) : "",
      assigned_to:   task.assigned_to ?? "",
      task_category: task.task_category ?? "",
    });
    setEditing(false);
  }

  async function handleCalendarToggle() {
    if (!task.due_date) return;
    setCalLoading(true);
    try {
      if (task.google_calendar_event_id) {
        await fetch(`/api/tasks/${task.id}/calendar`, { method: "DELETE" });
        onCalendarUpdate(task.id, null);
      } else {
        const res = await fetch(`/api/tasks/${task.id}/calendar`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          onCalendarUpdate(task.id, data.google_calendar_event_id ?? null);
        }
      }
    } finally {
      setCalLoading(false);
    }
  }

  // ── Edit mode ──────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div style={{ ...cardBase, border: "0.5px solid #2E78F5" }}>
        <div style={{ marginBottom: 8 }}>
          <input
            autoFocus
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
            style={{ ...inputStyle, fontSize: 13, fontWeight: 500, padding: "6px 8px" }}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description (optional)"
            rows={2}
            style={{ ...inputStyle, resize: "vertical" as const, lineHeight: 1.5 }}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
            style={inputStyle}
          >
            <option value="high">🔴 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>
          <input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <select
            value={form.assigned_to}
            onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
            style={inputStyle}
          >
            <option value="">— Unassigned —</option>
            {internalUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name ?? u.email ?? u.id}
              </option>
            ))}
          </select>
        </div>
        {/* Department picker */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 5 }}>Department</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>
            {DEPT_KEYS.map((k) => {
              const d = DEPT_MAP[k];
              const active = form.task_category === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setForm({ ...form, task_category: active ? "" : k })}
                  style={{
                    fontSize: 10, padding: "3px 9px", borderRadius: 5, cursor: "pointer",
                    fontWeight: 500,
                    background: active ? d.bg : "transparent",
                    color: active ? d.color : "#64748b",
                    border: active ? `1px solid ${d.dot}` : "0.5px solid #e2e6ed",
                  }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
            style={{
              fontSize: 11, padding: "4px 12px", borderRadius: 6, border: "none",
              background: "#2E78F5", color: "#EEEDFE", cursor: "pointer",
              opacity: !form.title.trim() ? 0.5 : 1,
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={handleCancel}
            style={{
              fontSize: 11, padding: "4px 10px", borderRadius: 6,
              border: "0.5px solid #e2e6ed", background: "transparent",
              cursor: "pointer", color: "#64748b",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── View mode ──────────────────────────────────────────────────────────────
  return (
    <div style={cardBase}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#0c2340", lineHeight: 1.4, flex: 1 }}>
          {task.title}
        </div>
        <div style={{ display: "flex", gap: 3, flexShrink: 0, alignItems: "center" }}>
          {googleConnected && task.due_date && (
            <button
              onClick={() => void handleCalendarToggle()}
              disabled={calLoading}
              title={task.google_calendar_event_id ? "Remove from Google Calendar" : "Add to Google Calendar"}
              style={{
                background: task.google_calendar_event_id ? GCAL_PURPLE : "none",
                border: task.google_calendar_event_id ? "none" : `0.5px solid ${GCAL_PURPLE}`,
                borderRadius: 4, cursor: "pointer", padding: "1px 5px",
                fontSize: 10, fontWeight: 500,
                color: task.google_calendar_event_id ? GCAL_LIGHT : GCAL_PURPLE,
                opacity: calLoading ? 0.5 : 1,
              }}
            >
              {calLoading ? "…" : task.google_calendar_event_id ? "📅 Synced" : "📅 Add"}
            </button>
          )}
          <button
            onClick={() => setEditing(true)}
            title="Edit task"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 13, opacity: 0.65, padding: "0 2px" }}
          >
            ✎
          </button>
          <button
            onClick={() => onDelete(task.id)}
            title="Delete task"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 11, opacity: 0.55, padding: "0 2px" }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Department badge */}
      {task.task_category && (() => {
        const d = DEPT_MAP[task.task_category];
        return (
          <div style={{ marginBottom: 5 }}>
            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: d.bg, color: d.color, fontWeight: 500 }}>
              {d.label}
            </span>
          </div>
        );
      })()}

      {task.description && (
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, lineHeight: 1.5 }}>
          {task.description}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: pc.bg, color: pc.color, fontWeight: 500 }}>
          {task.priority}
        </span>
        {task.due_date && (
          <span style={{ fontSize: 10, color: overdue ? "#A32D2D" : "#64748b", fontWeight: overdue ? 500 : 400 }}>
            📅 {dateLabel}
          </span>
        )}
      </div>

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
          <span style={{ fontSize: 11, color: "#64748b" }}>
            {assignee.full_name ?? assignee.email ?? "Assignee"}
          </span>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8, fontStyle: "italic" }}>
          Unassigned
        </div>
      )}

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {(["todo", "in_progress", "done", "cancelled"] as TaskStatus[])
          .filter((s) => s !== task.status)
          .map((s) => {
            const ssc = STATUS_MAP[s];
            return (
              <button
                key={s}
                onClick={() => onStatusChange(task.id, s)}
                style={{
                  fontSize: 10, padding: "2px 7px", borderRadius: 6,
                  border: `0.5px solid ${ssc.color}30`,
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
}

// ─── Column ───────────────────────────────────────────────────────────────────
function Column({
  status,
  tasks,
  internalUsers,
  googleConnected,
  onStatusChange,
  onDelete,
  onSave,
  onCalendarUpdate,
}: {
  status: TaskStatus;
  tasks: Task[];
  internalUsers: InternalUser[];
  googleConnected: boolean;
  onStatusChange: (id: string, s: TaskStatus) => void;
  onDelete: (id: string) => void;
  onSave: (id: string, patch: Partial<Task>) => Promise<void>;
  onCalendarUpdate: (id: string, eventId: string | null) => void;
}) {
  const sc = STATUS_MAP[status];
  return (
    <div style={{ flex: 1, minWidth: 240 }}>
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
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            internalUsers={internalUsers}
            googleConnected={googleConnected}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
            onSave={onSave}
            onCalendarUpdate={onCalendarUpdate}
          />
        ))}
      </div>
    </div>
  );
}

// ─── ListView ─────────────────────────────────────────────────────────────────
function ListView({
  tasks,
  internalUsers,
  googleConnected,
  onStatusChange,
  onDelete,
  onSave,
  onCalendarUpdate,
}: {
  tasks: Task[];
  internalUsers: InternalUser[];
  googleConnected: boolean;
  onStatusChange: (id: string, s: TaskStatus) => void;
  onDelete: (id: string) => void;
  onSave: (id: string, patch: Partial<Task>) => Promise<void>;
  onCalendarUpdate: (id: string, eventId: string | null) => void;
}) {
  // Editing state for inline row edit
  const [editingId, setEditingId] = useState<string | null>(null);

  if (tasks.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 13 }}>
        No tasks found.
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" as const }}>
        <colgroup>
          <col style={{ width: "26%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "9%" }} />
        </colgroup>
        <thead>
          <tr style={{ background: "#f8f9fb", borderBottom: "0.5px solid #e2e6ed" }}>
            {["Task", "Dept", "Status", "Priority", "Assignee", "Due", "Calendar", ""].map((h) => (
              <th key={h} style={{ fontSize: 11, fontWeight: 500, color: "#64748b", padding: "8px 12px", textAlign: "left" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, i) => {
            const sc = STATUS_MAP[task.status];
            const pc = PRIORITY_MAP[task.priority];
            const assignee = task.assigned_to
              ? internalUsers.find((u) => u.id === task.assigned_to) ?? null
              : null;
            const { label: dateLabel, overdue } = relativeDate(task.due_date);
            const isDone = task.status === "done" || task.status === "cancelled";

            if (editingId === task.id) {
              return (
                <tr key={task.id} style={{ borderBottom: i < tasks.length - 1 ? "0.5px solid #e2e6ed" : undefined }}>
                  <td colSpan={7} style={{ padding: "10px 12px" }}>
                    <TaskCard
                      task={task}
                      internalUsers={internalUsers}
                      googleConnected={googleConnected}
                      onStatusChange={(id, s) => { onStatusChange(id, s); setEditingId(null); }}
                      onDelete={(id) => { onDelete(id); setEditingId(null); }}
                      onSave={async (id, patch) => { await onSave(id, patch); setEditingId(null); }}
                      onCalendarUpdate={onCalendarUpdate}
                    />
                  </td>
                </tr>
              );
            }

            return (
              <tr
                key={task.id}
                style={{
                  borderBottom: i < tasks.length - 1 ? "0.5px solid #e2e6ed" : undefined,
                  opacity: isDone ? 0.6 : 1,
                }}
              >
                <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 500, color: "#0c2340", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }} title={task.title}>
                  {task.title}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  {task.task_category ? (() => {
                    const d = DEPT_MAP[task.task_category];
                    return (
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: d.bg, color: d.color, fontWeight: 500, whiteSpace: "nowrap" as const }}>
                        {d.label}
                      </span>
                    );
                  })() : <span style={{ fontSize: 11, color: "#94a3b8" }}>—</span>}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: sc.bg, color: sc.color, fontWeight: 500, whiteSpace: "nowrap" as const }}>
                    {sc.label}
                  </span>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 10, background: pc.bg, color: pc.color, fontWeight: 500 }}>
                    {task.priority}
                  </span>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  {assignee ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                        background: avatarColor(assignee.id),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, fontWeight: 700, color: "#fff",
                      }}>
                        {initials(assignee.full_name, assignee.email)}
                      </div>
                      <span style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                        {assignee.full_name ?? assignee.email}
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>Unassigned</span>
                  )}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  {task.due_date ? (
                    <span style={{ fontSize: 11, color: overdue ? "#A32D2D" : "#64748b", fontWeight: overdue ? 500 : 400 }}>
                      {dateLabel}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>—</span>
                  )}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  {googleConnected && task.due_date ? (
                    <CalendarCellButton task={task} onCalendarUpdate={onCalendarUpdate} />
                  ) : (
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>—</span>
                  )}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right" as const }}>
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setEditingId(task.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 13, opacity: 0.65, padding: "0 2px" }}
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => onDelete(task.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 11, opacity: 0.55, padding: "0 2px" }}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Small inline calendar toggle button for list view
function CalendarCellButton({ task, onCalendarUpdate }: { task: Task; onCalendarUpdate: (id: string, eventId: string | null) => void }) {
  const [loading, setLoading] = useState(false);
  async function toggle() {
    setLoading(true);
    try {
      if (task.google_calendar_event_id) {
        await fetch(`/api/tasks/${task.id}/calendar`, { method: "DELETE" });
        onCalendarUpdate(task.id, null);
      } else {
        const res = await fetch(`/api/tasks/${task.id}/calendar`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          onCalendarUpdate(task.id, data.google_calendar_event_id ?? null);
        }
      }
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      onClick={() => void toggle()}
      disabled={loading}
      style={{
        fontSize: 10, padding: "2px 6px", borderRadius: 5, cursor: "pointer", fontWeight: 500,
        background: task.google_calendar_event_id ? GCAL_PURPLE : GCAL_LIGHT,
        border: `0.5px solid ${GCAL_PURPLE}`,
        color: task.google_calendar_event_id ? GCAL_LIGHT : GCAL_PURPLE,
        opacity: loading ? 0.5 : 1,
        whiteSpace: "nowrap" as const,
      }}
    >
      {loading ? "…" : task.google_calendar_event_id ? "📅 Synced" : "📅 Add"}
    </button>
  );
}

// ─── TasksClient (main) ───────────────────────────────────────────────────────
interface Props {
  initialTasks: Task[];
  internalUsers: InternalUser[];
  currentUserId: string;
  googleConnected: boolean;
  googleStatus: GoogleConnectionStatus;
}

export function TasksClient({ initialTasks, internalUsers, currentUserId, googleConnected, googleStatus }: Props) {
  const [tasks, setTasks]         = useState<Task[]>(initialTasks);
  const [viewMode, setViewMode]   = useState<ViewMode>("kanban");
  const [activeCat, setActiveCat] = useState<ActiveCat>("all");
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);

  // Filters
  const [search,         setSearch]         = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterDue,      setFilterDue]      = useState("");

  const [form, setForm] = useState({
    title:         "",
    description:   "",
    assigned_to:   "",
    priority:      "medium" as TaskPriority,
    due_date:      "",
    task_category: "" as TaskCategory | "",
    context_type:  "internal" as const,
  });

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) setTasks(await res.json());
    } catch (err) {
      console.error("Failed to reload tasks:", err);
    }
  }, []);

  async function handleCreate() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:         form.title.trim(),
          description:   form.description.trim() || null,
          assigned_to:   form.assigned_to || null,
          priority:      form.priority,
          due_date:      form.due_date || null,
          task_category: form.task_category || null,
          context_type:  "internal",
        }),
      });
      setForm({ title: "", description: "", assigned_to: "", priority: "medium", due_date: "", task_category: "", context_type: "internal" });
      setShowForm(false);
      reload();
    } catch (err) {
      console.error("Failed to create task:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(id: string, status: TaskStatus) {
    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      reload();
    } catch (err) {
      console.error("Failed to update task status:", err);
    }
  }

  async function handleSave(id: string, patch: Partial<Task>) {
    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      reload();
    } catch (err) {
      console.error("Failed to save task:", err);
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirmDialog({ message: "Delete this task?", danger: true, confirmLabel: "Delete" }))) return;
    try {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  }

  function handleCalendarUpdate(id: string, eventId: string | null) {
    setTasks((prev) =>
      prev.map((t) => t.id === id ? { ...t, google_calendar_event_id: eventId } : t)
    );
  }

  // ── Filtered tasks ──────────────────────────────────────────────────────────
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (activeCat !== "all" && t.task_category !== activeCat) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterAssignee && t.assigned_to !== filterAssignee) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterDue) {
        if (!t.due_date) return false;
        // eslint-disable-next-line react-hooks/purity
        const diff = Math.round((new Date(t.due_date).getTime() - Date.now()) / 86400000);
        if (filterDue === "overdue" && diff >= 0) return false;
        if (filterDue === "today" && diff !== 0) return false;
        if (filterDue === "week" && (diff < 0 || diff > 7)) return false;
        if (filterDue === "month" && (diff < 0 || diff > 30)) return false;
      }
      return true;
    });
  }, [tasks, activeCat, search, filterAssignee, filterPriority, filterDue]);

  const byStatus = (s: TaskStatus) => filteredTasks.filter((t) => t.status === s);

  const total  = tasks.length;
  const todo   = tasks.filter((t) => t.status === "todo").length;
  const inProg = tasks.filter((t) => t.status === "in_progress").length;
  const done   = tasks.filter((t) => t.status === "done").length;

  void currentUserId;

  // Shared card props
  const sharedCardProps = {
    internalUsers,
    googleConnected,
    onStatusChange: handleStatusChange,
    onDelete: handleDelete,
    onSave: handleSave,
    onCalendarUpdate: handleCalendarUpdate,
  };

  const filterSelectStyle: React.CSSProperties = {
    fontSize: 12, padding: "5px 8px", borderRadius: 7,
    border: "0.5px solid #e2e6ed", background: "#f5f6f8",
    color: "#0c2340", cursor: "pointer",
  };

  return (
    <div style={{ padding: 24 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, color: "#0c2340", marginBottom: 3 }}>Team Tasks</h1>
          <div style={{ fontSize: 12, color: "#64748b" }}>Manage and assign tasks across your team</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* View toggle */}
          <div style={{ display: "flex", border: "0.5px solid #e2e6ed", borderRadius: 8, overflow: "hidden" }}>
            {(["kanban", "list"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                style={{
                  padding: "5px 12px", fontSize: 12, border: "none", cursor: "pointer",
                  background: viewMode === v ? "#2E78F5" : "transparent",
                  color: viewMode === v ? "#EEEDFE" : "#64748b",
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                {v === "kanban" ? "⊞" : "≡"} {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          {/* Assign button */}
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              display: "flex", alignItems: "center", gap: 5, fontSize: 12,
              padding: "6px 14px", borderRadius: 8, border: "none",
              background: "#2E78F5", color: "#EEEDFE", cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Assign task
          </button>
        </div>
      </div>

      {/* ── Department tabs ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {/* All tasks tab */}
        <button
          onClick={() => setActiveCat("all")}
          style={{
            fontSize: 12, padding: "5px 14px", borderRadius: 20, cursor: "pointer",
            border: activeCat === "all" ? "1.5px solid #94a3b8" : "0.5px solid #e2e6ed",
            background: activeCat === "all" ? "#f1f5f9" : "#fff",
            color: activeCat === "all" ? "#0c2340" : "#64748b",
            fontWeight: activeCat === "all" ? 500 : 400,
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          All tasks
          <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 8, background: "rgba(0,0,0,0.07)" }}>
            {tasks.length}
          </span>
        </button>
        {DEPT_KEYS.map((k) => {
          const d = DEPT_MAP[k];
          const isActive = activeCat === k;
          const count = tasks.filter((t) => t.task_category === k).length;
          return (
            <button
              key={k}
              onClick={() => setActiveCat(k)}
              style={{
                fontSize: 12, padding: "5px 14px", borderRadius: 20, cursor: "pointer",
                border: isActive ? `1.5px solid ${d.dot}` : "0.5px solid #e2e6ed",
                background: isActive ? d.bg : "#fff",
                color: isActive ? d.color : "#64748b",
                fontWeight: isActive ? 500 : 400,
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: d.dot, flexShrink: 0, display: "inline-block" }} />
              {d.label}
              <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 8, background: "rgba(0,0,0,0.07)" }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Total tasks", value: total,  color: "#0c2340" },
          { label: "To-do",       value: todo,   color: "#2E78F5" },
          { label: "In progress", value: inProg, color: "#185FA5" },
          { label: "Done",        value: done,   color: "#0F6E56" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "#fff", borderRadius: 8, padding: "12px 14px", border: "0.5px solid #e2e6ed" }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 500, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks…"
          style={{ ...filterSelectStyle, width: 180 }}
        />
        <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} style={filterSelectStyle}>
          <option value="">All assignees</option>
          {internalUsers.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name ?? u.email}</option>
          ))}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} style={filterSelectStyle}>
          <option value="">All priorities</option>
          <option value="high">🔴 High</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">🟢 Low</option>
        </select>
        <select value={filterDue} onChange={(e) => setFilterDue(e.target.value)} style={filterSelectStyle}>
          <option value="">All due dates</option>
          <option value="overdue">Overdue</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
        {(search || filterAssignee || filterPriority || filterDue) && (
          <button
            onClick={() => { setSearch(""); setFilterAssignee(""); setFilterPriority(""); setFilterDue(""); }}
            style={{ fontSize: 11, color: "#64748b", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Create form ── */}
      {showForm && (
        <div style={{ background: "#ffffff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: "18px 20px", marginBottom: 20, boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)" }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#0c2340", marginBottom: 14 }}>Create & assign task</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Task title *</label>
              <input
                autoFocus type="text" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowForm(false); }}
                placeholder="What needs to be done?"
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid #e2e6ed", background: "#f5f6f8", color: "#0c2340", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Description (optional)</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2} placeholder="Additional context…"
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid #e2e6ed", background: "#f5f6f8", color: "#0c2340", resize: "vertical", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 6 }}>Department</label>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" as const }}>
                {DEPT_KEYS.map((k) => {
                  const d = DEPT_MAP[k];
                  const active = form.task_category === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setForm({ ...form, task_category: active ? "" : k })}
                      style={{
                        fontSize: 12, padding: "5px 13px", borderRadius: 6, cursor: "pointer",
                        fontWeight: 500,
                        background: active ? d.bg : "transparent",
                        color: active ? d.color : "#64748b",
                        border: active ? `1.5px solid ${d.dot}` : "0.5px solid #e2e6ed",
                      }}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Assign to</label>
              <select
                value={form.assigned_to}
                onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid #e2e6ed", background: "#f5f6f8", color: "#0c2340" }}
              >
                <option value="">— Unassigned —</option>
                {internalUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name ?? u.email ?? u.id}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid #e2e6ed", background: "#f5f6f8", color: "#0c2340" }}
              >
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Due date (optional)</label>
              <input
                type="date" value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid #e2e6ed", background: "#f5f6f8", color: "#0c2340" }}
              />
            </div>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button
              onClick={handleCreate}
              disabled={saving || !form.title.trim()}
              style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#2E78F5", color: "#EEEDFE", cursor: "pointer", opacity: !form.title.trim() ? 0.5 : 1 }}
            >
              {saving ? "Creating…" : "Create task"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "0.5px solid #e2e6ed", background: "transparent", cursor: "pointer", color: "#0c2340" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Kanban board ── */}
      <div style={{ display: viewMode === "kanban" ? "flex" : "none", gap: 16, alignItems: "flex-start", overflowX: "auto", paddingBottom: 8 }}>
        {(["todo", "in_progress", "done", "cancelled"] as TaskStatus[]).map((s) => (
          <Column
            key={s}
            status={s}
            tasks={byStatus(s)}
            {...sharedCardProps}
          />
        ))}
      </div>

      {/* ── List view ── */}
      <div style={{ display: viewMode === "list" ? "block" : "none" }}>
        <ListView tasks={filteredTasks} {...sharedCardProps} />
      </div>

      {/* ── Google Calendar connector — bottom ── */}
      <div style={{
        marginTop: 24, border: "0.5px solid #e2e6ed", borderRadius: 12,
        padding: "13px 18px", background: "#ffffff",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8, background: GCAL_LIGHT,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <span style={{ fontSize: 18 }}>📅</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#0c2340", marginBottom: 2 }}>
            {googleConnected ? "Google Calendar connected" : "Connect Google Calendar"}
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            {googleConnected
              ? "Task due dates sync automatically to your calendar."
              : "Sync task due dates to your calendar for automatic reminders."}
          </div>
        </div>
        {!googleConnected && (
          <a
            href="/api/integrations/google/connect?returnTo=/admin/tasks"
            style={{
              fontSize: 12, padding: "6px 14px", borderRadius: 8,
              border: `0.5px solid ${GCAL_PURPLE}`, background: GCAL_LIGHT,
              color: GCAL_PURPLE, textDecoration: "none", flexShrink: 0,
              fontWeight: 500,
            }}
          >
            Connect Google Calendar
          </a>
        )}
        {googleConnected && (
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: "#E1F5EE", color: "#0F6E56", fontWeight: 500, flexShrink: 0 }}>
            ✓ Connected
          </span>
        )}
      </div>

    </div>
  );
}
