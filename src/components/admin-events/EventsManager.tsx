"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Link from "next/link";
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

/** Turn an API error payload into a readable message. The API may return a string
 *  or a Zod fieldErrors object ({ field: ["msg", ...] }) — flatten the latter so
 *  validation failures aren't hidden behind a generic fallback. */
function formatApiError(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const parts = Object.entries(error as Record<string, unknown>).map(([field, msgs]) => {
      const text = Array.isArray(msgs) ? msgs.join(", ") : String(msgs);
      return `${field}: ${text}`;
    });
    if (parts.length) return `${fallback} (${parts.join("; ")})`;
  }
  return fallback;
}

export function EventsManager({ initialEvents }: { initialEvents: EventRecord[] }) {
  const t = useTranslations("adminCmp");
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

  // duplicate dialog state
  const [dupFor, setDupFor] = useState<EventRecord | null>(null);
  const [dupTitle, setDupTitle] = useState("");
  const [dupOpts, setDupOpts] = useState({ branding: true, sessions: true, sponsors: true });
  const [duplicating, setDuplicating] = useState(false);

  function openDuplicate(ev: EventRecord) {
    setDupFor(ev);
    setDupTitle(`Copy of ${ev.title}`);
    setDupOpts({ branding: true, sessions: true, sponsors: true });
    setError(null);
  }

  async function submitDuplicate() {
    if (!dupFor) return;
    setDuplicating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${dupFor.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: dupTitle.trim() || undefined, ...dupOpts }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(formatApiError(json.error, "Could not duplicate event."));
      setEvents((prev) => [json.event as EventRecord, ...prev]);
      setDupFor(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not duplicate event.");
    } finally {
      setDuplicating(false);
    }
  }

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
      if (!res.ok) throw new Error(formatApiError(json.error, "Could not create event."));
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
      if (!res.ok) throw new Error(formatApiError(json.error, "Could not update status."));
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
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Event Hub</h1>
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
              <span className="text-sm font-medium text-[var(--text-secondary)]">{t("title")}</span>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                placeholder={t("e_g_fintech_founder_showcase_summer_2026")}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-[var(--text-secondary)]">{t("summary")}</span>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                maxLength={2000}
                rows={3}
                className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                placeholder={t("a_short_description_shown_on_the_public_even")}
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-medium text-[var(--text-secondary)]">{t("format")}</span>
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
                <span className="text-sm font-medium text-[var(--text-secondary)]">{t("visibility")}</span>
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
              <span className="text-sm font-medium text-[var(--text-secondary)]">{t("sector_tracks")}</span>
              <p className="text-xs text-[var(--text-muted)]">{t("an_event_must_have_at_least_one_track_before")}</p>
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
                      <button
                        onClick={() => openDuplicate(ev)}
                        className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        Duplicate
                      </button>
                      <Link
                        href={`/admin/events/${ev.id}`}
                        className="rounded-md border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-slate-50"
                      >
                        Manage
                      </Link>
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

      {dupFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
          onClick={() => !duplicating && setDupFor(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[var(--border-subtle)] px-5 py-4">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Duplicate event</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Start a new draft from “{dupFor.title}”. Choose what to carry over.
              </p>
            </div>
            <div className="grid gap-4 px-5 py-4">
              <label className="block">
                <span className="text-sm font-medium text-[var(--text-secondary)]">New event name</span>
                <input
                  value={dupTitle}
                  onChange={(e) => setDupTitle(e.target.value)}
                  maxLength={200}
                  className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                />
              </label>
              <div className="grid gap-2">
                {(
                  [
                    ["branding", "Branding & banner", "Cover, banner, and organiser details"],
                    ["sessions", "Sessions & agenda", "Schedule blocks — dates reset for the new run"],
                    ["sponsors", "Sponsors & placements", "Sponsor tiers and banner slots"],
                  ] as const
                ).map(([key, label, desc]) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={dupOpts[key]}
                      onChange={(e) => setDupOpts((o) => ({ ...o, [key]: e.target.checked }))}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-medium text-[var(--text-primary)]">{label}</span>
                      <span className="block text-xs text-[var(--text-muted)]">{desc}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Sector tracks are always copied. Attendees, registrations, poll results, and analytics are never copied —
                the new event starts fresh as a <b>Draft</b>.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
              <button
                onClick={() => setDupFor(null)}
                disabled={duplicating}
                className="rounded-md border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitDuplicate}
                disabled={duplicating}
                className="cap-btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {duplicating ? "Duplicating…" : "Create copy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
