"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { EVENT_SECTORS, sectorLabel } from "@/lib/icfo-events/sectors";
import { GuestRoster } from "@/components/events/GuestRoster";
import type {
  EventWithDetail,
  EventSession,
  EventFormat,
  EventVisibility,
  Sponsor,
  EventSponsor,
  SessionType,
} from "@/lib/icfo-events/types";

const SESSION_TYPE_VALUES: SessionType[] = ["keynote", "panel", "talk_show", "founder_showcase", "workshop"];
const FORMAT_VALUES: EventFormat[] = ["showcase", "demo_day", "webinar", "hybrid"];
const VISIBILITY_VALUES: EventVisibility[] = ["public", "members"];

/** Flatten an API error (string or Zod fieldErrors object) into a readable message. */
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

/** ISO → value for <input type="datetime-local"> in the viewer's local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SessionLiveControls({
  session,
  onUpdated,
  liveConfigured,
}: {
  session: EventSession;
  onUpdated: (s: EventSession) => void;
  liveConfigured: boolean;
}) {
  const t = useTranslations("eventsAdmin.manage");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLink, setShowLink] = useState(false);
  const [liveUrl, setLiveUrl] = useState("");

  async function goLive(opts?: { liveUrl?: string; useGoogleMeet?: boolean }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/sessions/${session.id}/go-live`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          opts?.useGoogleMeet ? { useGoogleMeet: true } : opts?.liveUrl ? { liveUrl: opts.liveUrl } : {},
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Couldn't go live.");
      onUpdated(json.session as EventSession);
      setShowLink(false);
      setLiveUrl("");
      if (json.hostUrl) window.open(json.hostUrl as string, "_blank", "noopener");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't go live.");
    } finally {
      setBusy(false);
    }
  }

  async function endLive() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/sessions/${session.id}/go-live`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Couldn't end.");
      onUpdated(json.session as EventSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't end.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        {session.status === "live" ? (
          <>
            <span className="rounded bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">● {t("live")}</span>
            {session.videoRef && (
              <a href={session.videoRef} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-[var(--blue)] hover:underline">
                {t("openLiveLink")}
              </a>
            )}
            <button onClick={endLive} disabled={busy} className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-50">
              {busy ? "…" : t("endSession")}
            </button>
          </>
        ) : session.status !== "ended" ? (
          <>
            <button onClick={() => goLive({ useGoogleMeet: true })} disabled={busy} className="text-xs font-medium text-[var(--blue)] hover:underline disabled:opacity-50">
              {busy ? t("starting") : t("createMeet")}
            </button>
            <button onClick={() => setShowLink((v) => !v)} disabled={busy} className="text-xs font-medium text-[var(--blue)] hover:underline disabled:opacity-50">
              {t("goLiveLink")}
            </button>
            {liveConfigured && (
              <button onClick={() => goLive()} disabled={busy} className="text-xs font-medium text-[var(--blue)] hover:underline disabled:opacity-50">
                {t("wherebyRoom")}
              </button>
            )}
          </>
        ) : (
          <span className="text-xs text-[var(--text-muted)]">{t("ended")}</span>
        )}
        {error && <span className="text-xs text-rose-600">{error}</span>}
      </div>

      {showLink && session.status !== "live" && session.status !== "ended" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={liveUrl}
            onChange={(e) => setLiveUrl(e.target.value)}
            placeholder={t("pasteLinkPh")}
            className="min-w-[240px] flex-1 rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs"
          />
          <button
            onClick={() => goLive({ liveUrl: liveUrl.trim() })}
            disabled={busy || !liveUrl.trim()}
            className="rounded-md bg-[var(--blue)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {busy ? t("starting") : t("start")}
          </button>
        </div>
      )}
    </div>
  );
}

function SessionVideoUpload({
  eventId,
  session,
  onUpdated,
}: {
  eventId: string;
  session: EventSession;
  onUpdated: (s: EventSession) => void;
}) {
  const t = useTranslations("eventsAdmin.manage");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("eventId", eventId);
      const res = await fetch(`/api/admin/events/sessions/${session.id}/video`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Upload failed.");
      onUpdated(json.session as EventSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <label className="cursor-pointer text-xs font-medium text-[var(--blue)] hover:underline">
        {busy ? t("uploading") : session.recordingPath ? t("replaceRecording") : t("uploadRecording")}
        <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={upload} disabled={busy} className="hidden" />
      </label>
      <span className="text-xs text-[var(--text-muted)]">{t("videoHint")}</span>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}

export function EventDetailManager({
  event,
  sponsorCatalog,
  initialEventSponsors,
  liveVideoConfigured,
}: {
  event: EventWithDetail;
  sponsorCatalog: Sponsor[];
  initialEventSponsors: EventSponsor[];
  liveVideoConfigured: boolean;
}) {
  const t = useTranslations("eventsAdmin.manage");
  const [sessions, setSessions] = useState<EventSession[]>(event.sessions);
  const [eventSponsors, setEventSponsors] = useState<EventSponsor[]>(initialEventSponsors);
  const [error, setError] = useState<string | null>(null);

  // event details (editable)
  const [title, setTitle] = useState(event.title);
  const [summary, setSummary] = useState(event.summary ?? "");
  const [format, setFormat] = useState<EventFormat>(event.format);
  const [visibility, setVisibility] = useState<EventVisibility>(event.visibility);
  const [startsAt, setStartsAt] = useState(toLocalInput(event.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(event.endsAt));
  const [sectorSlugs, setSectorSlugs] = useState<string[]>(event.sectors.map((s) => s.sectorSlug));
  const [headerTitle, setHeaderTitle] = useState(event.title);
  const [headerSectors, setHeaderSectors] = useState<string[]>(event.sectors.map((s) => s.label));
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState<string | null>(null);

  function toggleDetailSector(slug: string) {
    setSectorSlugs((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
    setDetailsMsg(null);
  }

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setSavingDetails(true);
    setDetailsMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          summary: summary || null,
          format,
          visibility,
          startsAt: startsAt ? new Date(startsAt).toISOString() : null,
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          sectors: sectorSlugs.map((slug) => ({
            sectorSlug: slug,
            label: EVENT_SECTORS.find((s) => s.slug === slug)?.label ?? slug,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(formatApiError(json.error, "Could not save event."));
      setHeaderTitle(title);
      setHeaderSectors(sectorSlugs.map((slug) => EVENT_SECTORS.find((s) => s.slug === slug)?.label ?? slug));
      setDetailsMsg(t("saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save event.");
    } finally {
      setSavingDetails(false);
    }
  }

  // session form
  const [sTitle, setSTitle] = useState("");
  const [sType, setSType] = useState<SessionType>("keynote");
  const [sAbstract, setSAbstract] = useState("");
  const [sSector, setSSector] = useState<string>(event.sectors[0]?.sectorSlug ?? "");
  const [sHost, setSHost] = useState<string>("");
  const [sStartsAt, setSStartsAt] = useState<string>("");
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
          hostSponsorId: sHost || null,
          startsAt: sStartsAt ? new Date(sStartsAt).toISOString() : null,
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

  function onSessionUpdated(updated: EventSession) {
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
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
        <ArrowLeft className="h-4 w-4" /> {t("allEvents")}
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{headerTitle}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            /{event.slug} · <span>{t(`status.${event.status}`)}</span> ·{" "}
            {headerSectors.join(", ") || t("noSectorTracks")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/events/${event.id}/control`}
            className="rounded-md bg-[var(--navy)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            {t("liveControlCenter")}
          </Link>
          <Link
            href={`/admin/events/${event.id}/marketing`}
            className="rounded-md bg-[var(--indigo)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            {t("marketingHub")}
          </Link>
          <Link
            href={`/admin/events/${event.id}/leads`}
            className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-slate-50"
          >
            {t("leads")}
          </Link>
          <Link
            href={`/events/${event.slug}`}
            target="_blank"
            className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-slate-50"
          >
            {t("viewPublic")}
          </Link>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      {/* Event details */}
      <section className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-panel)]">
        <h2 className="font-semibold text-[var(--navy)]">{t("eventDetails")}</h2>
        <form onSubmit={saveDetails} className="mt-4 grid gap-4">
          <label className="block">
            <span className="text-xs font-medium text-[var(--text-muted)]">{t("title")}</span>
            <input
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDetailsMsg(null);
              }}
              maxLength={200}
              className="mt-1 block w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-[var(--text-muted)]">{t("summary")}</span>
            <textarea
              value={summary}
              onChange={(e) => {
                setSummary(e.target.value);
                setDetailsMsg(null);
              }}
              rows={4}
              maxLength={2000}
              className="mt-1 block w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-[var(--text-muted)]">{t("format")}</span>
              <select
                value={format}
                onChange={(e) => {
                  setFormat(e.target.value as EventFormat);
                  setDetailsMsg(null);
                }}
                className="mt-1 block w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
              >
                {FORMAT_VALUES.map((f) => (
                  <option key={f} value={f}>{t(`fmt.${f}`)}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[var(--text-muted)]">{t("visibility")}</span>
              <select
                value={visibility}
                onChange={(e) => {
                  setVisibility(e.target.value as EventVisibility);
                  setDetailsMsg(null);
                }}
                className="mt-1 block w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
              >
                {VISIBILITY_VALUES.map((v) => (
                  <option key={v} value={v}>{t(`vis.${v}`)}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-[var(--text-muted)]">{t("startsAtOpt")}</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => {
                  setStartsAt(e.target.value);
                  setDetailsMsg(null);
                }}
                className="mt-1 block w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[var(--text-muted)]">{t("endsAtOpt")}</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => {
                  setEndsAt(e.target.value);
                  setDetailsMsg(null);
                }}
                className="mt-1 block w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div>
            <span className="text-xs font-medium text-[var(--text-muted)]">{t("sectorTracks")}</span>
            <p className="text-xs text-[var(--text-muted)]">{t("sectorHint")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {EVENT_SECTORS.map((s) => {
                const active = sectorSlugs.includes(s.slug);
                return (
                  <button
                    key={s.slug}
                    type="button"
                    onClick={() => toggleDetailSector(s.slug)}
                    aria-pressed={active}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
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

          <div className="flex items-center justify-end gap-3 border-t border-[var(--border-subtle)] pt-4">
            {detailsMsg && <span className="text-sm font-medium text-emerald-700">{detailsMsg}</span>}
            <button
              type="submit"
              disabled={savingDetails || !title.trim()}
              className="cap-btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {savingDetails ? t("saving") : t("saveChanges")}
            </button>
          </div>
        </form>
      </section>

      {/* Sessions */}
      <section className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-panel)]">
        <h2 className="font-semibold text-[var(--navy)]">{t("sessions")}</h2>
        <div className="mt-3 space-y-2">
          {sessions.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">{t("noSessions")}</p>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="rounded bg-[var(--indigo-soft)] px-2 py-0.5 text-xs font-medium text-[var(--indigo)]">
                      {t(`type.${s.type}`)}
                    </span>
                    <span className="ml-2 text-sm font-medium text-[var(--navy)]">{s.title}</span>
                    {s.sectorSlug && <span className="ml-2 text-xs text-[var(--text-muted)]">{sectorLabel(s.sectorSlug)}</span>}
                    {s.recordingPath && (
                      <span className="ml-2 rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{t("recorded")}</span>
                    )}
                  </div>
                  <button onClick={() => removeSession(s.id)} className="text-xs text-rose-600 hover:underline">
                    {t("remove")}
                  </button>
                </div>
                <SessionLiveControls session={s} onUpdated={onSessionUpdated} liveConfigured={liveVideoConfigured} />
                <SessionVideoUpload eventId={event.id} session={s} onUpdated={onSessionUpdated} />
                {s.type === "talk_show" && <GuestRoster sessionId={s.id} eventId={event.id} />}
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
              placeholder={t("sessionTitlePh")}
              className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
            />
            <select value={sType} onChange={(e) => setSType(e.target.value as SessionType)} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm">
              {SESSION_TYPE_VALUES.map((v) => (
                <option key={v} value={v}>{t(`type.${v}`)}</option>
              ))}
            </select>
          </div>
          {event.sectors.length > 0 && (
            <select value={sSector} onChange={(e) => setSSector(e.target.value)} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm">
              <option value="">{t("noSpecificTrack")}</option>
              {event.sectors.map((s) => (
                <option key={s.id} value={s.sectorSlug}>{s.label}</option>
              ))}
            </select>
          )}
          {eventSponsors.length > 0 && (
            <select value={sHost} onChange={(e) => setSHost(e.target.value)} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm">
              <option value="">{t("noHostSponsor")}</option>
              {eventSponsors.map((s) => (
                <option key={s.id} value={s.id}>{t("hostedBy", { name: s.name })}</option>
              ))}
            </select>
          )}
          <textarea
            value={sAbstract}
            onChange={(e) => setSAbstract(e.target.value)}
            rows={2}
            placeholder={t("abstractPh")}
            className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
          />
          <label className="text-xs text-[var(--text-muted)]">
            {t("premiereHint")}
            <input
              type="datetime-local"
              value={sStartsAt}
              onChange={(e) => setSStartsAt(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
            />
          </label>
          <div className="flex justify-end">
            <button type="submit" disabled={addingSession || !sTitle.trim()} className="cap-btn-primary rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50">
              {addingSession ? t("adding") : t("addSession")}
            </button>
          </div>
        </form>
      </section>

      {/* Sponsors */}
      <section className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-panel)]">
        <h2 className="font-semibold text-[var(--navy)]">{t("sponsors")}</h2>
        <div className="mt-3 space-y-2">
          {eventSponsors.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">{t("noSponsorsAttached")}</p>
          ) : (
            eventSponsors.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-[var(--navy)]">{s.name}</span>
                  <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">{s.placement}</span>
                  <span className="ml-2 text-xs capitalize text-[var(--text-muted)]">{s.tier}</span>
                </div>
                <button onClick={() => detachSponsor(s.id)} className="text-xs text-rose-600 hover:underline">
                  {t("remove")}
                </button>
              </div>
            ))
          )}
        </div>

        {sponsorCatalog.length === 0 ? (
          <p className="mt-4 border-t border-[var(--border-subtle)] pt-4 text-sm text-[var(--text-muted)]">
            {t("noCatalogPre")}
            <Link href="/admin/events/sponsors" className="text-[var(--blue)] underline">{t("catalogLink")}</Link>.
          </p>
        ) : (
          <form onSubmit={attachSponsor} className="mt-4 flex flex-wrap items-end gap-3 border-t border-[var(--border-subtle)] pt-4">
            <label className="block">
              <span className="text-xs text-[var(--text-muted)]">{t("sponsor")}</span>
              <select value={sponsorId} onChange={(e) => setSponsorId(e.target.value)} className="mt-1 block rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm">
                {sponsorCatalog.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-[var(--text-muted)]">{t("placement")}</span>
              <select value={placement} onChange={(e) => setPlacement(e.target.value as typeof placement)} className="mt-1 block rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm">
                <option value="presenting">{t("presenting")}</option>
                <option value="track">{t("track")}</option>
                <option value="logo">{t("logo")}</option>
              </select>
            </label>
            <button type="submit" disabled={attaching} className="cap-btn-primary rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50">
              {attaching ? t("attaching") : t("attach")}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
