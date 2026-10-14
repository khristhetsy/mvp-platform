"use client";

/**
 * Clock icon in the top bar's right side. Opens a reminders menu (Task, To-do, Follow up, Call)
 * with Late / Today / Future groups, a New reminder form and a done checkbox. The badge counts
 * open reminders. Times are entered and shown in PT. Due reminders alert in app and by email
 * (reminder-alerts cron).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ClipboardList, Clock, Forward, ListChecks, PhoneCall, Plus, Trash2, type LucideIcon } from "lucide-react";
import { REMINDER_KINDS, REMINDER_KIND_LABEL, type Reminder, type ReminderKind } from "@/lib/reminders/types";
import { formatReminderDue, ptToday, ptWallToIso, reminderGroup, type ReminderGroup } from "@/lib/reminders/pt";

const KIND_STYLE: Record<ReminderKind, { icon: LucideIcon; tile: string }> = {
  task: { icon: ClipboardList, tile: "bg-blue-50 text-blue-700" },
  todo: { icon: ListChecks, tile: "bg-emerald-50 text-emerald-700" },
  follow_up: { icon: Forward, tile: "bg-violet-50 text-violet-700" },
  call: { icon: PhoneCall, tile: "bg-amber-50 text-amber-800" },
};

const GROUPS: Array<{ id: ReminderGroup; label: string }> = [
  { id: "late", label: "Late" },
  { id: "today", label: "Today" },
  { id: "future", label: "Future" },
];

/** "Oct 16, 9:00 AM PT" becomes "Oct 16". Sales tasks only have a due date. */
function dayOnly(label: string): string {
  const at = label.lastIndexOf(", ");
  return at === -1 ? label : label.slice(0, at);
}

export function ReminderClockButton() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Reminder[]>([]);
  const [filter, setFilter] = useState<ReminderKind | "all">("all");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ReminderKind>("task");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/reminders", { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { reminders?: Reminder[] };
      setItems(d.reminders ?? []);
    } catch { /* the badge just won't update */ }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  // Click outside or Esc closes the menu.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const openCount = items.filter((i) => !i.done_at).length;
  const visible = useMemo(() => items.filter((i) => filter === "all" || i.kind === filter), [items, filter]);

  const toggleDone = async (item: Reminder) => {
    const done = !item.done_at;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done_at: done ? new Date().toISOString() : null } : i)));
    const r = await fetch(`/api/reminders/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ done }) }).catch(() => null);
    if (!r || !r.ok) void load();
  };

  const remove = async (item: Reminder) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const r = await fetch(`/api/reminders/${item.id}`, { method: "DELETE" }).catch(() => null);
    if (!r || !r.ok) void load();
  };

  const save = async () => {
    const t = title.trim();
    if (!t) { setError("Enter a title first"); return; }
    const dueAt = ptWallToIso(date || ptToday(), time || "09:00");
    if (!dueAt) { setError("Pick a date and time"); return; }
    setSaving(true);
    setError(null);
    const r = await fetch("/api/reminders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: t, kind, dueAt }) }).catch(() => null);
    setSaving(false);
    if (!r || !r.ok) {
      const d = r ? ((await r.json().catch(() => null)) as { error?: string } | null) : null;
      setError(d?.error ?? "Couldn't save the reminder. Try again.");
      return;
    }
    setTitle("");
    setAdding(false);
    setFilter("all");
    void load();
  };

  const now = new Date();
  const chip = (on: boolean) =>
    `rounded-full border px-2.5 py-1 text-[12px] transition-colors ${on ? "border-[var(--blue)] bg-[var(--blue-muted)] text-[var(--blue-hover)]" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`;

  return (
    <div ref={boxRef} className="relative hidden md:block">
      <button type="button" aria-label={openCount ? `Reminders, ${openCount} open` : "Reminders"} aria-expanded={open} title="Reminders"
        onClick={() => setOpen((v) => !v)}
        className={`relative flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100 hover:text-slate-950 ${open ? "bg-slate-100 text-slate-950" : "text-slate-500"}`}>
        <Clock className="h-[17px] w-[17px]" strokeWidth={1.75} aria-hidden />
        {openCount > 0 ? (
          <span className="absolute -right-0.5 top-0 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
            {openCount > 99 ? "99+" : openCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div role="dialog" aria-label="Reminders" className="absolute right-0 top-full z-50 mt-1 w-[372px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-200 px-3.5 py-3">
            <span className="text-[15px] font-semibold text-slate-950">Reminders</span>
            <button type="button" onClick={() => { setAdding((v) => !v); setError(null); if (!date) setDate(ptToday()); }}
              className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[13px] text-slate-700 hover:bg-slate-50">
              <Plus className="h-3.5 w-3.5" aria-hidden /> New reminder
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 border-b border-slate-200 px-3.5 py-2.5">
            <button type="button" className={chip(filter === "all")} onClick={() => setFilter("all")}>All</button>
            {REMINDER_KINDS.map((k) => (
              <button key={k} type="button" className={chip(filter === k)} onClick={() => setFilter(k)}>{REMINDER_KIND_LABEL[k]}s</button>
            ))}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {visible.length === 0 ? (
              <p className="px-3.5 py-6 text-center text-[13px] text-slate-500">No reminders here. Add your first one.</p>
            ) : GROUPS.map((g) => {
              const rows = visible.filter((i) => reminderGroup(i.due_at, now) === g.id);
              if (rows.length === 0) return null;
              return (
                <div key={g.id}>
                  <p className="px-3.5 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">{g.label} ({rows.length})</p>
                  {rows.map((i) => {
                    const s = KIND_STYLE[i.kind];
                    const Icon = s.icon;
                    const late = g.id === "late" && !i.done_at;
                    return (
                      <div key={i.id} className="group flex items-center gap-2.5 border-b border-slate-100 px-3.5 py-2 text-[13px] hover:bg-slate-50">
                        <button type="button" role="checkbox" aria-checked={Boolean(i.done_at)} aria-label={i.done_at ? "Mark not done" : "Mark done"} onClick={() => void toggleDone(i)}
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${i.done_at ? "border-[var(--blue)] bg-[var(--blue)] text-white" : "border-slate-300"}`}>
                          {i.done_at ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : null}
                        </button>
                        <span className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg ${s.tile}`}><Icon className="h-[17px] w-[17px]" aria-hidden /></span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate ${i.done_at ? "text-slate-400 line-through" : "text-slate-900"}`}>{i.title}</span>
                          <span className={`block truncate text-[12px] ${late ? "text-red-600" : "text-slate-500"}`}>
                            {REMINDER_KIND_LABEL[i.kind]}{i.source === "sales" ? " · Sales" : ""}{i.context ? ` · ${i.context}` : ""} · {i.date_only ? dayOnly(formatReminderDue(i.due_at, now)) : formatReminderDue(i.due_at, now)}
                          </span>
                        </span>
                        {i.source === "sales" ? null : <button type="button" aria-label="Delete reminder" title="Delete" onClick={() => void remove(i)}
                          className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-red-600 group-hover:flex focus:flex">
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {adding ? (
            <div className="border-t border-slate-200 bg-slate-50 px-3.5 py-3">
              <input value={title} onChange={(e) => { setTitle(e.target.value); setError(null); }} maxLength={200} placeholder="Send term sheet to Michael" aria-label="Reminder title"
                className="mb-2 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[13px] outline-none focus:border-[var(--blue)]" />
              <div className="mb-2 flex flex-wrap gap-1.5">
                {REMINDER_KINDS.map((k) => {
                  const Icon = KIND_STYLE[k].icon;
                  return (
                    <button key={k} type="button" className={`${chip(kind === k)} flex items-center gap-1`} onClick={() => setKind(k)}>
                      <Icon className="h-3.5 w-3.5" aria-hidden /> {REMINDER_KIND_LABEL[k]}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Due date" className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 text-[13px]" />
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Due time" className="h-9 w-[110px] rounded-md border border-slate-300 bg-white px-2 text-[13px]" />
                <span className="text-[12px] text-slate-500">PT</span>
              </div>
              {error ? <p className="mt-1.5 text-[12px] text-red-600">{error}</p> : null}
              <div className="mt-2.5 flex justify-end gap-2">
                <button type="button" onClick={() => { setAdding(false); setError(null); }} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="button" onClick={() => void save()} disabled={saving} className="rounded-md bg-slate-900 px-3 py-1.5 text-[13px] text-white hover:bg-slate-800 disabled:opacity-60">{saving ? "Saving…" : "Save reminder"}</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
