"use client";

import { useMemo, useState } from "react";
import { useEventPresence } from "@/components/events/EventPresenceProvider";
import { venueZones, PRESENCE_ROOMS } from "@/lib/icfo-events/venue";
import type { EventSession } from "@/lib/icfo-events/types";
import type { ControlSummary, ControlAuditEntry } from "@/lib/icfo-events/control-center";

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface-sunken)] p-3">
      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 text-xl font-semibold" style={accent ? { color: accent } : undefined}>{value}</p>
    </div>
  );
}

export function EventControlCenter({
  eventId,
  slug,
  initialSessions,
  summary,
}: {
  eventId: string;
  slug: string;
  initialSessions: EventSession[];
  summary: ControlSummary;
}) {
  const { total, byRoom, members, me, sendAnnounce, sendModeration } = useEventPresence();
  const [sessions, setSessions] = useState<EventSession[]>(initialSessions);
  const [audit, setAudit] = useState<ControlAuditEntry[]>(summary.audit);
  const [bTitle, setBTitle] = useState("");
  const [bBody, setBBody] = useState("");
  const [bRoom, setBRoom] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const zones = useMemo(() => venueZones(slug), [slug]);
  const hrefForRoom = (room: string) => zones.find((z) => z.room === room)?.href ?? `/events/${slug}/lobby`;

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2200);
  }

  function addAudit(action: string, target: string) {
    setAudit((a) => [{ id: Math.random().toString(36).slice(2), action, target, actorName: me.name || "You", createdAt: new Date().toISOString() }, ...a].slice(0, 20));
  }

  async function sessionLifecycle(s: EventSession, go: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/events/sessions/${s.id}/go-live`, { method: go ? "POST" : "DELETE" });
      if (res.ok) {
        setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...x, status: go ? "live" : "ended" } : x)));
        flash(go ? `Started “${s.title}”` : `Ended “${s.title}”`);
        if (go) {
          sendAnnounce({ title: `${s.title} is starting`, body: "The session is live now — join the auditorium.", room: "Main Stage", href: hrefForRoom("Main Stage") });
        }
      } else {
        flash("Couldn't update the session.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function broadcast() {
    if (!bTitle.trim() || !bBody.trim()) return;
    const room = bRoom || undefined;
    sendAnnounce({ title: bTitle.trim(), body: bBody.trim(), room, href: room ? hrefForRoom(room) : undefined });
    void fetch(`/api/admin/events/${eventId}/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: bTitle.trim(), body: bBody.trim(), room }),
    }).catch(() => {});
    addAudit("broadcast", room ?? "Everyone");
    flash(`Broadcast sent to ${room ?? "everyone"}`);
    setBTitle("");
    setBBody("");
  }

  function moveAttendee(m: { id: string; name: string }, room: string) {
    sendModeration({ targetId: m.id, action: "move", room, href: hrefForRoom(room) });
    void fetch(`/api/admin/events/${eventId}/moderation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "move_attendee", targetId: m.id, targetName: m.name, room }),
    }).catch(() => {});
    addAudit("move_attendee", `${m.name} → ${room}`);
    flash(`Moved ${m.name} to ${room}`);
  }

  function removeAttendee(m: { id: string; name: string }) {
    if (!window.confirm(`Remove ${m.name} from the event?`)) return;
    sendModeration({ targetId: m.id, action: "remove" });
    void fetch(`/api/admin/events/${eventId}/moderation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove_attendee", targetId: m.id, targetName: m.name }),
    }).catch(() => {});
    addAudit("remove_attendee", m.name);
    flash(`Removed ${m.name}`);
  }

  const others = members.filter((m) => m.id !== me.id);

  return (
    <div className="relative mx-auto max-w-4xl px-4 py-6">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="In venue now" value={total} accent="#0F6E56" />
        <Stat label="Registered" value={summary.registered} />
        <Stat label="In sessions" value={byRoom["Main Stage"] ?? 0} />
        <Stat label="Connections" value={summary.connections} />
      </div>

      <section className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-white p-4">
        <h2 className="text-sm font-semibold text-[var(--navy)]">Run of show</h2>
        <div className="mt-3 space-y-2">
          {sessions.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No sessions scheduled.</p>
          ) : (
            sessions.map((s) => {
              const live = s.status === "live";
              const ended = s.status === "ended";
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[var(--navy)]">{s.title}</p>
                    <p className="text-xs text-[var(--text-muted)] capitalize">{s.status}</p>
                  </div>
                  {ended ? (
                    <span className="text-xs text-[var(--text-muted)]">Ended</span>
                  ) : live ? (
                    <button onClick={() => sessionLifecycle(s, false)} disabled={busy} className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 disabled:opacity-50">End session</button>
                  ) : (
                    <button onClick={() => sessionLifecycle(s, true)} disabled={busy} className="rounded-md bg-[var(--blue)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Start</button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-white p-4">
        <h2 className="text-sm font-semibold text-[var(--navy)]">Broadcast</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input value={bTitle} onChange={(e) => setBTitle(e.target.value)} placeholder="Title" maxLength={160} className="flex-1 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
          <select value={bRoom} onChange={(e) => setBRoom(e.target.value)} className="rounded-md border border-[var(--border-subtle)] px-2 py-2 text-sm">
            <option value="">Everyone</option>
            {PRESENCE_ROOMS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <textarea value={bBody} onChange={(e) => setBBody(e.target.value)} rows={2} maxLength={400} placeholder="Message…" className="mt-2 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-muted)]">Educational only — no solicitation.</span>
          <button onClick={broadcast} disabled={!bTitle.trim() || !bBody.trim()} className="cap-btn-primary rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50">Send</button>
        </div>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
          <h2 className="text-sm font-semibold text-[var(--navy)]">Attendees · {others.length}</h2>
          <div className="mt-3 space-y-2">
            {others.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No one else here yet.</p>
            ) : (
              others.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[var(--navy)]">{m.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{m.room}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select defaultValue={m.room} onChange={(e) => moveAttendee(m, e.target.value)} aria-label="Move attendee" className="rounded-md border border-[var(--border-subtle)] px-1.5 py-1 text-xs">
                      {PRESENCE_ROOMS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button onClick={() => removeAttendee(m)} aria-label={`Remove ${m.name}`} className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">Remove</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
          <h2 className="text-sm font-semibold text-[var(--navy)]">Audit log</h2>
          <div className="mt-3 space-y-1.5">
            {audit.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No actions yet.</p>
            ) : (
              audit.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                  <span className="truncate">{a.actorName} · {a.action.replaceAll("_", " ")} {a.target ? `· ${a.target}` : ""}</span>
                  <span className="shrink-0 text-[var(--text-muted)]">{new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[var(--navy)] px-4 py-2 text-xs text-white shadow-lg">{toast}</div>
      )}
    </div>
  );
}
