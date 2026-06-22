"use client";

import { useState } from "react";
import { Drawer } from "./Drawer";
import { TASK_PRIORITIES, TASK_STATUSES, STATUS_LABELS, PRIORITY_LABELS } from "@/lib/admin-tasks/types";
import type { AdminTask, TaskPriority, TaskStatus, TaskVisibility } from "@/lib/admin-tasks/types";

export function TaskCreateDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (task: AdminTask) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [ownerLabel, setOwnerLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<TaskVisibility>("admin_only");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle(""); setDescription(""); setStatus("todo"); setPriority("medium");
    setOwnerLabel(""); setDueDate(""); setTags(""); setVisibility("admin_only"); setError(null);
  };

  const submit = async () => {
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority,
          ownerLabel: ownerLabel.trim() || null,
          dueDate: dueDate || null,
          visibility,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not create task.");
      reset();
      onCreated(data.task);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create task.");
    } finally {
      setSaving(false);
    }
  };

  const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]";

  return (
    <Drawer
      open={open}
      title="New task"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={saving} className="rounded-lg bg-[#0F2147] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16315f] disabled:opacity-50">{saving ? "Creating…" : "Create task"}</button>
        </div>
      }
    >
      <div className="space-y-3">
        {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p> : null}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Details, context, links…" className={field} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className={field}>
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Priority</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className={field}>
              {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Owner</span>
            <input value={ownerLabel} onChange={(e) => setOwnerLabel(e.target.value)} placeholder="e.g. Growth" className={field} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Due date</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Tags (comma-separated)</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="launch, q3, ops" className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Visibility</span>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as TaskVisibility)} className={field}>
            <option value="admin_only">Admin only</option>
            <option value="admin_assigned">Admin + assigned</option>
          </select>
        </label>
        <p className="text-[11px] text-slate-400">Attach files after creating, from the task detail.</p>
      </div>
    </Drawer>
  );
}
