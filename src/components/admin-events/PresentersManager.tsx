"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EventPresenter } from "@/lib/icfo-events/types";
import { ReusePresentersDrawer } from "@/components/admin-events/ReusePresentersDrawer";

type EventOpt = { id: string; title: string; timezone: string | null };
type SessionOpt = { id: string; eventId: string; title: string };

// Guest CEO and Investor bill a person under a session rather than in the flat
// roster list — the talk-show line-up. `role_label` is free text, so these are
// options rather than an enum; the email groups them case-insensitively.
const ROLE_OPTIONS = ["Presenter", "Panelist", "Founder showcase", "Guest CEO", "Investor", "Exhibitor"];
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
  sessionId: string;
};

// Headshot or company logo for the booklet. The booklet avatar shows the
// headshot, then the company logo, then initials.
function PresenterImageField({ presenter, kind, url, onChange }: {
  presenter: EventPresenter;
  kind: "headshot" | "logo";
  url: string | null;
  onChange: (url: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endpoint = `/api/admin/events/${presenter.eventId}/presenters/${presenter.id}/image?kind=${kind}`;
  const label = kind === "headshot" ? "Headshot" : "Company logo";
  const hint = kind === "headshot" ? "Square photo, PNG or JPG, up to 5 MB." : "Used when there is no headshot. PNG or JPG, up to 5 MB.";

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(endpoint, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Upload failed.");
      onChange((json.url as string | null) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(typeof j.error === "string" ? j.error : "Remove failed."); }
      onChange(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-3">
      <div className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-subtle)] ${url ? "bg-white" : "bg-slate-50"}`}>
        {url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={url} alt={label} className={kind === "headshot" ? "h-full w-full object-cover" : "h-[70%] w-[70%] object-contain"} />
          : <i className={`ti ${kind === "headshot" ? "ti-user" : "ti-building"} text-xl text-[var(--text-muted)]`} aria-hidden="true" />}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[var(--text-secondary)]">{label}</p>
        <p className="text-[10.5px] text-[var(--text-muted)]">{hint}</p>
        <div className="mt-1 flex gap-2">
          <input ref={input} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="rounded-md border border-[var(--border-subtle)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--blue)] disabled:opacity-50">
            {busy ? "Working…" : url ? "Replace" : "Upload"}
          </button>
          {url && <button type="button" onClick={remove} disabled={busy} className="text-[11px] text-rose-600 disabled:opacity-50">Remove</button>}
        </div>
        {error && <p className="mt-1 text-[10.5px] text-rose-700">{error}</p>}
      </div>
    </div>
  );
}

function PresenterForm({ mode, events, sessions, presenter, onSaved, onCancel }: {
  mode: "add" | "edit";
  events?: EventOpt[];
  sessions?: SessionOpt[];
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
    sessionId: presenter?.sessionId ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [creatingMeet, setCreatingMeet] = useState(false);
  const [images, setImages] = useState<{ headshotUrl: string | null; logoUrl: string | null }>({ headshotUrl: null, logoUrl: null });

  // Signed preview URLs for the stored headshot and logo (edit mode only).
  useEffect(() => {
    if (mode !== "edit" || !presenter) return;
    let live = true;
    fetch(`/api/admin/events/${presenter.eventId}/presenters/${presenter.id}/image`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live && j) setImages({ headshotUrl: j.headshotUrl ?? null, logoUrl: j.logoUrl ?? null }); })
      .catch(() => {});
    return () => { live = false; };
  }, [mode, presenter]);
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
      sessionId: f.sessionId || null,
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
        <label className="block">
          <span className={L}>Session</span>
          <select value={f.sessionId} onChange={(e) => set("sessionId", e.target.value)} className={I}>
            <option value="">— not tied to a session —</option>
            {(sessions ?? []).filter((s) => s.eventId === f.eventId).map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
          <span className="mt-1 block text-[10.5px] text-[var(--text-muted)]">
            Billed under that session in the email and the booklet. Left blank, they appear in the roster list instead.
          </span>
        </label>
        <label className="block"><span className={L}>Talk topic / headline</span><input value={f.headline} onChange={(e) => set("headline", e.target.value)} className={I} /></label>
        <label className="block sm:col-span-2"><span className={L}>Short bio</span><textarea rows={2} value={f.bio} onChange={(e) => set("bio", e.target.value)} className={I} /></label>
        <label className="block sm:col-span-2"><span className={L}>Company summary</span><textarea rows={2} value={f.companySummary} onChange={(e) => set("companySummary", e.target.value)} placeholder="What the company does, stage, traction…" className={I} /></label>
        <div className="sm:col-span-2 mt-1 rounded-md border border-[var(--border-subtle)] bg-white p-2.5">
          <p className="mb-1.5 text-[11px] font-medium text-[var(--text-secondary)]"><i className="ti ti-photo" aria-hidden="true" /> Booklet images</p>
          {mode === "edit" && presenter ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <PresenterImageField presenter={presenter} kind="headshot" url={images.headshotUrl} onChange={(u) => setImages((s) => ({ ...s, headshotUrl: u }))} />
              <PresenterImageField presenter={presenter} kind="logo" url={images.logoUrl} onChange={(u) => setImages((s) => ({ ...s, logoUrl: u }))} />
            </div>
          ) : (
            <p className="text-[10.5px] text-[var(--text-muted)]">Save the presenter first, then add a headshot and company logo.</p>
          )}
        </div>
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

export function PresentersManager({ initialPresenters, events, sessions = [] }: { initialPresenters: EventPresenter[]; events: EventOpt[]; sessions?: SessionOpt[] }) {
  const [rows, setRows] = useState<EventPresenter[]>(initialPresenters);
  const [adding, setAdding] = useState(false);
  const [reusing, setReusing] = useState(false);
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
        <div className="flex shrink-0 items-center gap-2">
          {events.length > 0 && (
            <button type="button" onClick={() => { setReusing((v) => !v); setAdding(false); setEditId(null); }} className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-slate-50">
              <i className="ti ti-history" aria-hidden="true" /> Reuse previous
            </button>
          )}
          <button type="button" onClick={() => { setAdding((v) => !v); setReusing(false); setEditId(null); }} className="rounded-md bg-[var(--blue)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
            <i className="ti ti-user-plus" aria-hidden="true" /> Add presenter
          </button>
        </div>
      </div>

      {events.length > 1 && (
        <div className="mt-3">
          <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} className="rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs">
            <option value="all">All events</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </div>
      )}

      {reusing && (
        <div className="mt-4">
          <ReusePresentersDrawer
            all={rows}
            events={events}
            onAdded={(added) => setRows((rs) => [...added, ...rs])}
            onClose={() => setReusing(false)}
          />
        </div>
      )}

      {adding && (
        <div className="mt-4">
          <PresenterForm mode="add" events={events} sessions={sessions} onSaved={upsert} onCancel={() => setAdding(false)} />
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
                  <PresenterForm mode="edit" presenter={p} events={events} sessions={sessions} onSaved={upsert} onCancel={() => setEditId(null)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
