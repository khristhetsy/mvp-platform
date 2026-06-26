"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { sectorLabel } from "@/lib/icfo-events/sectors";
import type {
  EventWithDetail,
  EventSession,
  Sponsor,
  EventSponsor,
  SessionType,
} from "@/lib/icfo-events/types";

const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: "keynote", label: "Keynote" },
  { value: "panel", label: "Panel" },
  { value: "talk_show", label: "Talk Show" },
  { value: "founder_showcase", label: "Founder Showcase" },
  { value: "workshop", label: "Workshop" },
];

export function EventDetailManager({
  event,
  sponsorCatalog,
  initialEventSponsors,
}: {
  event: EventWithDetail;
  sponsorCatalog: Sponsor[];
  initialEventSponsors: EventSponsor[];
}) {
  const [sessions, setSessions] = useState<EventSession[]>(event.sessions);
  const [eventSponsors, setEventSponsors] = useState<EventSponsor[]>(initialEventSponsors);
  const [error, setError] = useState<string | null>(null);

  // session form
  const [sTitle, setSTitle] = useState("");
  const [sType, setSType] = useState<SessionType>("keynote");
  const [sAbstract, setSAbstract] = useState("");
  const [sSector, setSSector] = useState<string>(event.sectors[0]?.sectorSlug ?? "");
  const [addingSession, setAddingSession] = useState(false);

  // sponsor attach
  const [sponsorId, setSponsorId] = useState<string>(sponsorCatalog[0]?.id ?? "");
  const [placement, setPlacement] = useState<"presenting" | "track" | "logo">("logo");
  const [attaching, setAttaching] = useState(false);

  async function addSession(e: React.FormEvent) {
    e.preventDefault();
    setAddingSession(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${event.id}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: sTitle,
          type: sType,
          abstract: sAbstract || null,
          sectorSlug: sSector || null,
          position: sessions.length,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not add session.");
      setSessions((prev) => [...prev, json.session as EventSession]);
      setSTitle("");
      setSAbstract("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add session.");
    } finally {
      setAddingSession(false);
    }
  }

  async function removeSession(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(typeof json.error === "string" ? json.error : "Could not delete session.");
      }
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete session.");
    }
  }

  async function attachSponsor(e: React.FormEvent) {
    e.preventDefault();
    if (!sponsorId) return;
    setAttaching(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${event.id}/sponsors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sponsorId, placement }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(typeof json.error === "string" ? json.error : "Could not attach sponsor.");
      }
      const sponsor = sponsorCatalog.find((s) => s.id === sponsorId);
      if (sponsor && !eventSponsors.some((es) => es.id === sponsor.id)) {
        setEventSponsors((prev) => [...prev, { ...sponsor, eventSponsorId: sponsor.id, placement, logoUrl: null }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not attach sponsor.");
    } finally {
      setAttaching(false);
    }
  }

  async function detachSponsor(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${event.id}/sponsors?sponsorId=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(typeof json.error === "string" ? json.error : "Could not detach sponsor.");
      }
      setEventSponsors((prev) => prev.filter((es) => es.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not detach sponsor.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link href="/admin/events" className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <ArrowLeft className="h-4 w-4" /> All events
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{event.title}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            /{event.slug} · <span className="capitalize">{event.status}</span> ·{" "}
            {event.sectors.map((s) => s.label).join(", ") || "no sector tracks"}
          </p>
        </div>
        <Link
          href={`/events/${event.slug}`}
          target="_blank"
          className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-slate-50"
        >
          View public page
        </Link>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      {/* Sessions */}
      <section className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-panel)]">
        <h2 className="font-semibold text-[var(--navy)]">Sessions</h2>
        <div className="mt-3 space-y-2">
          {sessions.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No sessions yet.</p>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                <div>
                  <span className="rounded bg-[var(--indigo-soft)] px-2 py-0.5 text-xs font-medium text-[var(--indigo)]">
                    {SESSION_TYPES.find((t) => t.value === s.type)?.label ?? s.type}
                  </span>
                  <span className="ml-2 text-sm font-medium text-[var(--navy)]">{s.title}</span>
                  {s.sectorSlug && <span className="ml-2 text-xs text-[var(--text-muted)]">{sectorLabel(s.sectorSlug)}</span>}
                </div>
                <button onClick={() => removeSession(s.id)} className="text-xs text-rose-600 hover:underline">
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        <form onSubmit={addSession} className="mt-4 grid gap-3 border-t border-[var(--border-subtle)] pt-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              value={sTitle}
              onChange={(e) => setSTitle(e.target.value)}
              placeholder="Session title"
              className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
            />
            <select value={sType} onChange={(e) => setSType(e.target.value as SessionType)} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm">
              {SESSION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          {event.sectors.length > 0 && (
            <select value={sSector} onChange={(e) => setSSector(e.target.value)} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm">
              <option value="">No specific track</option>
              {event.sectors.map((s) => (
                <option key={s.id} value={s.sectorSlug}>{s.label}</option>
              ))}
            </select>
          )}
          <textarea
            value={sAbstract}
            onChange={(e) => setSAbstract(e.target.value)}
            rows={2}
            placeholder="Abstract (optional)"
            className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
          />
          <div className="flex justify-end">
            <button type="submit" disabled={addingSession || !sTitle.trim()} className="cap-btn-primary rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50">
              {addingSession ? "Adding…" : "Add session"}
            </button>
          </div>
        </form>
      </section>

      {/* Sponsors */}
      <section className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-panel)]">
        <h2 className="font-semibold text-[var(--navy)]">Sponsors</h2>
        <div className="mt-3 space-y-2">
          {eventSponsors.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No sponsors attached.</p>
          ) : (
            eventSponsors.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-[var(--navy)]">{s.name}</span>
                  <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">{s.placement}</span>
                  <span className="ml-2 text-xs capitalize text-[var(--text-muted)]">{s.tier}</span>
                </div>
                <button onClick={() => detachSponsor(s.id)} className="text-xs text-rose-600 hover:underline">
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        {sponsorCatalog.length === 0 ? (
          <p className="mt-4 border-t border-[var(--border-subtle)] pt-4 text-sm text-[var(--text-muted)]">
            No sponsors in the catalog yet. Create sponsors in{" "}
            <Link href="/admin/events/sponsors" className="text-[var(--blue)] underline">Sponsor catalog</Link>.
          </p>
        ) : (
          <form onSubmit={attachSponsor} className="mt-4 flex flex-wrap items-end gap-3 border-t border-[var(--border-subtle)] pt-4">
            <label className="block">
              <span className="text-xs text-[var(--text-muted)]">Sponsor</span>
              <select value={sponsorId} onChange={(e) => setSponsorId(e.target.value)} className="mt-1 block rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm">
                {sponsorCatalog.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-[var(--text-muted)]">Placement</span>
              <select value={placement} onChange={(e) => setPlacement(e.target.value as typeof placement)} className="mt-1 block rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm">
                <option value="presenting">Presenting</option>
                <option value="track">Track</option>
                <option value="logo">Logo</option>
              </select>
            </label>
            <button type="submit" disabled={attaching} className="cap-btn-primary rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50">
              {attaching ? "Attaching…" : "Attach"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
