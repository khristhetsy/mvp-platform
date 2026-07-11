"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Video, X, Trash2, MapPin, ExternalLink } from "lucide-react";
import type { CalendarEventRecord } from "@/lib/scheduling/types";
import type { GoogleEventLite } from "@/lib/integrations/google-calendar";

/** Unified item for rendering: local events are editable, Google overlay is read-only. */
type DisplayEvent = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  meet_url: string | null;
  editable: boolean;
  record: CalendarEventRecord | null;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

type FormState = {
  id: string | null;
  googleId: string | null; // set when editing a Google-Calendar event directly
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
    googleId: null,
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
    googleId: null,
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
/** Editable form for a Google-Calendar event (id prefixed "g:"). Google overlay
 *  carries only title/time/meet — other fields stay blank and are preserved on save. */
function formFromDisplay(e: DisplayEvent): FormState {
  const s = new Date(e.start_time);
  const en = new Date(e.end_time);
  return {
    id: null,
    googleId: e.id.startsWith("g:") ? e.id.slice(2) : e.id,
    title: e.title,
    date: ymd(s),
    startTime: hm(s),
    endTime: hm(en),
    location: "",
    description: "",
    attendees: "",
    addMeet: Boolean(e.meet_url),
  };
}

export function CalendarWorkspace({ googleConnected = false }: { googleConnected?: boolean }) {
  const t = useTranslations("sharedCmp");
  const pathname = usePathname();
  const [anchor, setAnchor] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [googleEvents, setGoogleEvents] = useState<GoogleEventLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [dayView, setDayView] = useState<{ date: Date; events: DisplayEvent[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"month" | "agenda">("month");
  const [selected, setSelected] = useState<DisplayEvent | null>(null);

  const grid = useMemo(() => monthGrid(anchor), [anchor]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = grid[0].toISOString();
      const to = new Date(grid[41].getTime() + 86400000).toISOString();
      const range = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const [res, gRes] = await Promise.all([
        fetch(`/api/calendar/events?${range}`),
        fetch(`/api/calendar/google-events?${range}`),
      ]);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load events.");
      setEvents(data.events ?? []);
      // Google overlay is best-effort — never block the local calendar on it.
      try {
        const gData = await gRes.json();
        setGoogleEvents(gRes.ok ? (gData.events ?? []) : []);
      } catch {
        setGoogleEvents([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [grid]);

  // Fetch on mount + when the visible month changes; load() owns its own state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  // Merge local (editable) events with the Google overlay (read-only), dropping
  // Google copies of events we already synced from iCapOS.
  const display = useMemo<DisplayEvent[]>(() => {
    const syncedIds = new Set(events.map((e) => e.external_event_id).filter((id): id is string => Boolean(id)));
    const local: DisplayEvent[] = events.map((e) => ({
      id: e.id, title: e.title, start_time: e.start_time, end_time: e.end_time, meet_url: e.meet_url, editable: true, record: e,
    }));
    const google: DisplayEvent[] = googleEvents
      .filter((g) => !syncedIds.has(g.id))
      .map((g) => ({
        id: `g:${g.id}`, title: g.title, start_time: g.start_time, end_time: g.end_time, meet_url: g.meet_url, editable: false, record: null,
      }));
    return [...local, ...google];
  }, [events, googleEvents]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, DisplayEvent[]>();
    for (const e of display) {
      const key = ymd(new Date(e.start_time));
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return map;
  }, [display]);

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
      // Editing a Google event → write straight back to Google Calendar.
      // Send only the fields we have so Google preserves description/attendees.
      const res = form.googleId
        ? await fetch(`/api/calendar/google-events/${form.googleId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: form.title.trim(), startTime, endTime, timezone: LOCAL_TZ, location: form.location || null, description: form.description || null, attendees: attendees.map((a) => a.email) }),
          })
        : form.id
        ? await fetch(`/api/calendar/events/${form.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: form.title.trim(), description: form.description || null, startTime, endTime, timezone: LOCAL_TZ, location: form.location || null, attendees, addMeet: form.addMeet }),
          })
        : await fetch("/api/calendar/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: form.title.trim(), description: form.description || null, startTime, endTime, timezone: LOCAL_TZ, location: form.location || null, attendees, addMeet: form.addMeet }),
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
    if (!form) return;
    const url = form.googleId ? `/api/calendar/google-events/${form.googleId}` : form.id ? `/api/calendar/events/${form.id}` : null;
    if (!url) return;
    setSaving(true);
    try {
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed.");
      setForm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setSaving(false);
    }
  }, [form, load]);

  const deleteEvent = useCallback(async (e: DisplayEvent) => {
    const url = e.editable ? `/api/calendar/events/${e.record?.id}` : `/api/calendar/google-events/${e.id.startsWith("g:") ? e.id.slice(2) : e.id}`;
    setSaving(true);
    try {
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed.");
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setSaving(false);
    }
  }, [load]);

  /** Open a Google event in the editor, enriching with full detail (location/description/attendees). */
  const openGoogleForEdit = useCallback(async (e: DisplayEvent) => {
    const gid = e.id.startsWith("g:") ? e.id.slice(2) : e.id;
    setSelected(null);
    setForm(formFromDisplay(e));
    try {
      const res = await fetch(`/api/calendar/google-events/${gid}`);
      const data = await res.json();
      if (res.ok && data.event) {
        setForm((prev) =>
          prev && prev.googleId === gid
            ? { ...prev, location: data.event.location || "", description: data.event.description || "", attendees: (data.event.attendees || []).join(", ") }
            : prev,
        );
      }
    } catch {
      // keep the basic title/time form
    }
  }, []);

  function googleDayUrl(iso: string): string {
    const d = new Date(iso);
    return `https://calendar.google.com/calendar/u/0/r/day/${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  }

  const monthLabel = anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const todayKey = ymd(new Date());
  const currentMonth = anchor.getMonth();

  const nowMs = new Date().getTime();
  const upcoming = display
    .filter((e) => new Date(e.end_time).getTime() >= nowMs)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  function renderPopover(sel: DisplayEvent) {
    const start = new Date(sel.start_time);
    const end = new Date(sel.end_time);
    const when = `${start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · ${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={() => setSelected(null)}>
        <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3 px-5 py-4">
            <div className="flex gap-2.5">
              <span className={`mt-1 h-3 w-3 shrink-0 rounded ${sel.editable ? "bg-[#1A6CE4]" : "bg-[#EA8420]"}`} />
              <div>
                <p className="text-sm font-semibold text-slate-950">{sel.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{when}</p>
              </div>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
            <button type="button" onClick={() => { if (sel.editable && sel.record) { setSelected(null); setForm(formFromEvent(sel.record)); } else { void openGoogleForEdit(sel); } }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">{t("edit")}</button>
            {sel.meet_url ? <a href={sel.meet_url} className="inline-flex items-center gap-1 rounded-lg border border-[#CECBF6] bg-[#EEEDFE] px-3 py-1.5 text-xs font-medium text-[#1A6CE4] hover:bg-[#CECBF6]"><Video className="h-3.5 w-3.5" /> Join Meet</a> : null}
            {!sel.editable ? <a href={googleDayUrl(sel.start_time)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[#B5D4F4] bg-[#E6F1FB] px-3 py-1.5 text-xs font-medium text-[#0C447C] hover:bg-[#B5D4F4]"><ExternalLink className="h-3.5 w-3.5" /> Open in Google</a> : null}
            <button type="button" disabled={saving} onClick={() => void deleteEvent(sel)} className="inline-flex items-center gap-1 rounded-lg border border-[#F7C1C1] bg-white px-3 py-1.5 text-xs font-medium text-[#A32D2D] hover:bg-[#FCEBEB] disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
          </div>
          <p className="px-5 pb-3 text-[11px] text-slate-400">{sel.editable ? "iCapOS event · synced to Google" : "Google Calendar event · edits sync to Google"}</p>
        </div>
      </div>
    );
  }

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
            <button type="button" onClick={() => setView("month")} className={`rounded-md px-2.5 py-1 text-xs font-medium ${view === "month" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>{t("month")}</button>
            <button type="button" onClick={() => setView("agenda")} className={`rounded-md px-2.5 py-1 text-xs font-medium ${view === "agenda" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>{t("agenda")}</button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 sm:flex">
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500"><span className="h-2 w-2 rounded-full bg-[#1A6CE4]" /> iCapOS</span>
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500"><span className="h-2 w-2 rounded-full bg-[#EA8420]" /> Google</span>
          </div>
          <button type="button" onClick={() => setForm(emptyForm(new Date()))} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            <Plus className="h-4 w-4" /> New event
          </button>
        </div>
      </div>

      {error && !form ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      {!googleConnected ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#B5D4F4] bg-[#E6F1FB] px-3 py-2 text-xs text-[#0C447C]">
          <span>{t("connect_your_google_account_to_sync_events_a")}</span>
          <a
            href={`/api/integrations/google/connect?returnTo=${encodeURIComponent(pathname ?? "/admin/calendar")}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#2f6cb0] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#234f86]"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Connect Google
          </a>
        </div>
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
                      onClick={(ev) => { ev.stopPropagation(); setSelected(e); }}
                      onKeyDown={(ev) => { if (ev.key === "Enter") { ev.stopPropagation(); setSelected(e); } }}
                      className={`flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] ${e.editable ? "bg-[#1A6CE4] font-medium text-white hover:bg-[#1557BD]" : "bg-[#FDEBD8] font-medium text-[#8A4B10] hover:bg-[#FBDCC0]"}`}
                    >
                      {e.editable ? null : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#EA8420]" />}
                      {e.meet_url ? <Video className="h-2.5 w-2.5 shrink-0" /> : null}
                      <span className="truncate">{new Date(e.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} {e.title}</span>
                    </span>
                  ))}
                  {dayEvents.length > 3 ? (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(ev) => { ev.stopPropagation(); setDayView({ date: day, events: dayEvents }); }}
                      onKeyDown={(ev) => { if (ev.key === "Enter") { ev.stopPropagation(); setDayView({ date: day, events: dayEvents }); } }}
                      className="block rounded px-1 text-[10px] font-medium text-[#2E78F5] hover:bg-slate-100"
                    >
                      +{dayEvents.length - 3} more
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      ) : (
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
        {upcoming.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">{t("no_upcoming_events_in_this_range_use_the_mon")}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {upcoming.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setSelected(e)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                >
                  <span className="w-28 shrink-0 text-xs text-slate-500">{new Date(e.start_time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                  <span className="w-20 shrink-0 text-xs font-medium text-slate-700">{new Date(e.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                  <span className="flex-1 truncate text-sm text-slate-900">{e.title}</span>
                  {!e.editable ? <span className="shrink-0 rounded bg-[#FDEBD8] px-1.5 py-0.5 text-[10px] font-medium text-[#8A4B10]">{t("google")}</span> : null}
                  {e.meet_url ? <Video className="h-3.5 w-3.5 shrink-0 text-[#2E78F5]" aria-label="Has Google Meet" /> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      )}
      {loading ? <p className="text-xs text-slate-400">{t("loading_2")}</p> : null}

      {/* Event modal */}
      {dayView ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setDayView(null)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[80vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">{dayView.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</h2>
              <button type="button" onClick={() => setDayView(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <ul className="mt-3 space-y-1">
              {dayView.events.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => { setDayView(null); setSelected(e); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${e.editable ? "bg-[#1A6CE4]" : "bg-[#EA8420]"}`} />
                    {e.meet_url ? <Video className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : null}
                    <span className="w-16 shrink-0 text-xs text-slate-500">{new Date(e.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                    <span className="truncate text-slate-800">{e.title}</span>
                    {e.editable ? null : <span className="ml-auto shrink-0 text-[10px] text-slate-400">{t("google")}</span>}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => { const d = dayView.date; setDayView(null); setForm(emptyForm(d)); }} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">+ New event this day</button>
          </div>
        </div>
      ) : null}

      {form ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setForm(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-950">{form.id || form.googleId ? "Edit event" : "New event"}</h2>
              <button type="button" onClick={() => setForm(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 px-5 py-4">
              {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p> : null}
              <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("add_title")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline-none" />
              <div className="flex gap-2">
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-sm" />
                <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-400" />
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder={t("location_optional")} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <input value={form.attendees} onChange={(e) => setForm({ ...form, attendees: e.target.value })} placeholder={t("attendee_emails_comma_separated")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("description_optional")} rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.addMeet} onChange={(e) => setForm({ ...form, addMeet: e.target.checked })} className="h-4 w-4 rounded" />
                <Video className="h-4 w-4 text-slate-500" /> Add Google Meet
                {!googleConnected ? <span className="text-xs text-slate-400">(connect Google first)</span> : null}
              </label>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3">
              <div>
                {form.id || form.googleId ? (
                  <button type="button" onClick={() => void remove()} disabled={saving} className="inline-flex items-center gap-1 rounded-lg border border-[#F7C1C1] bg-white px-2.5 py-2 text-xs font-medium text-[#A32D2D] hover:bg-[#FCEBEB] disabled:opacity-50">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">{t("cancel")}</button>
                <button type="button" onClick={() => void save()} disabled={saving} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Event detail popover */}
      {selected && !form ? renderPopover(selected) : null}
    </div>
  );
}
