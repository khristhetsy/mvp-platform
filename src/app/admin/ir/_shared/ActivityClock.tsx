"use client";

/**
 * Odoo-style activity clock for IR cards. The icon's colour is the most urgent open
 * activity (red overdue, amber due today, green planned, grey none) with a count badge.
 * Clicking opens a popover of the open activities grouped Overdue / Today / Planned, each
 * with "mark done", and a "Schedule an activity" form. Activities are ir_activities rows,
 * so they always hang off a week task (and optionally an investor record).
 *
 * Two modes:
 *   - task    — activities are passed in (the board already loaded them)
 *   - project — nothing is loaded until the popover opens; it then fetches the project
 *
 * The popover is position:fixed so kanban columns (overflow hidden) never clip it; it
 * closes on scroll rather than drifting away from its icon.
 */
import { useEffect, useRef, useState } from "react";
import { IR_ACTIVITY_ICON, IR_ACTIVITY_LABEL, IR_ACTIVITY_TYPES, type IrActivity, type IrActivityType } from "@/lib/ir/types";

type Staff = { id: string; name: string };
type TaskOpt = { id: string; title: string };
type Urgency = "overdue" | "today" | "planned";

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function urgencyOf(a: Pick<IrActivity, "due_at">, now = new Date()): Urgency {
  if (!a.due_at) return "planned";
  const due = dayKey(new Date(a.due_at)), today = dayKey(now);
  return due < today ? "overdue" : due === today ? "today" : "planned";
}
function dueLabel(a: IrActivity): string {
  if (!a.due_at) return "No due date";
  const days = Math.round((new Date(`${dayKey(new Date(a.due_at))}T12:00:00`).getTime() - new Date(`${dayKey(new Date())}T12:00:00`).getTime()) / 86_400_000);
  if (days < -1) return `${-days} days overdue`;
  if (days === -1) return "Yesterday";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `Due in ${days} days`;
}
const TONE: Record<Urgency | "none", string> = {
  overdue: "border-rose-500 bg-rose-50 text-rose-600",
  today: "border-amber-500 bg-amber-50 text-amber-600",
  planned: "border-emerald-500 bg-emerald-50 text-emerald-600",
  none: "border-slate-300 bg-white text-slate-400 hover:border-indigo-400 hover:text-indigo-600",
};
const HEAD: Record<Urgency, { label: string; cls: string }> = {
  overdue: { label: "Overdue", cls: "text-rose-600" }, today: { label: "Today", cls: "text-amber-600" }, planned: { label: "Planned", cls: "text-emerald-600" },
};

export function ActivityClock(props: {
  projectId: string;
  /** task mode: the open activities for this card, the task to schedule on, and staff. */
  activities?: IrActivity[]; taskId?: string; staff?: Staff[];
  /** project mode: badge counts before anything is loaded. */
  openCount?: number; lateCount?: number;
  meId: string; onChange?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<{ activities: IrActivity[]; tasks: TaskOpt[]; staff: Staff[] } | null>(null);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  function toggle() {
    const r = btn.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left + r.width / 2 - 160, window.innerWidth - 328)) });
    if (!open && projectMode && !loaded) void loadProject();
    setOpen((o) => !o);
  }
  const projectMode = !props.taskId;

  const list = (projectMode ? loaded?.activities : props.activities) ?? [];
  const staff = (projectMode ? loaded?.staff : props.staff) ?? [];
  const tasks: TaskOpt[] = projectMode ? loaded?.tasks ?? [] : [];

  async function loadProject() {
    const r = await fetch(`/api/admin/ir/projects/${props.projectId}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error ?? "Couldn't load activities."); return; }
    setLoaded({ activities: j.openActivities ?? [], tasks: (j.tasks ?? []).map((t: { id: string; title: string }) => ({ id: t.id, title: t.title })), staff: j.staff ?? [] });
  }
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setAdding(false); } };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setAdding(false); } };
    const scrolled = (e: Event) => { if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setAdding(false); } };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc); window.addEventListener("scroll", scrolled, true);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); window.removeEventListener("scroll", scrolled, true); };
  }, [open]);

  // Badge: from the list when we have it, else from the project counts.
  const count = projectMode && !loaded ? props.openCount ?? 0 : list.length;
  const worst: Urgency | "none" = projectMode && !loaded
    ? (props.lateCount ? "overdue" : props.openCount ? "planned" : "none")
    : list.some((a) => urgencyOf(a) === "overdue") ? "overdue" : list.some((a) => urgencyOf(a) === "today") ? "today" : list.length ? "planned" : "none";
  const staffName = (id: string | null) => (id ? staff.find((s) => s.id === id)?.name ?? null : null);

  async function refresh() { if (projectMode) await loadProject(); props.onChange?.(); }
  async function markDone(a: IrActivity) {
    setBusy(true);
    const r = await fetch(`/api/admin/ir/activities/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: true }) });
    setBusy(false);
    if (!r.ok) { setErr("Couldn't mark it done."); return; }
    await refresh();
  }

  const groups = (["overdue", "today", "planned"] as Urgency[]).map((u) => ({ u, items: list.filter((a) => urgencyOf(a) === u).sort((x, y) => (x.due_at ?? "9").localeCompare(y.due_at ?? "9")) })).filter((g) => g.items.length);

  return (
    <div className="relative inline-flex" ref={box} onClick={(e) => e.stopPropagation()}>
      <button ref={btn} type="button" onClick={toggle} aria-haspopup="dialog" aria-expanded={open} aria-label={`Activities (${count})`} title="Activities"
        className={`relative inline-flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] text-[13px] ${TONE[worst]}`}>
        <i className="ti ti-clock" aria-hidden="true" />
        {count ? <span className="absolute -right-2 -top-1.5 min-w-[16px] rounded-full bg-current px-1 text-center text-[9.5px] font-bold leading-4"><span className="text-white">{count}</span></span> : null}
      </button>
      {open ? (
        <div role="dialog" aria-label="Activities" style={{ position: "fixed", top: pos.top, left: pos.left }} className="z-50 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-slate-200 bg-white text-left shadow-xl">
          {projectMode && !loaded && !err ? <p className="px-4 py-4 text-[12.5px] text-slate-400">Loading…</p> : null}
          {err ? <p className="px-4 py-3 text-[12.5px] text-rose-600">{err}</p> : null}
          {(!projectMode || loaded) && !adding ? (
            <>
              {groups.length === 0 ? <p className="px-4 py-4 text-[12.5px] italic text-slate-500">Schedule activities to help you get things done.</p> : groups.map((g) => (
                <div key={g.u}>
                  <p className={`flex justify-between bg-slate-50 px-4 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide ${HEAD[g.u].cls}`}><span>{HEAD[g.u].label}</span><span>{g.items.length}</span></p>
                  {g.items.map((a) => (
                    <div key={a.id} className="flex gap-2.5 border-t border-slate-100 px-4 py-2.5">
                      <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-slate-100 text-slate-600"><i className={`ti ${IR_ACTIVITY_ICON[a.type]}`} aria-hidden="true" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-semibold text-slate-900">{a.subject}</p>
                        <p className={`text-[11.5px] ${HEAD[g.u].cls}`}>{dueLabel(a)}{staffName(a.assignee_id) ? ` · ${staffName(a.assignee_id)}` : ""}</p>
                        {a.description ? <p className="truncate text-[11.5px] text-slate-500">{a.description}</p> : null}
                      </div>
                      <button type="button" disabled={busy} onClick={() => void markDone(a)} title="Mark as done" aria-label={`Mark ${a.subject} as done`} className="h-6 w-6 flex-none rounded-md border border-slate-200 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-50"><i className="ti ti-check" aria-hidden="true" /></button>
                    </div>
                  ))}
                </div>
              ))}
              {projectMode && !tasks.length ? <p className="border-t border-slate-100 px-4 py-2.5 text-[11.5px] text-slate-500">Add a week task to this project to schedule activities on it.</p>
                : <button type="button" onClick={() => setAdding(true)} className="block w-full border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[12.5px] font-semibold text-slate-800 hover:bg-indigo-50 hover:text-indigo-800"><i className="ti ti-plus" aria-hidden="true" /> Schedule an activity</button>}
            </>
          ) : null}
          {adding ? <ScheduleForm projectId={props.projectId} taskId={props.taskId} tasks={tasks} staff={staff} meId={props.meId} onCancel={() => setAdding(false)} onSaved={async () => { setAdding(false); await refresh(); }} /> : null}
        </div>
      ) : null}
    </div>
  );
}

const inp = "w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] focus:border-indigo-400 focus:outline-none";
const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return dayKey(d); };

function ScheduleForm({ projectId, taskId, tasks, staff, meId, onCancel, onSaved }: { projectId: string; taskId?: string; tasks: TaskOpt[]; staff: Staff[]; meId: string; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [type, setType] = useState<IrActivityType>("call");
  const [subject, setSubject] = useState("");
  const [due, setDue] = useState(plusDays(2));
  const [assignee, setAssignee] = useState(meId);
  const [note, setNote] = useState("");
  const [task, setTask] = useState(taskId ?? tasks[tasks.length - 1]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(done: boolean) {
    if (!task) { setErr("Pick the week task this activity belongs to."); return; }
    setBusy(true); setErr(null);
    const r = await fetch("/api/admin/ir/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      projectId, taskId: task, type, subject: subject.trim() || IR_ACTIVITY_LABEL[type], description: note.trim() || null,
      dueAt: new Date(`${due}T12:00:00`).toISOString(), done, assigneeId: assignee || null,
    }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? "Couldn't save the activity."); return; }
    await onSaved();
  }

  return (
    <div className="space-y-2 p-3 text-[12px]">
      <p className="text-[13px] font-semibold text-slate-900">Schedule activity</p>
      <div className="flex flex-wrap gap-1">
        {IR_ACTIVITY_TYPES.map((t) => <button key={t} type="button" onClick={() => setType(t)} aria-pressed={type === t} className={`rounded-md border px-2 py-0.5 text-[11.5px] ${type === t ? "border-indigo-400 bg-indigo-50 font-semibold text-indigo-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}><i className={`ti ${IR_ACTIVITY_ICON[t]}`} aria-hidden="true" /> {IR_ACTIVITY_LABEL[t]}</button>)}
      </div>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={`Summary, e.g. ${IR_ACTIVITY_LABEL[type]} about next steps`} className={inp} aria-label="Summary" />
      {!taskId ? <select value={task} onChange={(e) => setTask(e.target.value)} className={inp} aria-label="Week task">{tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select> : null}
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inp} aria-label="Due date" />
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inp} aria-label="Assigned to">{staff.map((s) => <option key={s.id} value={s.id}>{s.id === meId ? `${s.name} (me)` : s.name}</option>)}</select>
      </div>
      <div className="flex gap-1 text-[11px]">{[["Today", 0], ["Tomorrow", 1], ["Next week", 7]].map(([l, n]) => <button key={l} type="button" onClick={() => setDue(plusDays(n as number))} className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 hover:text-indigo-700">{l}</button>)}</div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note (optional)" className={inp} aria-label="Note" />
      {err ? <p className="text-rose-600">{err}</p> : null}
      <div className="flex flex-wrap gap-1.5 pt-1">
        <button type="button" disabled={busy} onClick={() => void save(false)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">Schedule</button>
        <button type="button" disabled={busy} onClick={() => void save(true)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50 disabled:opacity-60">Mark as done</button>
        <button type="button" onClick={onCancel} className="ml-auto px-2 text-[12px] text-slate-500 hover:text-slate-800">Discard</button>
      </div>
    </div>
  );
}
