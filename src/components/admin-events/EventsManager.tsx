"use client";

import { useState } from "react";
import { EVENT_SECTORS } from "@/lib/icfo-events/sectors";
import type { EventFormat, EventRecord, EventStatus, EventVisibility } from "@/lib/icfo-events/types";

const STATUS_STYLES: Record<EventStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  published: "bg-emerald-50 text-emerald-700",
  live: "bg-rose-50 text-rose-700",
  ended: "bg-slate-100 text-slate-500",
  archived: "bg-slate-50 text-slate-400",
};

const FORMATS: { value: EventFormat; label: string }[] = [
  { value: "showcase", label: "Showcase" },
  { value: "demo_day", label: "Demo Day" },
  { value: "webinar", label: "Webinar" },
  { value: "hybrid", label: "Hybrid" },
];

function fmtDate(v: string | null): string {
  if (!v) return "—";
  return new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function EventsManager({ initialEvents }: { initialEvents: EventRecord[] }) {
  const [events, setEvents] = useState<EventRecord[]>(initialEvents);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // create form state
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [format, setFormat] = useState<EventFormat>("showcase");
  const [visibility, setVisibility] = useState<EventVisibility>("public");
  const [sectorSlugs, setSectorSlugs] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  function toggleSector(slug: string) {
    setSectorSlugs((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          summary: summary || null,
          format,
          visibility,
          sectors: sectorSlugs.map((slug) => ({
            sectorSlug: slug,
            label: EVENT_SECTORS.find((s) => s.slug === slug)?.label ?? slug,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not create event.");
      setEvents((prev) => [json.event as EventRecord, ...prev]);
      setTitle("");
      setSummary("");
      setSectorSlugs([]);
      setFormat("showcase");
      setVisibility("public");
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create event.");
    } finally {
      setCreating(false);
    }
  }

  async function changeStatus(id: string, action: "publish" | "unpublish" | "archive") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not update status.");
      setEvents((prev) => prev.map((ev) => (ev.id === id ? (json.event as EventRecord) : ev)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Events</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Create and publish iCFO Events. Education &amp; community only — no securities offerings here.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="cap-btn-primary rounded-md px-3 py-2 text-sm font-medium"
        >
          {showForm ? "Cancel" : "New event"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={createEvent} className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-panel)]">
          <div className="grid gap-4">
            <label className="block">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Title</span>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                placeholder="e.g. FinTech Founder Showcase — Summer 2026"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Summary</span>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                maxLength={2000}
                rows={3}
                className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                placeholder="A short description shown on the public event page."
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-medium text-[var(--text-secondary)]">Format</span>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as EventFormat)}
                  className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                >
                  {FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-[var(--text-secondary)]">Visibility</span>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as EventVisibility)}
                  className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                >
                  <option value="public">Public</option>
                  <option value="members">Members only</option>
                </select>
              </label>
            </div>

            <div>
              <span className="text-sm font-medium text-[var(--text-secondary)]">Sector tracks</span>
              <p className="text-xs text-[var(--text-muted)]">An event must have at least one track before it can be published.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {EVENT_SECTORS.map((s) => {
                  const on = sectorSlugs.includes(s.slug);
                  return (
                    <button
                      type="button"
                      key={s.slug}
                      onClick={() => toggleSector(s.slug)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        on
                          ? "border-[var(--indigo)] bg-[var(--indigo-soft)] text-[var(--indigo)]"
                          : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-slate-50"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={creating || !title.trim()}
                className="cap-btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create draft"}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white">
        {events.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">
            No events yet. Create your first draft to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <th className="px-4 py-3 font-semibold">Event</th>
                <th className="px-4 py-3 font-semibold">Format</th>
                <th className="px-4 py-3 font-semibold">Starts</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--text-primary)]">{ev.title}</div>
                    <div className="text-xs text-[var(--text-muted)]">/{ev.slug}</div>
                  </td>
                  <td className="px-4 py-3 capitalize text-[var(--text-secondary)]">{ev.format.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{fmtDate(ev.startsAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[ev.status]}`}>
                      {ev.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {ev.status === "draft" && (
                        <button
                          disabled={busyId === ev.id}
                          onClick={() => changeStatus(ev.id, "publish")}
                          className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 disabled:opacity-50"
                        >
                          Publish
                        </button>
                      )}
                      {(ev.status === "published" || ev.status === "live") && (
                        <button
                          disabled={busyId === ev.id}
                          onClick={() => changeStatus(ev.id, "unpublish")}
                          className="rounded-md border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] disabled:opacity-50"
                        >
                          Unpublish
                        </button>
                      )}
                      {ev.status !== "archived" && (
                        <button
                          disabled={busyId === ev.id}
                          onClick={() => changeStatus(ev.id, "archive")}
                          className="rounded-md border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)] disabled:opacity-50"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
