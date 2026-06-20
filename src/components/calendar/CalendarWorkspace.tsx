"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Video, X, Trash2, MapPin } from "lucide-react";
import type { CalendarEventRecord } from "@/lib/scheduling/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

type FormState = {
  id: string | null;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  attendees: string;
  addMeet: boolean;
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function hm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
/** 6-week grid starting on the Sunday on/before the 1st. */
function monthGrid(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}
function emptyForm(date: Date): FormState {
  const start = new Date(date);
  start.setHours(9, 0, 0, 0);
  const end = new Date(date);
  end.setHours(9, 30, 0, 0);
  return {
    id: null,
    title: "",
    date: ymd(date),
    startTime: hm(start),
    endTime: hm(end),
    location: "",
    description: "",
    attendees: "",
    addMeet: false,
  };
}
function formFromEvent(e: CalendarEventRecord): FormState {
  const s = new Date(e.start_time);
  const en = new Date(e.end_time);
  return {
    id: e.id,
    title: e.title,
    date: ymd(s),
    startTime: hm(s),
    endTime: hm(en),
    location: e.location ?? "",
    description: e.description ?? "",
    attendees: (e.attendees ?? []).map((a) => a.email).join(", "),
    addMeet: Boolean(e.meet_url),
  };
}

export function CalendarWorkspace({ googleConnected = false }: { googleConnected?: boolean }) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"month" | "agenda">("month");

  const grid = useMemo(() => monthGrid(anchor), [anchor]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = grid[0].toISOString();
      const to = new Date(grid[41].getTime() + 86400000).toISOString();
      const res = await fetch(`/api/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load events.");
      setEvents(data.events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [grid]);

  // Fetch on mount + when the visible month changes; load() owns its own state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventRecord[]>();
    for (const e of events) {
      const key = ymd(new Date(e.start_time));
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return map;
  }, [events]);

  const save = useCallback(async () => {
    if (!form) return;
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const startTime = new Date(`${form.date}T${form.startTime}`).toISOString();
      const endTime = new Date(`${form.date}T${form.endTime}`).toISOString();
      if (new Date(endTime) <= new Date(startTime)) throw new Error("End time must be after start time.");
      const attendees = form.attendees
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((email) => ({ email }));
      const body = {
        title: form.title.trim(),
        description: form.description || null,
        startTime,
        endTime,
        timezone: LOCAL_TZ,
        location: form.location || null,
        attendees,
        addMeet: form.addMeet,
      };
      const res = form.id
        ? await fetch(`/api/calendar/events/${form.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/calendar/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Save failed.");
      setForm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [form, load]);

  const remove = useCallback(async () => {
    if (!form?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/calendar/events/${form.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed.");
      setForm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setSaving(false);
    }
  }, [form, load]);

  const monthLabel = anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const todayKey = ymd(new Date());
  const currentMonth = anchor.getMonth();

  const nowMs = new Date().getTime();
  const upcoming = events
    .filter((e) => new Date(e.end_time).getTime() >= nowMs)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-slate-950">{monthLabel}</h1>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50" aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setAnchor(new Date())} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">
              Today
            </button>
            <button type="button" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50" aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="ml-1 flex items-center gap-0.5 rounded-lg border border-slate-200 p-0.5">
            <button type="button" onClick={() => setView("month")} className={`rounded-md px-2.5 py-1 text-xs font-medium ${view === "month" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>Month</button>
            <button type="button" onClick={() => setView("agenda")} className={`rounded-md px-2.5 py-1 text-xs font-medium ${view === "agenda" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>Agenda</button>
          </div>
        </div>
        <button type="button" onClick={() => setForm(emptyForm(new Date()))} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
          <Plus className="h-4 w-4" /> New event
        </button>
      </div>

      {error && !form ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      {!googleConnected ? (
        <p className="rounded-lg border border-[#B5D4F4] bg-[#E6F1FB] px-3 py-2 text-xs text-[#0C447C]">
          Connect your Google account in Integrations to sync events and auto-create Google Meet links.
        </p>
      ) : null}

      {view === "month" ? (
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
        <div className="grid grid-cols-7 border-b border-slate-100">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((day) => {
            const key = ymd(day);
            const dayEvents = eventsByDay.get(key) ?? [];
            const inMonth = day.getMonth() === currentMonth;
            const isToday = key === todayKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setForm(emptyForm(day))}
                className={`min-h-[92px] border-b border-r border-slate-100 p-1.5 text-left align-top hover:bg-slate-50/60 ${inMonth ? "" : "bg-slate-50/40"}`}
              >
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${isToday ? "bg-slate-900 font-semibold text-white" : inMonth ? "text-slate-700" : "text-slate-400"}`}>
                  {day.getDate()}
                </span>
                <div className="mt-1 space-y-1">
                  {dayEvents.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      role="button"
                      tabIndex={0}
                      onClick={(ev) => { ev.stopPropagation(); setForm(formFromEvent(e)); }}
                      onKeyDown={(ev) => { if (ev.key === "Enter") { ev.stopPropagation(); setForm(formFromEvent(e)); } }}
                      className="flex items-center gap-1 truncate rounded bg-[#EEEDFE] px-1.5 py-0.5 text-[11px] font-medium text-[#3C3489] hover:bg-[#CECBF6]"
                    >
                      {e.meet_url ? <Video className="h-2.5 w-2.5 shrink-0" /> : null}
                      <span className="truncate">{new Date(e.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} {e.title}</span>
                    </span>
                  ))}
                  {dayEvents.length > 3 ? <span className="px-1 text-[10px] text-slate-400">+{dayEvents.length - 3} more</span> : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      ) : (
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
        {upcoming.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">No upcoming events in this range. Use the month arrows to look further out.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {upcoming.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => setForm(formFromEvent(e))} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                  <span className="w-28 shrink-0 text-xs text-slate-500">{new Date(e.start_time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                  <span className="w-20 shrink-0 text-xs font-medium text-slate-700">{new Date(e.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                  <span className="flex-1 truncate text-sm text-slate-900">{e.title}</span>
                  {e.meet_url ? <Video className="h-3.5 w-3.5 shrink-0 text-[#534AB7]" aria-label="Has Google Meet" /> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      )}
      {loading ? <p className="text-xs text-slate-400">Loading…</p> : null}

      {/* Event modal */}
      {form ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setForm(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-950">{form.id ? "Edit event" : "New event"}</h2>
              <button type="button" onClick={() => setForm(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 px-5 py-4">
              {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p> : null}
              <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Add title" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline-none" />
              <div className="flex gap-2">
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-sm" />
                <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-400" />
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location (optional)" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <input value={form.attendees} onChange={(e) => setForm({ ...form, attendees: e.target.value })} placeholder="Attendee emails, comma-separated" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.addMeet} onChange={(e) => setForm({ ...form, addMeet: e.target.checked })} className="h-4 w-4 rounded" />
                <Video className="h-4 w-4 text-slate-500" /> Add Google Meet
                {!googleConnected ? <span className="text-xs text-slate-400">(connect Google first)</span> : null}
              </label>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3">
              <div>
                {form.id ? (
                  <button type="button" onClick={() => void remove()} disabled={saving} className="inline-flex items-center gap-1 rounded-lg border border-[#F7C1C1] bg-white px-2.5 py-2 text-xs font-medium text-[#A32D2D] hover:bg-[#FCEBEB] disabled:opacity-50">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="button" onClick={() => void save()} disabled={saving} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
