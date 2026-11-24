"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import type { EventSession } from "@/lib/icfo-events/types";
import { GuestRoster } from "@/components/events/GuestRoster";

type Room = "talk-show";

const ROOM_LABEL: Record<Room, string> = { "talk-show": "Talk Show" };
const ROOM_PATH: Record<Room, string> = { "talk-show": "/talk-show" };
const STATUS_LABEL: Record<string, string> = { scheduled: "Scheduled", live: "On air", ended: "Ended" };

function fmt(iso: string | null, tz: string): string {
  if (!iso) return "Time not set";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });
}

/** Run the sessions of one Studio room: start and end them, and jump to the
 *  public room and the live control center. Uses the same go-live API as the
 *  live control center, so the public tab reacts the same way. */
export function SessionStudio({
  room,
  eventId,
  slug,
  timezone,
  initialSessions,
  canEdit,
}: {
  room: Room;
  eventId: string;
  slug: string;
  timezone: string;
  initialSessions: EventSession[];
  canEdit: boolean;
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [liveUrl, setLiveUrl] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const live = sessions.filter((s) => s.status === "live").length;
  const scheduled = sessions.filter((s) => s.status === "scheduled").length;
  const ended = sessions.filter((s) => s.status === "ended").length;

  async function change(s: EventSession, go: boolean) {
    if (!go && !window.confirm(`End "${s.title}"? Everyone watching is dropped and the question queue is cleared.`)) return;
    setBusy(s.id);
    setError(null);
    try {
      const url = (liveUrl[s.id] ?? "").trim();
      const res = await fetch(`/api/admin/events/sessions/${s.id}/go-live`, {
        method: go ? "POST" : "DELETE",
        headers: go ? { "Content-Type": "application/json" } : undefined,
        body: go ? JSON.stringify(url ? { liveUrl: url } : {}) : undefined,
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "That didn't work. Try again.");
      setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...x, status: go ? "live" : "ended" } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="On air"
          value={String(live)}
          unit={`of ${sessions.length}`}
          detail={`${ROOM_LABEL[room]} sessions`}
          ring={sessions.length ? { percent: Math.round((live / sessions.length) * 100) } : { percent: null, pending: true }}
          audience="admin"
        />
        <MetricCard label="Scheduled" value={String(scheduled)} detail="waiting to go live" ring={{ percent: null, pending: true }} audience="admin" />
        <MetricCard label="Ended" value={String(ended)} detail="finished sessions" ring={{ percent: null, pending: true }} audience="admin" />
      </div>

      <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Run of show</h2>
          <div className="flex items-center gap-2">
            <Link href={`/admin/events/${eventId}`} className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-slate-50">
              Edit sessions
            </Link>
            <Link href={`/admin/events/${eventId}/control`} className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-slate-50">
              Live control center
            </Link>
            <Link href={"/events/" + slug + ROOM_PATH[room]} target="_blank" className="cap-btn-primary inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium">
              Open {ROOM_LABEL[room]} <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <ul className="mt-3 divide-y divide-slate-100">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">{s.title}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {fmt(s.startsAt, timezone)} to {fmt(s.endsAt, timezone)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${s.status === "live" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
                {canEdit && s.status === "scheduled" ? (
                  <>
                    <input
                      value={liveUrl[s.id] ?? ""}
                      onChange={(e) => setLiveUrl((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      placeholder="Live link (optional)"
                      aria-label={`Live link for ${s.title}`}
                      className="w-48 rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-xs"
                    />
                    <button type="button" disabled={busy !== null} onClick={() => change(s, true)} className="cap-btn-primary rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50">
                      {busy === s.id ? "Starting…" : "Go live"}
                    </button>
                  </>
                ) : null}
                {canEdit && s.status === "live" ? (
                  <button type="button" disabled={busy !== null} onClick={() => change(s, false)} className="rounded-md border border-rose-300 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                    {busy === s.id ? "Ending…" : "End session"}
                  </button>
                ) : null}
              </div>
              {room === "talk-show" && canEdit ? (
                <div className="w-full">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Host and guests (green room)</p>
                  <GuestRoster sessionId={s.id} eventId={eventId} />
                </div>
              ) : null}
            </li>
          ))}
          {sessions.length === 0 ? (
            <li className="py-4 text-sm text-[var(--text-muted)]">
              No {ROOM_LABEL[room]} sessions yet. Add one on the event page{room === "talk-show" ? " with the type Talk show" : ""}.
            </li>
          ) : null}
        </ul>
        {error ? <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      </section>
    </div>
  );
}
