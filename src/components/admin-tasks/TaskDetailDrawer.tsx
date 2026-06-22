"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, Loader2, Send } from "lucide-react";
import { Drawer } from "./Drawer";
import { AttachmentList } from "./AttachmentList";
import { AttachmentUploader } from "./AttachmentUploader";
import { ActivityFeed } from "./ActivityFeed";
import { StatusPill, PriorityDot, TagChip, dueLabel } from "./ui";
import { TASK_PRIORITIES, TASK_STATUSES, STATUS_LABELS, PRIORITY_LABELS } from "@/lib/admin-tasks/types";
import type { AdminTaskDetail, TaskPriority, TaskStatus } from "@/lib/admin-tasks/types";

export function TaskDetailDrawer({
  taskId,
  onClose,
  onChanged,
}: {
  taskId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<AdminTaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tasks/${id}`);
      const data = await res.json();
      if (res.ok) setDetail(data);
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!taskId) { setDetail(null); return; }
    void load(taskId);
  }, [taskId, load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const patch = async (body: Record<string, unknown>) => {
    if (!taskId) return;
    const res = await fetch(`/api/admin/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { await load(taskId); onChanged(); }
  };

  const archive = async () => {
    if (!taskId) return;
    const res = await fetch(`/api/admin/tasks/${taskId}`, { method: "DELETE" });
    if (res.ok) { onChanged(); onClose(); }
  };

  const addComment = async () => {
    if (!taskId || !comment.trim()) return;
    const res = await fetch(`/api/admin/tasks/${taskId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: comment.trim() }) });
    if (res.ok) { setComment(""); await load(taskId); }
  };

  const task = detail?.task;
  const due = task ? dueLabel(task.due_date) : null;
  const field = "rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-[#0D9488] focus:outline-none";

  return (
    <Drawer
      open={Boolean(taskId)}
      title={task?.title ?? "Task"}
      onClose={onClose}
      footer={
        task ? (
          <div className="flex items-center gap-2">
            <input value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void addComment(); }} placeholder="Add a comment…" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#0D9488] focus:outline-none" />
            <button type="button" onClick={() => void addComment()} disabled={!comment.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D9488] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50"><Send className="h-4 w-4" /></button>
          </div>
        ) : null
      }
    >
      {loading && !detail ? (
        <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : !task ? (
        <p className="text-sm text-slate-400">Task not found.</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <select value={task.status} onChange={(e) => void patch({ status: e.target.value as TaskStatus })} className={field} aria-label="Status">
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <select value={task.priority} onChange={(e) => void patch({ priority: e.target.value as TaskPriority })} className={field} aria-label="Priority">
              {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
            </select>
            {due ? <span className={`text-xs ${due.overdue ? "font-semibold text-red-600" : "text-slate-500"}`}>Due {due.text}</span> : null}
            {task.owner_label ? <span className="text-xs text-slate-500">· {task.owner_label}</span> : null}
          </div>

          {task.tags.length > 0 ? <div className="flex flex-wrap gap-1.5">{task.tags.map((t) => <TagChip key={t} tag={t} />)}</div> : null}

          {task.description ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{task.description}</p> : <p className="text-xs text-slate-400">No description.</p>}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Attachments</h3>
            <div className="space-y-2">
              <AttachmentUploader
                taskId={task.id}
                onUploaded={(att, n) => { setNotice(n ?? null); setDetail((d) => (d ? { ...d, attachments: [...d.attachments, att] } : d)); onChanged(); }}
              />
              {notice ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{notice}</p> : null}
              <AttachmentList
                taskId={task.id}
                attachments={detail.attachments}
                onRemoved={(attId) => { setDetail((d) => (d ? { ...d, attachments: d.attachments.filter((a) => a.id !== attId) } : d)); onChanged(); }}
              />
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Activity</h3>
            <ActivityFeed activity={detail.activity} />
          </section>

          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="inline-flex items-center gap-2"><StatusPill status={task.status} /><PriorityDot priority={task.priority} withLabel /></span>
            <button type="button" onClick={() => void archive()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"><Archive className="h-3.5 w-3.5" /> Archive</button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
