"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { GuestRoster } from "@/components/events/GuestRoster";
import { formatClock, minutesBetween } from "@/lib/icfo-events/spotlight/rules";
import { pickTalkShowSession } from "@/lib/icfo-events/rooms";
import type { EventSession } from "@/lib/icfo-events/types";

function fmt(iso: string | null, tz: string): string {
  if (!iso) return "Time not set";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });
}

async function call(sessionId: string, go: boolean, liveUrl: string) {
  const res = await fetch(`/api/admin/events/sessions/${sessionId}/go-live`, {
    method: go ? "POST" : "DELETE",
    headers: go ? { "Content-Type": "application/json" } : undefined,
    body: go ? JSON.stringify(liveUrl ? { liveUrl } : {}) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? "That didn't work. Try again.");
}

/** Talk Show Studio: the talk show sessions of one event as segments, with the
 *  host and guests roster. Starts and ends sessions with the go-live API the live
 *  control center uses, so the public Talk Show tab follows. Nothing is recorded. */
export function SessionStudio({
  events,
  eventId,
  slug,
  timezone,
  initialSessions,
  guestCounts,
  canEdit,
}: {
  events: { id: string; title: string }[];
  eventId: string;
  slug: string;
  timezone: string;
  initialSessions: EventSession[];
  guestCounts: Record<string, { total: number; onstage: number }>;
  canEdit: boolean;
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [liveUrl, setLiveUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ordered = [...sessions].sort((a, b) => (a.startsAt ?? "9").localeCompare(b.startsAt ?? "9"));
  const programSession = ordered.find((s) => s.status === "live") ?? null;
  const upNext = ordered.find((s) => s.status === "scheduled") ?? null;
  const featured = pickTalkShowSession(sessions);

  const guests = Object.values(guestCounts).reduce((t, g) => t + g.total, 0);
  const onstage = Object.values(guestCounts).reduce((t, g) => t + g.onstage, 0);
  const minutes = ordered.map((s) => minutesBetween(s.startsAt, s.endsAt));
  const measured = ordered.length > 0 && minutes.every((m) => m != null);
  const runtimeSeconds = minutes.reduce<number>((t, m) => t + (m ?? 0) * 60, 0);

  function mark(id: string, status: EventSession["status"]) {
    setSessions((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const goLive = () => upNext && run(async () => {
    await call(upNext.id, true, liveUrl.trim());
    mark(upNext.id, "live");
  });
  const endShow = () => programSession && window.confirm(`End "${programSession.title}"? Everyone watching is dropped and the question queue is cleared.`) && run(async () => {
    await call(programSession.id, false, "");
    mark(programSession.id, "ended");
  });
  const nextSegment = () => programSession && upNext && run(async () => {
    await call(programSession.id, false, "");
    mark(programSession.id, "ended");
    await call(upNext.id, true, liveUrl.trim());
    mark(upNext.id, "live");
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-[var(--text-muted)]">Admin Workspace / Studio / Talk Show Studio</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Talk Show Studio</h1>
          <div className="flex flex-wrap items-center gap-2">
            <form method="get" action="/admin/studio/talk-show" className="flex items-center gap-2">
              <select name="event" defaultValue={eventId} aria-label="Event" className="rounded-md border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-sm">
                {events.map((e) => (
                  <option key={e.id} value={e.id}>{e.title}</option>
                ))}
              </select>
              <button type="submit" className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm hover:bg-slate-50">Open</button>
            </form>
            <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wider text-white ${programSession ? "bg-rose-500" : "bg-slate-500"}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              {programSession ? "ON AIR" : "OFF AIR"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Segments" value={String(sessions.length)} detail="talk show sessions in this event" ring={{ percent: null, pending: true }} audience="admin" />
        <MetricCard label="Guests invited" value={String(guests)} detail="on the host and guest rosters" ring={{ percent: null, pending: true }} audience="admin" />
        <MetricCard label="On stage" value={String(onstage)} unit={guests ? `of ${guests}` : undefined} detail="guests on stage now" ring={guests ? { percent: Math.round((onstage / guests) * 100) } : { percent: null, pending: true }} audience="admin" />
        <MetricCard label="Total runtime" value={measured ? formatClock(runtimeSeconds) : "Not measured"} detail={measured ? "from the session start and end times" : "Sessions need start and end times"} ring={{ percent: null, pending: true }} audience="admin" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-4">
          <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Monitors</h2>
              <span className="flex items-center gap-2">
                <Link href={`/admin/events/${eventId}/control`} className="rounded-md border border-[var(--border-subtle)] px-3 py-1 text-xs hover:bg-slate-50">Live control center</Link>
                <Link href={"/events/" + slug + "/talk-show"} target="_blank" className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-3 py-1 text-xs hover:bg-slate-50">
                  Open Talk Show <ExternalLink className="h-3 w-3" />
                </Link>
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
              <div className="relative flex aspect-video flex-col justify-end overflow-hidden rounded-lg border-2 border-rose-500 bg-[#0a0f1b] p-3 text-white">
                <span className="absolute left-2 top-2 rounded bg-rose-500 px-2 py-0.5 text-[10.5px] font-extrabold tracking-wider">PROGRAM</span>
                {programSession ? (
                  <>
                    <b className="text-base">{programSession.title}</b>
                    <span className="text-xs text-slate-300">On air now · {guestCounts[programSession.id]?.onstage ?? 0} on stage</span>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-sm text-slate-400">
                    <b className="text-base text-slate-200">Not live</b>Press Go live
                  </div>
                )}
              </div>
              <div className="relative flex aspect-video flex-col justify-end overflow-hidden rounded-lg border-2 border-emerald-600 bg-[#0a0f1b] p-3 text-white">
                <span className="absolute left-2 top-2 rounded bg-emerald-600 px-2 py-0.5 text-[10.5px] font-extrabold tracking-wider">PREVIEW</span>
                {upNext ? (
                  <>
                    <b className="text-sm">{upNext.title}</b>
                    <span className="text-xs text-slate-300">Next segment · {fmt(upNext.startsAt, timezone)}</span>
                  </>
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">No segment waiting</span>
                )}
              </div>
            </div>

            {canEdit ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!programSession ? (
                  <>
                    <input value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} placeholder="Live link (optional)" aria-label="Live link" className="w-56 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
                    <button type="button" disabled={busy || !upNext} onClick={goLive} className="rounded-md bg-rose-500 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-50">
                      {busy ? "Starting…" : "Go live"}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" disabled={busy || !upNext} onClick={nextSegment} title={upNext ? undefined : "No segment waiting"} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                      {busy ? "Working…" : "Next segment"}
                    </button>
                    <button type="button" disabled={busy} onClick={endShow} className="rounded-md border border-rose-300 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                      End show
                    </button>
                  </>
                )}
              </div>
            ) : null}
            {error ? <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
            <p className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-[#27406f]">
              The host and guests join by link. The studio starts and ends the segments and the public Talk Show follows. iCFO does not record or edit anything.
            </p>
          </section>

          <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Host and guests</h2>
              <span className="text-xs text-[var(--text-muted)]">{featured ? `Backstage and on stage, linked to platform users · ${featured.title}` : "Add a talk show session to invite guests"}</span>
            </div>
            {featured && canEdit ? <GuestRoster key={featured.id} sessionId={featured.id} eventId={eventId} /> : null}
            {!featured ? <p className="text-sm text-[var(--text-muted)]">No talk show session yet. Add one on the event page with the type Talk show.</p> : null}
          </section>
        </div>

        <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Rundown</h2>
            <Link href={`/admin/events/${eventId}`} className="text-xs text-[#1A6CE4] hover:underline">Edit sessions</Link>
          </div>
          <ol className="mt-3 space-y-2">
            {ordered.map((s, i) => {
              const live = s.status === "live";
              const next = upNext?.id === s.id;
              const mins = minutesBetween(s.startsAt, s.endsAt);
              return (
                <li key={s.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${live ? "border-rose-400 bg-rose-50" : next ? "border-emerald-500 bg-emerald-50" : "border-[var(--border-subtle)]"} ${s.status === "ended" ? "opacity-50" : ""}`}>
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm text-[var(--text-primary)]">{s.title}</b>
                    <small className="block truncate text-xs text-[var(--text-muted)]">{fmt(s.startsAt, timezone)}</small>
                  </span>
                  <span className="text-right text-xs text-[var(--text-muted)]">
                    {mins != null ? formatClock(mins * 60) : "No length"}
                    <br />
                    <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-bold ${live ? "bg-rose-500 text-white" : next ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                      {live ? "On air" : next ? "Next" : s.status === "ended" ? "Ended" : "Queued"}
                    </span>
                  </span>
                </li>
              );
            })}
            {ordered.length === 0 ? <li className="text-sm text-[var(--text-muted)]">No Talk Show sessions yet.</li> : null}
          </ol>
          <p className="mt-3 text-xs text-[var(--text-muted)]">Order and times come from the session start times on the event page.</p>
        </section>
      </div>
    </div>
  );
}
