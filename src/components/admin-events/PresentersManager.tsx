"use client";

import { useMemo, useState } from "react";
import type { EventPresenter } from "@/lib/icfo-events/types";

type EventOpt = { id: string; title: string; timezone: string | null };

const ROLE_OPTIONS = ["Presenter", "Panelist", "Founder showcase"];
const TZ_OPTIONS = [
  "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "UTC", "Europe/London", "Europe/Berlin", "Asia/Singapore", "Asia/Kolkata", "Australia/Sydney",
];

// Wall-clock time in an IANA zone → UTC ISO (DST-aware single pass).
function wallTimeToUtcISO(dateStr: string, timeStr: string, tz: string): string | null {
  if (!dateStr || !timeStr) return null;
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  if (!y || !mo || !d || Number.isNaN(h) || Number.isNaN(mi)) return null;
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi);
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const p = Object.fromEntries(dtf.formatToParts(new Date(utcGuess)).filter((x) => x.type !== "literal").map((x) => [x.type, Number(x.value)]));
  const asSeen = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return new Date(utcGuess - (asSeen - utcGuess)).toISOString();
}

// ISO + tz → { date, time } for the inputs.
function splitZoned(iso: string | null, tz: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const dtf = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(dtf.formatToParts(new Date(iso)).filter((x) => x.type !== "literal").map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

function fmtWhen(iso: string | null, tz: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, { timeZone: tz || undefined, month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  } catch { return new Date(iso).toLocaleString(); }
}

type FormState = {
  eventId: string;
  displayName: string;
  email: string;
  roleLabel: string;
  headline: string;
  bio: string;
  companySummary: string;
  links: string;
  tz: string;
  date: string;
  time: string;
  meetingUrl: string;
};

function PresenterForm({ mode, events, presenter, onSaved, onCancel }: {
  mode: "add" | "edit";
  events?: EventOpt[];
  presenter?: EventPresenter;
  onSaved: (p: EventPresenter) => void;
  onCancel: () => void;
}) {
  const defaultTz = presenter?.timezone || events?.[0]?.timezone || TZ_OPTIONS[0];
  const split = splitZoned(presenter?.startsAt ?? null, defaultTz);
  const [f, setF] = useState<FormState>({
    eventId: presenter?.eventId ?? events?.[0]?.id ?? "",
    displayName: presenter?.displayName ?? "",
    email: presenter?.email ?? "",
    roleLabel: presenter?.roleLabel ?? "Presenter",
    headline: presenter?.headline ?? "",
    bio: presenter?.bio ?? "",
    companySummary: presenter?.companySummary ?? "",
    links: (presenter?.links ?? []).join(", "),
    tz: defaultTz,
    date: split.date,
    time: split.time,
    meetingUrl: presenter?.meetingUrl ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [creatingMeet, setCreatingMeet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) { setF((s) => ({ ...s, [k]: v })); }

  function body() {
    const startsAt = f.date && f.time ? wallTimeToUtcISO(f.date, f.time, f.tz) : "";
    const links = f.links.split(",").map((s) => s.trim()).filter(Boolean);
    return {
      displayName: f.displayName.trim(),
      email: f.email.trim() || "",
      roleLabel: f.roleLabel || null,
      headline: f.headline.trim() || null,
      bio: f.bio.trim() || null,
      companySummary: f.companySummary.trim() || null,
      links,
      timezone: f.date && f.time ? f.tz : null,
      startsAt,
      meetingUrl: f.meetingUrl.trim() || "",
    };
  }

  async function createMeet() {
    if (mode !== "edit" || !presenter) { setError("Save the presenter first, then create a Meet."); return; }
    setCreatingMeet(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${presenter.eventId}/presenters/${presenter.id}/meet`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not create meeting.");
      set("meetingUrl", (json.presenter as EventPresenter).meetingUrl ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create meeting.");
    } finally {
      setCreatingMeet(false);
    }
  }

  async function save() {
    if (!f.displayName.trim()) { setError("Name is required."); return; }
    if (mode === "add" && !f.eventId) { setError("Pick an event."); return; }
    setBusy(true);
    setError(null);
    try {
      const url = mode === "add"
        ? `/api/admin/events/${f.eventId}/presenters`
        : `/api/admin/events/${presenter!.eventId}/presenters/${presenter!.id}`;
      const res = await fetch(url, {
        method: mode === "add" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body()),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Save failed.");
      onSaved(json.presenter as EventPresenter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  const L = "mb-1 block text-[11px] text-[var(--text-secondary)]";
  const I = "w-full rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs";

  return (
    <div className="rounded-lg border border-[#bcd3fb] bg-[#f6faff] p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {mode === "add" && (
          <label className="block sm:col-span-2">
            <span className={L}>Event *</span>
            <select value={f.eventId} onChange={(e) => set("eventId", e.target.value)} className={I}>
              {(events ?? []).map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
            </select>
          </label>
        )}
        <label className="block"><span className={L}>Full name *</span><input value={f.displayName} onChange={(e) => set("displayName", e.target.value)} className={I} /></label>
        <label className="block"><span className={L}>Email</span><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} className={I} /></label>
        <label className="block">
          <span className={L}>Role</span>
          <select value={f.roleLabel} onChange={(e) => set("roleLabel", e.target.value)} className={I}>
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="block"><span className={L}>Talk topic / headline</span><input value={f.headline} onChange={(e) => set("headline", e.target.value)} className={I} /></label>
        <label className="block sm:col-span-2"><span className={L}>Short bio</span><textarea rows={2} value={f.bio} onChange={(e) => set("bio", e.target.value)} className={I} /></label>
        <label className="block sm:col-span-2"><span className={L}>Company summary</span><textarea rows={2} value={f.companySummary} onChange={(e) => set("companySummary", e.target.value)} placeholder="What the company does, stage, traction…" className={I} /></label>
        <label className="block sm:col-span-2"><span className={L}>Links (comma-separated)</span><input value={f.links} onChange={(e) => set("links", e.target.value)} placeholder="https://…, https://…" className={I} /></label>

        <div className="sm:col-span-2 mt-1 rounded-md border border-[var(--border-subtle)] bg-white p-2.5">
          <p className="mb-1.5 text-[11px] font-medium text-[var(--text-secondary)]"><i className="ti ti-calendar-clock" aria-hidden="true" /> Schedule</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block"><span className={L}>Date</span><input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} className={I} /></label>
            <label className="block"><span className={L}>Time</span><input type="time" value={f.time} onChange={(e) => set("time", e.target.value)} className={I} /></label>
            <label className="block"><span className={L}>Time zone</span>
              <select value={f.tz} onChange={(e) => set("tz", e.target.value)} className={I}>
                {TZ_OPTIONS.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-2">
            <span className={L}>Google Meet link</span>
            <div className="flex gap-2">
              <input value={f.meetingUrl} onChange={(e) => set("meetingUrl", e.target.value)} placeholder="https://meet.google.com/…" className={I} />
              <button type="button" onClick={createMeet} disabled={creatingMeet} className="whitespace-nowrap rounded-md border border-[var(--border-subtle)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--blue)] disabled:opacity-50">
                {creatingMeet ? "Creating…" : "Create Meet"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs disabled:opacity-50">Cancel</button>
        <button type="button" onClick={save} disabled={busy} className="rounded-md bg-[var(--blue)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{busy ? "Saving…" : mode === "add" ? "Add presenter" : "Save"}</button>
      </div>
    </div>
  );
}

export function PresentersManager({ initialPresenters, events }: { initialPresenters: EventPresenter[]; events: EventOpt[] }) {
  const [rows, setRows] = useState<EventPresenter[]>(initialPresenters);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<string>("all");

  const eventTitle = useMemo(() => Object.fromEntries(events.map((e) => [e.id, e.title])), [events]);
  const visible = eventFilter === "all" ? rows : rows.filter((r) => r.eventId === eventFilter);

  function upsert(p: EventPresenter) {
    setRows((rs) => (rs.some((r) => r.id === p.id) ? rs.map((r) => (r.id === p.id ? p : r)) : [p, ...rs]));
    setAdding(false);
    setEditId(null);
  }
  async function remove(p: EventPresenter) {
    if (!confirm(`Remove ${p.displayName} from the roster? This can't be undone.`)) return;
    setBusy(p.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${p.eventId}/presenters/${p.id}`, { method: "DELETE" });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(typeof j.error === "string" ? j.error : "Delete failed."); }
      setRows((rs) => rs.filter((r) => r.id !== p.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-panel)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[var(--navy)]">Presenters</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Add speakers directly to the roster, schedule their slot, and manage the details attendees see.</p>
        </div>
        <button type="button" onClick={() => { setAdding((v) => !v); setEditId(null); }} className="shrink-0 rounded-md bg-[var(--blue)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
          <i className="ti ti-user-plus" aria-hidden="true" /> Add presenter
        </button>
      </div>

      {events.length > 1 && (
        <div className="mt-3">
          <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} className="rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs">
            <option value="all">All events</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </div>
      )}

      {adding && (
        <div className="mt-4">
          <PresenterForm mode="add" events={events} onSaved={upsert} onCancel={() => setAdding(false)} />
        </div>
      )}

      {error && <p className="mt-3 text-xs text-rose-700">{error}</p>}

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--text-muted)]">No presenters yet. Use “Add presenter” to build the roster.</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-[var(--border-subtle)]">
          <div className="grid grid-cols-[1.3fr_1.4fr_0.9fr_1fr_1.1fr] gap-2 border-b border-[var(--border-subtle)] bg-slate-50 px-3 py-2 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
            <span>Name</span><span>Topic</span><span>When</span><span>Meet</span><span className="text-right">Actions</span>
          </div>
          {visible.map((p) => (
            <div key={p.id}>
              <div className="grid grid-cols-[1.3fr_1.4fr_0.9fr_1fr_1.1fr] items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2.5 text-xs">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-[var(--navy)]">{p.displayName}</span>
                  <span className="block truncate text-[10px] text-[var(--text-muted)]">{p.roleLabel} · {eventTitle[p.eventId] ?? p.eventTitle ?? ""}</span>
                </span>
                <span className="truncate text-[var(--text-secondary)]">{p.headline || "—"}</span>
                <span className="text-[var(--text-muted)]">{p.startsAt ? fmtWhen(p.startsAt, p.timezone) : "—"}</span>
                <span>{p.meetingUrl ? <span className="text-emerald-700"><i className="ti ti-brand-google" aria-hidden="true" /> Meet</span> : <span className="text-[var(--text-muted)]">—</span>}</span>
                <span className="flex items-center justify-end gap-2">
                  <button type="button" onClick={() => { setEditId(editId === p.id ? null : p.id); setAdding(false); }} className="text-[var(--blue)]">{editId === p.id ? "Close" : "Edit"}</button>
                  <button type="button" onClick={() => remove(p)} disabled={busy === p.id} className="text-rose-600 disabled:opacity-50">Delete</button>
                </span>
              </div>
              {editId === p.id && (
                <div className="border-b border-[var(--border-subtle)] p-3">
                  <PresenterForm mode="edit" presenter={p} onSaved={upsert} onCancel={() => setEditId(null)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
