"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, LayoutList, Columns3, Paperclip } from "lucide-react";
import { TaskCreateDrawer } from "./TaskCreateDrawer";
import { TaskDetailDrawer } from "./TaskDetailDrawer";
import { StatusPill, PriorityDot, OwnerAvatar, TagChip, dueLabel } from "./ui";
import { TASK_STATUSES, STATUS_LABELS } from "@/lib/admin-tasks/types";
import type { AdminTaskListItem, TaskStatus } from "@/lib/admin-tasks/types";

type View = "list" | "board";
type StatusFilter = "all" | TaskStatus;

export function TasksView({ initialTasks }: { initialTasks: AdminTaskListItem[] }) {
  const [tasks, setTasks] = useState<AdminTaskListItem[]>(initialTasks);
  const [view, setView] = useState<View>("board");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/admin/tasks?${params.toString()}`);
    const data = await res.json();
    if (res.ok) setTasks(data.tasks ?? []);
  }, [statusFilter, q]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const openCount = useMemo(() => tasks.filter((t) => t.status !== "done").length, [tasks]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (query && !t.title.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [tasks, statusFilter, q]);

  const moveStatus = async (id: string, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    // Server assigns a new board position on status change (keeps render pure).
    await fetch(`/api/admin/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    void refresh();
  };

  const tabBtn = (id: StatusFilter, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setStatusFilter(id)}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === id ? "bg-[#0F2147] text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-100"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F2147]">Tasks</h1>
          <p className="text-sm text-slate-500">{openCount} open · internal operations tracker</p>
        </div>
        <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-[#0D9488] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e]"><Plus className="h-4 w-4" /> New task</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tabBtn("all", "All")}
        {TASK_STATUSES.map((s) => tabBtn(s, STATUS_LABELS[s]))}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
            <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title" className="w-40 bg-transparent text-sm focus:outline-none" />
          </div>
          <div className="flex rounded-lg border border-slate-200 p-0.5">
            <button type="button" onClick={() => setView("board")} aria-label="Board view" className={`rounded-md p-1.5 ${view === "board" ? "bg-[#0F2147] text-white" : "text-slate-500 hover:bg-slate-100"}`}><Columns3 className="h-4 w-4" /></button>
            <button type="button" onClick={() => setView("list")} aria-label="List view" className={`rounded-md p-1.5 ${view === "list" ? "bg-[#0F2147] text-white" : "text-slate-500 hover:bg-slate-100"}`}><LayoutList className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-6 py-16 text-center">
          <p className="text-sm font-medium text-slate-600">No tasks yet.</p>
          <p className="mt-1 text-sm text-slate-400">Create one to track internal work like the founder-campaign launch.</p>
        </div>
      ) : view === "board" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {TASK_STATUSES.map((col) => {
            const colTasks = filtered.filter((t) => t.status === col);
            return (
              <div key={col} className="rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-slate-600">{STATUS_LABELS[col]}</span>
                  <span className="text-[11px] text-slate-400">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.map((t) => {
                    const due = dueLabel(t.due_date);
                    return (
                      <div key={t.id} role="button" tabIndex={0} onClick={() => setDetailId(t.id)} onKeyDown={(e) => { if (e.key === "Enter") setDetailId(t.id); }}
                        className="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 hover:border-[#0D9488] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]">
                        <p className="text-sm font-medium text-slate-800">{t.title}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <PriorityDot priority={t.priority} />
                          {due ? <span className={`text-[11px] ${due.overdue ? "font-semibold text-red-600" : "text-slate-400"}`}>{due.text}</span> : null}
                          {t.attachment_count > 0 ? <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-400"><Paperclip className="h-3 w-3" />{t.attachment_count}</span> : null}
                          {t.owner_label ? <span className="ml-auto"><OwnerAvatar label={t.owner_label} /></span> : null}
                        </div>
                        {t.tags.length > 0 ? <div className="mt-2 flex flex-wrap gap-1">{t.tags.slice(0, 3).map((tag) => <TagChip key={tag} tag={tag} />)}</div> : null}
                        <div className="mt-2 border-t border-slate-100 pt-2" onClick={(e) => e.stopPropagation()}>
                          <select value={t.status} onChange={(e) => void moveStatus(t.id, e.target.value as TaskStatus)} className="w-full rounded border border-slate-200 px-1.5 py-1 text-[11px] text-slate-600 focus:outline-none" aria-label={`Move ${t.title}`}>
                            {TASK_STATUSES.map((s) => <option key={s} value={s}>Move to: {STATUS_LABELS[s]}</option>)}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                  {colTasks.length === 0 ? <p className="px-1 py-4 text-center text-[11px] text-slate-300">Empty</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <ul>
            {filtered.map((t) => {
              const due = dueLabel(t.due_date);
              return (
                <li key={t.id} role="button" tabIndex={0} onClick={() => setDetailId(t.id)} onKeyDown={(e) => { if (e.key === "Enter") setDetailId(t.id); }}
                  className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50">
                  <PriorityDot priority={t.priority} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{t.title}</span>
                  {t.attachment_count > 0 ? <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-400"><Paperclip className="h-3 w-3" />{t.attachment_count}</span> : null}
                  {t.owner_label ? <span className="hidden sm:inline"><OwnerAvatar label={t.owner_label} /></span> : null}
                  {due ? <span className={`hidden w-16 shrink-0 text-right text-xs sm:inline ${due.overdue ? "font-semibold text-red-600" : "text-slate-400"}`}>{due.text}</span> : null}
                  <StatusPill status={t.status} />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <TaskCreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(task) => { setCreateOpen(false); void refresh(); setDetailId(task.id); }} />
      <TaskDetailDrawer taskId={detailId} onClose={() => setDetailId(null)} onChanged={() => void refresh()} />
    </div>
  );
}
