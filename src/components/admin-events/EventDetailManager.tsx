"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, GripVertical, Mic, Users, Radio, Presentation, Wrench, Pin } from "lucide-react";
import { useTranslations } from "next-intl";
import { EVENT_SECTORS, sectorLabel } from "@/lib/icfo-events/sectors";
import { GuestRoster } from "@/components/events/GuestRoster";
import { BannerEditor } from "@/components/admin-events/BannerEditor";
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

/** Clean business/line icons per session type (replaces emoji marks). */
const SESSION_ICONS: Record<SessionType, typeof Mic> = {
  keynote: Mic,
  panel: Users,
  talk_show: Radio,
  founder_showcase: Presentation,
  workshop: Wrench,
};
const FORMAT_VALUES: EventFormat[] = ["showcase", "demo_day", "webinar", "hybrid"];
const VISIBILITY_VALUES: EventVisibility[] = ["public", "members"];

/** Common IANA timezones for the schedule (label + value). */
const TIMEZONES: { value: string; label: string }[] = [
  { value: "America/Los_Angeles", label: "Pacific — America/Los_Angeles" },
  { value: "America/Denver", label: "Mountain — America/Denver" },
  { value: "America/Chicago", label: "Central — America/Chicago" },
  { value: "America/New_York", label: "Eastern — America/New_York" },
  { value: "Europe/London", label: "UK — Europe/London" },
  { value: "Europe/Paris", label: "Central Europe — Europe/Paris" },
  { value: "Asia/Dubai", label: "Gulf — Asia/Dubai" },
  { value: "Asia/Singapore", label: "Singapore — Asia/Singapore" },
  { value: "Australia/Sydney", label: "Sydney — Australia/Sydney" },
];

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

  // Open/close the room to attendees before the scheduled start time. Staff can
  // always enter early; this flag only affects attendees.
  async function toggleDoors() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doorsOpen: !session.doorsOpen }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Couldn't update early access.");
      onUpdated(json.session as EventSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update early access.");
    } finally {
      setBusy(false);
    }
  }

  // Show/hide the attendee Chat tab in this session's live panel (Q&A always on).
  async function toggleChat() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatEnabled: !session.chatEnabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Couldn't update chat.");
      onUpdated(json.session as EventSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update chat.");
    } finally {
      setBusy(false);
    }
  }
  async function toggleCallIn() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callInEnabled: !session.callInEnabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Couldn't update call-in.");
      onUpdated(json.session as EventSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update call-in.");
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
            <span aria-hidden className="text-slate-300">·</span>
            {session.doorsOpen ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Early access open</span>
                <button onClick={toggleDoors} disabled={busy} className="text-xs font-medium text-[var(--text-muted)] hover:underline disabled:opacity-50">
                  Close
                </button>
              </span>
            ) : (
              <button onClick={toggleDoors} disabled={busy} className="text-xs font-medium text-[var(--blue)] hover:underline disabled:opacity-50" title="Let attendees join before the scheduled start time">
                {busy ? "…" : "Open early access"}
              </button>
            )}
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
          <p className="w-full text-xs text-[var(--text-muted)]">
            Vimeo, YouTube, and Whereby links embed and play inline (on the Talk Show too). Vimeo:
            paste <code>vimeo.com/123…</code> or a live <code>vimeo.com/event/…</code> link. Zoom and Google
            Meet can&apos;t be embedded, so they show a &ldquo;Join&rdquo; button instead.
          </p>
        </div>
      )}

      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="text-[var(--text-muted)]">Attendee chat</span>
        <button
          onClick={toggleChat}
          disabled={busy}
          role="switch"
          aria-checked={session.chatEnabled}
          title={session.chatEnabled ? "Chat is on — click to show Q&A only" : "Chat is off (Q&A only) — click to enable"}
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold disabled:opacity-50 ${
            session.chatEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {session.chatEnabled ? "On" : "Off · Q&A only"}
        </button>
        <span className="mx-1 h-3 w-px bg-[var(--border-subtle)]" />
        <span className="text-[var(--text-muted)]">Call-in queue</span>
        <button
          onClick={toggleCallIn}
          disabled={busy}
          role="switch"
          aria-checked={session.callInEnabled}
          title={session.callInEnabled ? "Call-in queue is shown — click to hide it and make the video full-width" : "Call-in queue is hidden (video is full-width) — click to show it"}
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold disabled:opacity-50 ${
            session.callInEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {session.callInEnabled ? "On" : "Off · full-width video"}
        </button>
      </div>
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
  bannerSlot,
  canEdit = true,
}: {
  event: EventWithDetail;
  sponsorCatalog: Sponsor[];
  initialEventSponsors: EventSponsor[];
  liveVideoConfigured: boolean;
  bannerSlot?: ReactNode;
  canEdit?: boolean;
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
  const [timezone, setTimezone] = useState<string>(event.timezone ?? "");
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
          timezone: timezone || null,
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

  // inline session editing
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState<SessionType>("keynote");
  const [editSector, setEditSector] = useState<string>("");
  const [editAbstract, setEditAbstract] = useState("");
  const [editVideoRef, setEditVideoRef] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  function startEdit(s: EventSession) {
    setEditId(s.id);
    setEditTitle(s.title);
    setEditType(s.type);
    setEditSector(s.sectorSlug ?? "");
    setEditAbstract(s.abstract ?? "");
    setEditVideoRef(s.videoRef ?? "");
    setError(null);
  }
  async function saveEdit() {
    if (!editId) return;
    setSavingEdit(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/sessions/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          type: editType,
          sectorSlug: editSector || null,
          abstract: editAbstract || null,
          videoRef: editVideoRef.trim() || null,
          videoProvider: editVideoRef.trim() ? "external" : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(formatApiError(json.error, "Could not save session."));
      onSessionUpdated(json.session as EventSession);
      setEditId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save session.");
    } finally {
      setSavingEdit(false);
    }
  }

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

  // Pin a session as the Main Stage headline (or unpin). Only one per event, so
  // pinning one clears the flag on the others locally too.
  async function setHeadline(s: EventSession, value: boolean) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/sessions/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHeadline: value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(formatApiError(json.error, "Could not update the Main Stage pin."));
      setSessions((prev) =>
        prev.map((x) =>
          x.id === s.id ? (json.session as EventSession) : value ? { ...x, isHeadline: false } : x,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the Main Stage pin.");
    }
  }

  // Drag-to-reorder sessions. The list reorders live as you drag; the new order
  // is saved when you drop.
  const [dragId, setDragId] = useState<string | null>(null);
  function reorderTo(overId: string) {
    if (!dragId || dragId === overId) return;
    setSessions((prev) => {
      const from = prev.findIndex((s) => s.id === dragId);
      const to = prev.findIndex((s) => s.id === overId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }
  function commitOrder() {
    setDragId(null);
    setSessions((prev) => {
      const ids = prev.map((s) => s.id);
      void fetch(`/api/admin/events/${event.id}/sessions/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      }).catch(() => {});
      return prev;
    });
  }

  // Remove a session, but keep it in hand so it can be restored via an Undo
  // toast (a delete is otherwise unrecoverable).
  const [removedSession, setRemovedSession] = useState<EventSession | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function removeSession(s: EventSession) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/sessions/${s.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(typeof json.error === "string" ? json.error : "Could not delete session.");
      }
      setSessions((prev) => prev.filter((x) => x.id !== s.id));
      setRemovedSession(s);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setRemovedSession(null), 7000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete session.");
    }
  }

  async function undoRemove() {
    const s = removedSession;
    if (!s) return;
    setRemovedSession(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    try {
      const res = await fetch(`/api/admin/events/${event.id}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: s.title,
          type: s.type,
          abstract: s.abstract,
          sectorSlug: s.sectorSlug,
          hostSponsorId: s.hostSponsorId,
          startsAt: s.startsAt,
          position: s.position,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not restore session.");
      setSessions((prev) => [...prev, json.session as EventSession].sort((a, b) => a.position - b.position));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore session.");
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
          {canEdit && (
            <Link
              href={`/admin/events/${event.id}/control`}
              className="rounded-md bg-[var(--navy)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              {t("liveControlCenter")}
            </Link>
          )}
          {canEdit && (
            <Link
              href={`/admin/events/${event.id}/marketing`}
              className="rounded-md bg-[var(--indigo)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              {t("marketingHub")}
            </Link>
          )}
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

      {!canEdit && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span aria-hidden><i className="ti ti-lock" aria-hidden="true" /></span> View only — you can see this event but don&rsquo;t have permission to edit it.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      {/* Event details */}
      <section className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-panel)]">
        <h2 className="font-semibold text-[var(--navy)]">{t("eventDetails")}</h2>
        <form onSubmit={saveDetails} className="mt-4">
          <fieldset disabled={!canEdit} className="grid gap-4 min-w-0 border-0 p-0 m-0">
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

          <label className="block">
            <span className="text-xs font-medium text-[var(--text-muted)]">Timezone</span>
            <select
              value={timezone}
              onChange={(e) => { setTimezone(e.target.value); setDetailsMsg(null); }}
              className="mt-1 block w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
            >
              <option value="">Not set</option>
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-[var(--text-muted)]">
              Shown next to the schedule so attendees know which zone the times are in.
            </span>
          </label>

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

            {canEdit && (
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
            )}
          </fieldset>
        </form>
      </section>

      {/* Event banner (cover image) — sits directly under Event details */}
      {bannerSlot ? <div className="mt-6">{bannerSlot}</div> : null}

      {/* Page banner, countdown & side rail */}
      {canEdit && <BannerEditor event={event} />}

      {/* Sessions */}
      <section className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-panel)]">
        <h2 className="font-semibold text-[var(--navy)]">{t("sessions")}</h2>
        <div className="mt-3 space-y-2">
          {sessions.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">{t("noSessions")}</p>
          ) : (
            sessions.map((s) => {
              const TypeIcon = SESSION_ICONS[s.type] ?? Mic;
              const editing = editId === s.id;
              return (
              <div
                key={s.id}
                className={`rounded-lg border px-3 py-2 transition ${editing ? "border-[#bcd3fb] bg-[#f6faff]" : "border-[var(--border-subtle)]"} ${dragId === s.id ? "opacity-50" : ""}`}
                draggable={canEdit && !editing}
                onDragStart={canEdit && !editing ? () => setDragId(s.id) : undefined}
                onDragOver={canEdit && !editing ? (e) => { e.preventDefault(); reorderTo(s.id); } : undefined}
                onDrop={canEdit && !editing ? (e) => { e.preventDefault(); commitOrder(); } : undefined}
                onDragEnd={canEdit && !editing ? commitOrder : undefined}
              >
                {editing ? (
                  <div className="grid gap-3 py-1">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--blue)]">
                      <TypeIcon className="h-4 w-4" /> Editing session
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder={t("sessionTitlePh")}
                        className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                      />
                      <select value={editType} onChange={(e) => setEditType(e.target.value as SessionType)} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm">
                        {SESSION_TYPE_VALUES.map((v) => (
                          <option key={v} value={v}>{t(`type.${v}`)}</option>
                        ))}
                      </select>
                    </div>
                    {event.sectors.length > 0 && (
                      <select value={editSector} onChange={(e) => setEditSector(e.target.value)} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm">
                        <option value="">{t("noSpecificTrack")}</option>
                        {event.sectors.map((sec) => (
                          <option key={sec.id} value={sec.sectorSlug}>{sec.label}</option>
                        ))}
                      </select>
                    )}
                    <textarea
                      value={editAbstract}
                      onChange={(e) => setEditAbstract(e.target.value)}
                      rows={2}
                      placeholder="Short description shown on the agenda (optional)"
                      className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                    />
                    <div>
                      <input
                        value={editVideoRef}
                        onChange={(e) => setEditVideoRef(e.target.value)}
                        placeholder="Live video link (e.g. Zoom, Vimeo, YouTube) — optional"
                        className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                      />
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        Paste a Zoom link and it embeds on the Talk Show; it also becomes the host&apos;s
                        &ldquo;Open live link&rdquo; to start the meeting. Vimeo/YouTube/Whereby links play inline.
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setEditId(null)} disabled={savingEdit} className="rounded-md border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium disabled:opacity-50">
                        Cancel
                      </button>
                      <button type="button" onClick={saveEdit} disabled={savingEdit || !editTitle.trim()} className="cap-btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
                        {savingEdit ? t("saving") : t("saveChanges")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {canEdit && (
                          <span className="cursor-grab text-slate-300 active:cursor-grabbing" title="Drag to reorder" aria-hidden>
                            <GripVertical className="h-4 w-4" />
                          </span>
                        )}
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--indigo-soft)] text-[var(--indigo)]" aria-hidden>
                          <TypeIcon className="h-4 w-4" />
                        </span>
                        <div>
                          <span className="rounded bg-[var(--indigo-soft)] px-2 py-0.5 text-xs font-medium text-[var(--indigo)]">
                            {t(`type.${s.type}`)}
                          </span>
                          <span className="ml-2 text-sm font-medium text-[var(--navy)]">{s.title}</span>
                          {s.sectorSlug && <span className="ml-2 text-xs text-[var(--text-muted)]">{sectorLabel(s.sectorSlug)}</span>}
                          {s.recordingPath && (
                            <span className="ml-2 rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{t("recorded")}</span>
                          )}
                          {s.isHeadline && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded bg-[var(--navy)] px-2 py-0.5 text-xs font-medium text-white">
                              <Pin className="h-3 w-3" /> Main Stage
                            </span>
                          )}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-3">
                          {s.type !== "talk_show" && (
                            <button
                              onClick={() => setHeadline(s, !s.isHeadline)}
                              className={`text-xs font-medium hover:underline ${s.isHeadline ? "text-emerald-700" : "text-[var(--blue)]"}`}
                              title="Pin this session as the Main Stage headline — it stays on Main Stage even when other sessions go live"
                            >
                              {s.isHeadline ? "Unpin Main Stage" : "Pin to Main Stage"}
                            </button>
                          )}
                          <button onClick={() => startEdit(s)} className="text-xs font-medium text-[var(--blue)] hover:underline">
                            Edit
                          </button>
                          <button onClick={() => removeSession(s)} className="text-xs text-rose-600 hover:underline">
                            {t("remove")}
                          </button>
                        </div>
                      )}
                    </div>
                    {canEdit && <SessionLiveControls session={s} onUpdated={onSessionUpdated} liveConfigured={liveVideoConfigured} />}
                    {canEdit && <SessionVideoUpload eventId={event.id} session={s} onUpdated={onSessionUpdated} />}
                    {canEdit && s.type === "talk_show" && <GuestRoster sessionId={s.id} eventId={event.id} />}
                  </>
                )}
              </div>
              );
            })
          )}
        </div>

        {canEdit && (
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
        )}
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
                {canEdit && (
                  <button onClick={() => detachSponsor(s.id)} className="text-xs text-rose-600 hover:underline">
                    {t("remove")}
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {!canEdit ? null : sponsorCatalog.length === 0 ? (
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

      {removedSession && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-lg bg-[var(--navy)] px-4 py-2.5 text-sm text-white shadow-lg">
          <span>Session “{removedSession.title}” removed</span>
          <button onClick={undoRemove} className="font-semibold text-[#7fdcc0] hover:underline">
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
