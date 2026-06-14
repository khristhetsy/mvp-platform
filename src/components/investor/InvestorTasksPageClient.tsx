"use client";

import { useState, useEffect, useCallback } from "react";
import type { Task, TaskStatus, TaskPriority, TaskCategory } from "@/lib/tasks/types";

/* ─── constants ─────────────────────────────────────────────────── */

const PRIORITY_STYLES: Record<TaskPriority, { pill: string; label: string }> = {
  high:   { pill: "bg-red-50 text-red-700",      label: "High" },
  medium: { pill: "bg-amber-50 text-amber-700",   label: "Medium" },
  low:    { pill: "bg-emerald-50 text-emerald-700", label: "Low" },
};

const CATEGORY_META: Record<TaskCategory, { label: string; pill: string; dot: string }> = {
  marketing:  { label: "Marketing",  pill: "bg-pink-50 text-pink-800",   dot: "bg-pink-400" },
  ir_dept:    { label: "IR Dept",    pill: "bg-blue-50 text-blue-800",   dot: "bg-blue-400" },
  admin_dept: { label: "Admin Dept", pill: "bg-purple-50 text-purple-800", dot: "bg-purple-400" },
  sales_dept: { label: "Sales Dept", pill: "bg-teal-50 text-teal-800",   dot: "bg-teal-500" },
};

const ALL_CATEGORIES = Object.keys(CATEGORY_META) as TaskCategory[];

type ViewMode = "list" | "kanban" | "timeline" | "grid";
type TabKey   = "active" | "all" | "done";

/* ─── helpers ───────────────────────────────────────────────────── */

function fmt(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isOverdue(iso: string | null, isDone: boolean): boolean {
  if (!iso || isDone) return false;
  return new Date(iso).setHours(0, 0, 0, 0) < Date.now();
}

function groupByDate(tasks: Task[]): { label: string; tasks: Task[] }[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdue: Task[] = [], todayArr: Task[] = [], upcoming: Record<string, Task[]> = {}, noDue: Task[] = [];

  for (const t of tasks) {
    if (!t.due_date) { noDue.push(t); continue; }
    const d = new Date(t.due_date); d.setHours(0, 0, 0, 0);
    if (d < today) { overdue.push(t); }
    else if (d.getTime() === today.getTime()) { todayArr.push(t); }
    else {
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      upcoming[key] = [...(upcoming[key] ?? []), t];
    }
  }

  const groups: { label: string; tasks: Task[] }[] = [];
  if (overdue.length) groups.push({ label: "Overdue", tasks: overdue });
  if (todayArr.length) groups.push({ label: "Today", tasks: todayArr });
  for (const [label, arr] of Object.entries(upcoming)) groups.push({ label, tasks: arr });
  if (noDue.length) groups.push({ label: "No due date", tasks: noDue });
  return groups;
}

/* strip of 7 calendar days */
function buildDateStrip() {
  const days: { label: string; num: number; date: Date }[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = -1; i <= 5; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    days.push({ label: d.toLocaleDateString("en-US", { weekday: "short" }), num: d.getDate(), date: d });
  }
  return { days, today };
}

/* ─── sub-components ────────────────────────────────────────────── */

function CheckCircle({ done }: { done: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="9" cy="9" r="8"
        stroke={done ? "#534AB7" : "#cbd5e1"} strokeWidth="1.5"
        fill={done ? "#534AB7" : "transparent"} />
      {done && <path d="M5.5 9l2.5 2.5 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

function CategoryPill({ cat }: { cat: TaskCategory | null }) {
  if (!cat) return null;
  const m = CATEGORY_META[cat];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.pill}`}>
      {m.label}
    </span>
  );
}

function PriorityPill({ priority }: { priority: TaskPriority }) {
  const s = PRIORITY_STYLES[priority];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.pill}`}>{s.label}</span>;
}

/* ─── edit form type ────────────────────────────────────────────── */

type EditForm = {
  title: string;
  description: string;
  priority: TaskPriority;
  due_date: string;
  task_category: TaskCategory | "";
};

/* ─── main component ────────────────────────────────────────────── */

export function InvestorTasksPageClient({
  googleConnected = false,
}: Readonly<{ googleConnected?: boolean }>) {

  const [tasks, setTasks]     = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView]       = useState<ViewMode>("list");
  const [tab, setTab]         = useState<TabKey>("active");
  const [query, setQuery]     = useState("");
  const [catFilter, setCatFilter] = useState<TaskCategory | null>(null);

  /* quick-add */
  const [showForm, setShowForm]         = useState(false);
  const [newTitle, setNewTitle]         = useState("");
  const [newPriority, setNewPriority]   = useState<TaskPriority>("medium");
  const [newDueDate, setNewDueDate]     = useState("");
  const [newCategory, setNewCategory]   = useState<TaskCategory | "">("");
  const [saving, setSaving]             = useState(false);

  /* inline edit */
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [editForm, setEditForm]         = useState<EditForm | null>(null);
  const [editSaving, setEditSaving]     = useState(false);

  /* per-task ops */
  const [calSyncing, setCalSyncing]     = useState<string | null>(null);
  const [toggling, setToggling]         = useState<string | null>(null);
  const [deleting, setDeleting]         = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) setTasks(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* ── actions ── */
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
        task_category: newCategory || null,
        context_type: "personal",
      }),
    });
    setSaving(false);
    setNewTitle(""); setNewPriority("medium"); setNewDueDate(""); setNewCategory(""); setShowForm(false);
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
    setDeleting(id);
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    setDeleting(null);
    if (expandedId === id) { setExpandedId(null); setEditForm(null); }
    void load();
  }

  function toggleExpand(task: Task) {
    if (expandedId === task.id) { setExpandedId(null); setEditForm(null); return; }
    setExpandedId(task.id);
    setEditForm({
      title:         task.title,
      description:   task.description ?? "",
      priority:      task.priority,
      due_date:      task.due_date?.slice(0, 10) ?? "",
      task_category: task.task_category ?? "",
    });
  }

  async function handleEditSave(taskId: string) {
    if (!editForm?.title.trim()) return;
    setEditSaving(true);
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title:         editForm.title.trim(),
        description:   editForm.description || null,
        priority:      editForm.priority,
        due_date:      editForm.due_date || null,
        task_category: editForm.task_category || null,
      }),
    });
    setEditSaving(false);
    if (res.ok) { setExpandedId(null); setEditForm(null); void load(); }
  }

  async function syncToCalendar(task: Task) {
    setCalSyncing(task.id);
    await fetch(`/api/tasks/${task.id}/calendar`, { method: "POST" });
    setCalSyncing(null); void load();
  }

  async function unsyncFromCalendar(task: Task) {
    setCalSyncing(task.id);
    await fetch(`/api/tasks/${task.id}/calendar`, { method: "DELETE" });
    setCalSyncing(null); void load();
  }

  /* ── derived ── */
  const activeTasks  = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const doneTasks    = tasks.filter((t) => t.status === "done");
  const overdueTasks = activeTasks.filter((t) => isOverdue(t.due_date, false));

  const tabFiltered =
    tab === "active" ? activeTasks :
    tab === "done"   ? doneTasks   : tasks;

  const visible = tabFiltered
    .filter((t) => !catFilter || t.task_category === catFilter)
    .filter((t) => !query.trim() || t.title.toLowerCase().includes(query.toLowerCase()));

  /* ── shared toolbar + filters ── */
  const toolbar = (
    <>
      {/* stat row */}
      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-200 pb-5">
        {[
          { label: "Active",  val: activeTasks.length,  cls: "" },
          { label: "Overdue", val: overdueTasks.length, cls: overdueTasks.length > 0 ? "text-red-600" : "" },
          { label: "Done",    val: doneTasks.length,    cls: "text-emerald-600" },
          { label: "Total",   val: tasks.length,        cls: "" },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5">
            <span className={`text-xl font-semibold leading-none text-slate-900 ${s.cls}`}>{s.val}</span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{s.label}</span>
          </div>
        ))}
      </div>

      {/* toolbar row */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* status tabs */}
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {(["active", "all", "done"] as TabKey[]).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                tab === t ? "border border-slate-200 bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}>
              {t === "active" ? "Active" : t === "done" ? "Done" : "All"}
            </button>
          ))}
        </div>

        {/* search */}
        <input type="search" placeholder="Search tasks…" value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-[140px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none" />

        {/* view toggle */}
        <div className="flex overflow-hidden rounded-lg border border-slate-200">
          {([
            { id: "list",     icon: "≡",  title: "List" },
            { id: "kanban",   icon: "⊞",  title: "Kanban" },
            { id: "timeline", icon: "📅", title: "Timeline" },
            { id: "grid",     icon: "⊟",  title: "Grid" },
          ] as { id: ViewMode; icon: string; title: string }[]).map((v, i) => (
            <button key={v.id} type="button" title={v.title} onClick={() => setView(v.id)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${i > 0 ? "border-l border-slate-200" : ""} ${
                view === v.id ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}>
              {v.title}
            </button>
          ))}
        </div>

        {/* add task */}
        <button type="button" onClick={() => setShowForm(!showForm)}
          className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
          + Add task
        </button>
      </div>

      {/* category filter pills */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setCatFilter(null)}
          className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
            !catFilter ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700"
          }`}>All</button>
        {ALL_CATEGORIES.map((cat) => {
          const m = CATEGORY_META[cat];
          const active = catFilter === cat;
          return (
            <button key={cat} type="button" onClick={() => setCatFilter(active ? null : cat)}
              className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                active ? `${m.pill} border-transparent` : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}>
              {m.label}
            </button>
          );
        })}
      </div>

      {/* quick-add form */}
      {showForm && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <input autoFocus type="text" placeholder="Task title…" value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); if (e.key === "Escape") setShowForm(false); }}
            className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none" />
          <div className="flex flex-wrap gap-2">
            <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as TaskCategory | "")}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none">
              <option value="">Category</option>
              {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
            </select>
            <select value={newPriority} onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none">
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none" />
            <button type="button" onClick={() => void handleCreate()} disabled={saving || !newTitle.trim()}
              className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50">
              {saving ? "…" : "Save"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100">✕</button>
          </div>
        </div>
      )}
    </>
  );

  /* ── inline detail panel (shared) ── */
  function DetailPanel({ task }: { task: Task }) {
    const isDone   = task.status === "done";
    const isSynced = !!task.google_calendar_event_id;
    const hasDue   = !!(editForm?.due_date || task.due_date);

    return (
      <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-4">
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-[10.5px] font-medium text-slate-500">Title</label>
            <input type="text" value={editForm?.title ?? ""} onChange={(e) => setEditForm(f => f ? { ...f, title: e.target.value } : f)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] font-medium text-slate-500">Category</label>
            <select value={editForm?.task_category ?? ""} onChange={(e) => setEditForm(f => f ? { ...f, task_category: e.target.value as TaskCategory | "" } : f)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none">
              <option value="">None</option>
              {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] font-medium text-slate-500">Priority</label>
            <select value={editForm?.priority ?? "medium"} onChange={(e) => setEditForm(f => f ? { ...f, priority: e.target.value as TaskPriority } : f)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none">
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-[10.5px] font-medium text-slate-500">Due date</label>
            <input type="date" value={editForm?.due_date ?? ""} onChange={(e) => setEditForm(f => f ? { ...f, due_date: e.target.value } : f)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-[10.5px] font-medium text-slate-500">Notes</label>
            <textarea rows={3} value={editForm?.description ?? ""} onChange={(e) => setEditForm(f => f ? { ...f, description: e.target.value } : f)}
              placeholder="Add context, links, or next steps…"
              className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none" />
          </div>
        </div>

        {/* Google Calendar */}
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
                {!googleConnected ? "Connect Google in Settings to enable"
                  : !hasDue ? "Set a due date to add to calendar"
                  : isSynced ? "Event added — Google will send reminders"
                  : "Adds an all-day event with Google's built-in reminders"}
              </p>
            </div>
            {googleConnected && hasDue && !isDone && (
              isSynced ? (
                <button type="button" onClick={() => void unsyncFromCalendar(task)} disabled={calSyncing === task.id}
                  className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-100 disabled:opacity-50">
                  {calSyncing === task.id ? "…" : "Remove"}
                </button>
              ) : (
                <button type="button" onClick={() => void syncToCalendar(task)} disabled={calSyncing === task.id}
                  className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-100 disabled:opacity-50">
                  {calSyncing === task.id ? "Adding…" : "Add to Calendar"}
                </button>
              )
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => { setExpandedId(null); setEditForm(null); }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100">Cancel</button>
          <button type="button" onClick={() => void handleEditSave(task.id)} disabled={editSaving || !editForm?.title.trim()}
            className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50">
            {editSaving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────── */
  /* LIST VIEW                                                        */
  /* ─────────────────────────────────────────────────────────────── */
  function ListView() {
    const groups = groupByDate(visible.filter((t) => t.status !== "done"));
    const done   = visible.filter((t) => t.status === "done");

    const renderRow = (task: Task, idx: number, groupFirst: boolean) => {
      const isDone   = task.status === "done";
      const overdue  = isOverdue(task.due_date, isDone);
      const isOpen   = expandedId === task.id;
      const isSynced = !!task.google_calendar_event_id;

      return (
        <div key={task.id} className={!groupFirst || idx > 0 ? "border-t border-slate-100" : ""}>
          <div className={`flex items-start gap-3 px-4 py-3 transition-colors ${isOpen ? "bg-slate-50" : "hover:bg-slate-50/60"} ${isDone ? "opacity-55" : ""}`}>
            <button type="button" onClick={() => void toggleDone(task)} disabled={toggling === task.id}
              className="mt-0.5 cursor-pointer border-none bg-transparent p-0" aria-label={isDone ? "Mark incomplete" : "Mark complete"}>
              <CheckCircle done={isDone} />
            </button>
            <button type="button" onClick={() => toggleExpand(task)}
              className="min-w-0 flex-1 cursor-pointer border-none bg-transparent p-0 text-left">
              <p className={`text-sm font-medium leading-snug text-slate-900 ${isDone ? "line-through" : ""}`}>{task.title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <CategoryPill cat={task.task_category} />
                <PriorityPill priority={task.priority} />
                {task.due_date && (
                  <span className={`text-[11px] ${overdue ? "text-red-500" : "text-slate-400"}`}>
                    {overdue ? "⚠ " : ""}{fmt(task.due_date)}
                  </span>
                )}
                {isSynced && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">In Calendar</span>
                )}
                {task.description && !isOpen && (
                  <span className="max-w-[200px] truncate text-[10.5px] italic text-slate-400">{task.description}</span>
                )}
              </div>
            </button>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={() => toggleExpand(task)}
                className="rounded-md p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500" aria-label={isOpen ? "Collapse" : "Expand"}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d={isOpen ? "M3 9l4-4 4 4" : "M3 5l4 4 4-4"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {deleting === task.id ? <span className="px-1 text-xs text-slate-300">…</span> : (
                <button type="button" onClick={() => void handleDelete(task.id)}
                  className="rounded-md p-1 text-slate-300 hover:bg-red-50 hover:text-red-500" aria-label="Delete task">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                    <path d="M2 2l9 9M11 2l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          {isOpen && editForm && <DetailPanel task={task} />}
        </div>
      );
    };

    if (loading) return <EmptyShell><p className="text-sm text-slate-500">Loading…</p></EmptyShell>;
    if (!visible.length) return <EmptyShell><p className="text-sm text-slate-500">No tasks found.</p></EmptyShell>;

    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {groups.map((g) => (
          <div key={g.label}>
            <div className={`border-b border-slate-100 px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wider ${
              g.label === "Overdue" ? "bg-red-50 text-red-600" : "bg-slate-50/80 text-slate-400"
            }`}>
              {g.label} · {g.tasks.length}
            </div>
            {g.tasks.map((t, i) => renderRow(t, i, false))}
          </div>
        ))}
        {done.length > 0 && (
          <div>
            <div className="border-b border-slate-100 bg-emerald-50/60 px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-emerald-600">
              Done · {done.length}
            </div>
            {done.map((t, i) => renderRow(t, i, false))}
          </div>
        )}
        <div className="flex gap-3 border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-400">
          <span>{activeTasks.length} active</span><span>·</span>
          <span>{overdueTasks.length} overdue</span><span>·</span>
          <span>{doneTasks.length} done</span>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────── */
  /* KANBAN VIEW                                                      */
  /* ─────────────────────────────────────────────────────────────── */
  function KanbanView() {
    const cols: { key: TaskStatus; label: string; color: string; bg: string; count_bg: string }[] = [
      { key: "todo",        label: "To do",       color: "text-slate-600", bg: "",              count_bg: "bg-slate-100 text-slate-500" },
      { key: "in_progress", label: "In progress",  color: "text-blue-700",  bg: "bg-blue-50/40", count_bg: "bg-blue-100 text-blue-700"  },
      { key: "done",        label: "Done",         color: "text-emerald-700", bg: "bg-emerald-50/40", count_bg: "bg-emerald-100 text-emerald-700" },
    ];

    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {cols.map((col) => {
          const colTasks = visible.filter((t) => t.status === col.key || (col.key === "todo" && t.status !== "in_progress" && t.status !== "done" && t.status !== "cancelled"));
          return (
            <div key={col.key} className={`min-w-[220px] flex-1 rounded-xl border border-slate-200 p-3 ${col.bg}`}>
              <div className="mb-3 flex items-center justify-between">
                <span className={`text-xs font-semibold ${col.color}`}>{col.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${col.count_bg}`}>{colTasks.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {colTasks.map((task) => {
                  const isDone  = task.status === "done";
                  const overdue = isOverdue(task.due_date, isDone);
                  return (
                    <div key={task.id} onClick={() => toggleExpand(task)}
                      className={`cursor-pointer rounded-lg border border-slate-200 bg-white p-3 transition-shadow hover:shadow-sm ${isDone ? "opacity-60" : ""}`}>
                      <p className={`mb-2 text-[13px] font-medium leading-snug text-slate-900 ${isDone ? "line-through" : ""}`}>{task.title}</p>
                      <div className="flex flex-wrap gap-1">
                        <CategoryPill cat={task.task_category} />
                        <PriorityPill priority={task.priority} />
                      </div>
                      {task.due_date && (
                        <p className={`mt-1.5 text-[11px] ${overdue ? "text-red-500" : "text-slate-400"}`}>
                          {overdue ? "⚠ " : "📅 "}{fmt(task.due_date)}
                        </p>
                      )}
                      {task.google_calendar_event_id && (
                        <p className="mt-1 text-[11px] text-blue-600">In Calendar</p>
                      )}
                      {expandedId === task.id && editForm && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <DetailPanel task={task} />
                        </div>
                      )}
                    </div>
                  );
                })}
                {colTasks.length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-[11px] text-slate-400">
                    No tasks
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────── */
  /* TIMELINE VIEW                                                    */
  /* ─────────────────────────────────────────────────────────────── */
  function TimelineView() {
    const { days, today } = buildDateStrip();

    // dot colors per task due on that day
    function dotsForDay(d: Date): string[] {
      return visible
        .filter((t) => t.due_date && new Date(t.due_date).setHours(0,0,0,0) === d.getTime())
        .map((t) => t.task_category ? CATEGORY_META[t.task_category].dot : "bg-slate-400")
        .slice(0, 3);
    }

    const groups = groupByDate(visible.filter((t) => t.status !== "done"));
    const done   = visible.filter((t) => t.status === "done");

    const renderTimelineRow = (task: Task) => {
      const isDone   = task.status === "done";
      const overdue  = isOverdue(task.due_date, isDone);
      const isOpen   = expandedId === task.id;
      return (
        <div key={task.id}>
          <div onClick={() => toggleExpand(task)}
            className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50/60 ${isDone ? "opacity-55" : ""}`}>
            <button type="button" onClick={(e) => { e.stopPropagation(); void toggleDone(task); }}
              className="cursor-pointer border-none bg-transparent p-0" aria-label="Toggle done">
              <CheckCircle done={isDone} />
            </button>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium text-slate-900 ${isDone ? "line-through" : ""}`}>{task.title}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <CategoryPill cat={task.task_category} />
                <PriorityPill priority={task.priority} />
                {task.google_calendar_event_id && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">In Calendar</span>}
              </div>
            </div>
            {task.due_date && (
              <span className={`shrink-0 text-[11px] ${overdue ? "text-red-500" : "text-slate-400"}`}>{fmt(task.due_date)}</span>
            )}
          </div>
          {isOpen && editForm && <DetailPanel task={task} />}
        </div>
      );
    };

    return (
      <div>
        {/* date strip */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {days.map((d) => {
            const isToday = d.date.getTime() === today.getTime();
            const dots = dotsForDay(d.date);
            return (
              <div key={d.num} className={`flex min-w-[50px] flex-col items-center rounded-xl border px-2 py-2 ${
                isToday ? "border-[#0c2340] bg-[#0c2340] text-white" : "border-slate-200 bg-white"
              }`}>
                <span className={`text-[10px] font-medium ${isToday ? "text-white/70" : "text-slate-400"}`}>{d.label}</span>
                <span className={`text-sm font-semibold ${isToday ? "text-white" : "text-slate-700"}`}>{d.num}</span>
                <div className="mt-1 flex gap-0.5">
                  {dots.map((cls, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${cls}`} />)}
                </div>
              </div>
            );
          })}
        </div>

        {/* grouped tasks */}
        {loading ? <EmptyShell><p className="text-sm text-slate-500">Loading…</p></EmptyShell> : (
          <div className="flex flex-col gap-3">
            {groups.map((g) => (
              <div key={g.label} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className={`border-b border-slate-100 px-4 py-2.5 ${
                  g.label === "Overdue"
                    ? "bg-red-50 text-red-600"
                    : g.label === "Today"
                    ? "bg-[#0c2340]/5 text-[#0c2340]"
                    : "bg-slate-50 text-slate-500"
                } text-[11px] font-semibold uppercase tracking-wider`}>
                  {g.label} · {g.tasks.length}
                </div>
                <div className="divide-y divide-slate-100">
                  {g.tasks.map(renderTimelineRow)}
                </div>
              </div>
            ))}
            {done.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white opacity-60">
                <div className="border-b border-slate-100 bg-emerald-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
                  Done · {done.length}
                </div>
                <div className="divide-y divide-slate-100">{done.map(renderTimelineRow)}</div>
              </div>
            )}
            {!groups.length && !done.length && (
              <EmptyShell><p className="text-sm text-slate-500">No tasks found.</p></EmptyShell>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────── */
  /* GRID VIEW                                                        */
  /* ─────────────────────────────────────────────────────────────── */
  function GridView() {
    if (loading) return <EmptyShell><p className="text-sm text-slate-500">Loading…</p></EmptyShell>;
    if (!visible.length) return <EmptyShell><p className="text-sm text-slate-500">No tasks found.</p></EmptyShell>;

    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        {visible.map((task) => {
          const isDone   = task.status === "done";
          const overdue  = isOverdue(task.due_date, isDone);
          const isOpen   = expandedId === task.id;
          const isSynced = !!task.google_calendar_event_id;
          return (
            <div key={task.id}
              className={`overflow-hidden rounded-xl border bg-white transition-shadow hover:shadow-sm ${
                isOpen ? "border-[#534AB7]" : "border-slate-200"
              } ${isDone ? "opacity-55" : ""} ${overdue ? "border-red-200 bg-red-50/20" : ""}`}>
              <div className="cursor-pointer p-3" onClick={() => toggleExpand(task)}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <button type="button" onClick={(e) => { e.stopPropagation(); void toggleDone(task); }}
                    className="mt-0.5 cursor-pointer border-none bg-transparent p-0">
                    <CheckCircle done={isDone} />
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); void handleDelete(task.id); }}
                    className="rounded-md p-1 text-slate-300 hover:bg-red-50 hover:text-red-500" aria-label="Delete">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <p className={`mb-2 text-[13px] font-medium leading-snug text-slate-900 ${isDone ? "line-through" : ""}`}>
                  {task.title}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <CategoryPill cat={task.task_category} />
                  <PriorityPill priority={task.priority} />
                </div>
                {task.due_date && (
                  <p className={`mt-2 text-[11px] ${overdue ? "text-red-500" : "text-slate-400"}`}>
                    {overdue ? "⚠ " : "📅 "}{fmt(task.due_date)}
                  </p>
                )}
                {isSynced && <p className="mt-1 text-[11px] text-blue-600">In Calendar</p>}
                {task.description && !isOpen && (
                  <p className="mt-1.5 line-clamp-2 text-[11px] italic text-slate-400">{task.description}</p>
                )}
              </div>
              {isOpen && editForm && <DetailPanel task={task} />}
            </div>
          );
        })}
      </div>
    );
  }

  /* ── empty shell ── */
  function EmptyShell({ children }: { children: React.ReactNode }) {
    return <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">{children}</div>;
  }

  return (
    <div>
      {toolbar}
      {view === "list"     && <ListView />}
      {view === "kanban"   && <KanbanView />}
      {view === "timeline" && <TimelineView />}
      {view === "grid"     && <GridView />}
    </div>
  );
}
