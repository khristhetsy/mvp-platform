"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REMINDER_KINDS, REMINDER_KIND_LABEL, isReminderKind, type ReminderKind } from "@/lib/reminders/types";
import { formatReminderDue, ptToday, ptWallToIso, reminderGroup, type ReminderGroup } from "@/lib/reminders/pt";
import type { ContactTask } from "@/lib/founder-crm/contact-notes-types";

/**
 * Tasks tab on the founder contact page. A task is one of the founder's own clock reminders,
 * linked to this contact: it shows in the clock menu in the top bar, and a click there opens
 * this tab. A due task alerts in app and by email. Due times are Pacific Time, 9:00 AM on the day.
 */

const GROUP_LABEL: Record<ReminderGroup, string> = { late: "Late", today: "Today", future: "Future" };
const GROUP_BADGE: Record<ReminderGroup, string> = {
  late: "bg-red-100 text-red-800",
  today: "bg-amber-100 text-amber-800",
  future: "bg-blue-100 text-blue-800",
};
const DEFAULT_TIME = "09:00";

const inputCls = "rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-800";

function ordered(tasks: ContactTask[]): ContactTask[] {
  const open = tasks.filter((t) => !t.done_at).sort((a, b) => a.due_at.localeCompare(b.due_at));
  const done = tasks.filter((t) => t.done_at).sort((a, b) => b.due_at.localeCompare(a.due_at));
  return [...open, ...done];
}

export function ContactTasksTab({
  contactId,
  contactName,
  initialTasks,
}: Readonly<{ contactId: string; contactName: string; initialTasks: ContactTask[] }>) {
  const router = useRouter();
  const [tasks, setTasks] = useState<ContactTask[]>(initialTasks);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ReminderKind>("follow_up");
  const [date, setDate] = useState(() => ptToday());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const canAdd = title.trim().length > 0 && date.length > 0 && !busy;
  const open = tasks.filter((t) => !t.done_at).sort((a, b) => a.due_at.localeCompare(b.due_at));

  async function addTask() {
    if (!canAdd) return;
    const dueAt = ptWallToIso(date, DEFAULT_TIME);
    if (!dueAt) {
      setError("Pick a due date.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), kind, dueAt, contactId }),
      });
      const data = (await res.json().catch(() => null)) as { reminder?: ContactTask; error?: string } | null;
      if (!res.ok || !data?.reminder) {
        setError(data?.error ?? "Couldn't save the task. Try again.");
        return;
      }
      setTasks((prev) => [...prev, data.reminder as ContactTask]);
      setTitle("");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(task: ContactTask) {
    setError(null);
    const done = !task.done_at;
    const res = await fetch(`/api/reminders/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setError("Couldn't update the task.");
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done_at: done ? new Date().toISOString() : null } : t)));
    router.refresh();
  }

  async function remove(task: ContactTask) {
    setError(null);
    const res = await fetch(`/api/reminders/${task.id}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) {
      setError("Couldn't delete the task.");
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    router.refresh();
  }

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_280px]">
      <div>
        <p className="mb-2 text-[13px] font-semibold text-slate-900">Tasks for {contactName}</p>
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-3">
          <input
            type="text"
            aria-label="Task"
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void addTask(); }}
            placeholder="What needs to happen"
            className={`${inputCls} min-w-0 flex-1 basis-[220px]`}
          />
          <select
            aria-label="Type"
            value={kind}
            onChange={(e) => { if (isReminderKind(e.target.value)) setKind(e.target.value); }}
            className={inputCls}
          >
            {REMINDER_KINDS.map((k) => <option key={k} value={k}>{REMINDER_KIND_LABEL[k]}</option>)}
          </select>
          <input type="date" aria-label="Due date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          <button type="button" onClick={() => void addTask()} disabled={!canAdd} className="cap-btn-primary rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold disabled:opacity-50">
            {busy ? "Saving…" : "Add task"}
          </button>
        </div>
        {error ? <p className="mb-2 text-[12px] text-red-600" role="status">{error}</p> : null}

        {tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-3.5 py-3.5 text-[13px] text-slate-500">No tasks yet. Add a follow up for this investor.</p>
        ) : (
          <ul className="space-y-2">
            {ordered(tasks).map((t) => {
              const done = Boolean(t.done_at);
              const group = reminderGroup(t.due_at, now);
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-[13px]">
                  <input type="checkbox" aria-label={done ? "Mark not done" : "Mark done"} checked={done} onChange={() => void toggle(t)} className="h-4 w-4 cursor-pointer" />
                  <span className={done ? "text-slate-400 line-through" : "font-medium text-slate-900"}>{t.title}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">{REMINDER_KIND_LABEL[t.kind]}</span>
                  <span className="ml-auto" />
                  <span className={`text-[12px] ${done ? "text-slate-500" : group === "late" ? "font-semibold text-red-700" : "text-slate-700"}`}>
                    {done ? "Done" : formatReminderDue(t.due_at, now)}
                  </span>
                  <button type="button" onClick={() => void remove(t)} className="text-[12px] text-red-700 hover:underline">Delete</button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-[12.5px]">
        <p className="mb-1.5 text-[13px] font-semibold text-slate-900">Shows in your clock menu</p>
        <p className="mb-2.5 leading-relaxed text-slate-700">
          Open tasks appear in the clock icon menu in the top bar, grouped Late, Today and Future. Clicking one brings you back to this tab.
        </p>
        <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
          {open.length === 0 ? (
            <p className="py-1 text-[12px] text-slate-500">Nothing due for this contact.</p>
          ) : (
            open.map((t) => {
              const group = reminderGroup(t.due_at, now);
              return (
                <div key={t.id} className="flex items-center gap-2 border-b border-slate-100 py-1.5 last:border-b-0">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${GROUP_BADGE[group]}`}>{GROUP_LABEL[group]}</span>
                  <span className="min-w-0 flex-1 truncate">{t.title} ({contactName})</span>
                </div>
              );
            })
          )}
        </div>
        <p className="mt-2.5 text-[12px] leading-relaxed text-slate-500">
          A due task also sends an in app and email alert. Times are Pacific Time, 9:00 AM on the due date. Checking a task here marks it done in the menu too.
        </p>
      </div>
    </div>
  );
}
