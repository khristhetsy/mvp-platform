"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useEventPresence } from "@/components/events/EventPresenceProvider";
import { venueZones, PRESENCE_ROOMS } from "@/lib/icfo-events/venue";
import type { EventSession } from "@/lib/icfo-events/types";
import type { ControlSummary, ControlAuditEntry } from "@/lib/icfo-events/control-center";
import type { HelpRequest } from "@/lib/icfo-events/help-desk";
import type { PollResults } from "@/lib/icfo-events/polls";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  allowedRooms,
  initialHelp,
}: {
  eventId: string;
  slug: string;
  initialSessions: EventSession[];
  summary: ControlSummary;
  /** null = all rooms (super-admin); array = scoped room moderator. */
  allowedRooms?: string[] | null;
  initialHelp: HelpRequest[];
}) {
  const t = useTranslations("eventsAdmin.control");
  const { total, byRoom, members, me, sendAnnounce, sendModeration } = useEventPresence();
  const [sessions, setSessions] = useState<EventSession[]>(initialSessions);
  const [audit, setAudit] = useState<ControlAuditEntry[]>(summary.audit);
  const [help, setHelp] = useState<HelpRequest[]>(initialHelp);
  const [bTitle, setBTitle] = useState("");
  const [bBody, setBBody] = useState("");
  const [bRoom, setBRoom] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dropRoom, setDropRoom] = useState<string>("");
  const [dropAmount, setDropAmount] = useState("50");
  const [poll, setPoll] = useState<PollResults | null>(null);
  const [pQ, setPQ] = useState("");
  const [pOpts, setPOpts] = useState("");

  const scoped = Array.isArray(allowedRooms);
  const rooms: string[] = scoped ? (allowedRooms as string[]) : [...PRESENCE_ROOMS];

  const zones = useMemo(() => venueZones(slug), [slug]);
  const hrefForRoom = (room: string) => zones.find((z) => z.room === room)?.href ?? `/events/${slug}/lobby`;

  useEffect(() => {
    let active = true;
    fetch(`/api/events/${slug}/polls`)
      .then((r) => r.json())
      .then((j) => { if (active) setPoll(j.poll ? (j as PollResults) : null); })
      .catch(() => {});
    return () => { active = false; };
  }, [slug]);

  async function resolveHelp(id: string) {
    setHelp((prev) => prev.filter((h) => h.id !== id));
    void fetch(`/api/admin/events/${eventId}/help/${id}`, { method: "POST" }).catch(() => {});
    flash(t("markedResolved"));
  }

  function dropPoints() {
    const amount = Math.max(1, Math.min(500, Number(dropAmount) || 0));
    const room = dropRoom || rooms[0];
    const profileIds = members.filter((m) => m.room === room && UUID_RE.test(m.id)).map((m) => m.id);
    if (profileIds.length === 0) { flash(t("noEligible", { room })); return; }
    void fetch(`/api/admin/events/${eventId}/engagement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "award", profileIds, points: amount }),
    }).catch(() => {});
    addAudit("drop_points", `+${amount} to ${profileIds.length} in ${room}`);
    flash(t("droppedToast", { amount, count: profileIds.length, room }));
  }

  function toggleMute(m: { id: string; name: string }, mute: boolean) {
    sendModeration({ targetId: m.id, action: mute ? "mute" : "unmute" });
    void fetch(`/api/admin/events/${eventId}/engagement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "mute", profileId: m.id, mute }),
    }).catch(() => {});
    addAudit(mute ? "mute_attendee" : "unmute_attendee", m.name);
    flash(mute ? t("mutedToast", { name: m.name }) : t("unmutedToast", { name: m.name }));
  }

  function banAttendee(m: { id: string; name: string }) {
    if (!window.confirm(t("banConfirm", { name: m.name }))) return;
    sendModeration({ targetId: m.id, action: "remove" });
    void fetch(`/api/admin/events/${eventId}/engagement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "ban", profileId: m.id, ban: true, permanent: false }),
    }).catch(() => {});
    addAudit("ban_attendee", m.name);
    flash(t("bannedToast", { name: m.name }));
  }

  async function launchPoll() {
    const options = pOpts.split("\n").map((o) => o.trim()).filter(Boolean).slice(0, 5);
    if (!pQ.trim() || options.length < 2) { flash(t("pollNeed")); return; }
    const res = await fetch(`/api/admin/events/${eventId}/polls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: pQ.trim(), options }),
    });
    if (res.ok) {
      const j = await res.json();
      setPoll({ poll: j.poll, counts: options.map(() => 0), total: 0, myVote: null });
      addAudit("open_poll", pQ.trim());
      setPQ(""); setPOpts(""); flash(t("pollLaunched"));
    } else flash(t("pollFail"));
  }

  async function endPoll() {
    if (!poll?.poll) return;
    await fetch(`/api/admin/events/${eventId}/polls`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pollId: poll.poll.id }),
    }).catch(() => {});
    addAudit("close_poll", poll.poll.question);
    setPoll(null); flash(t("pollClosed"));
  }

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2200);
  }

  function addAudit(action: string, target: string) {
    setAudit((a) => [{ id: Math.random().toString(36).slice(2), action, target, actorName: me.name || "You", createdAt: new Date().toISOString() }, ...a].slice(0, 20));
  }

  async function sessionLifecycle(s: EventSession, go: boolean) {
    let liveUrl: string | null = null;
    if (go) {
      liveUrl = window.prompt(t("livePrompt"), "");
      if (liveUrl === null) return; // cancelled
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/events/sessions/${s.id}/go-live`, {
        method: go ? "POST" : "DELETE",
        headers: go ? { "Content-Type": "application/json" } : undefined,
        body: go ? JSON.stringify(liveUrl && liveUrl.trim() ? { liveUrl: liveUrl.trim() } : {}) : undefined,
      });
      if (res.ok) {
        setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...x, status: go ? "live" : "ended" } : x)));
        flash(go ? t("startedToast", { title: s.title }) : t("endedToast", { title: s.title }));
        if (go) {
          sendAnnounce({ title: t("announceTitle", { title: s.title }), body: t("announceBody"), room: "Main Stage", href: hrefForRoom("Main Stage") });
        }
      } else {
        flash(t("sessionUpdateFail"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function broadcast() {
    if (!bTitle.trim() || !bBody.trim()) return;
    const room = bRoom || (scoped ? rooms[0] : undefined);
    sendAnnounce({ title: bTitle.trim(), body: bBody.trim(), room, href: room ? hrefForRoom(room) : undefined });
    void fetch(`/api/admin/events/${eventId}/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: bTitle.trim(), body: bBody.trim(), room }),
    }).catch(() => {});
    addAudit("broadcast", room ?? "Everyone");
    flash(t("broadcastSent", { room: room ?? t("everyoneLower") }));
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
    flash(t("movedToast", { name: m.name, room }));
  }

  function removeAttendee(m: { id: string; name: string }) {
    if (!window.confirm(t("removeConfirm", { name: m.name }))) return;
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
        <Stat label={t("stat.inVenue")} value={total} accent="#0F6E56" />
        <Stat label={t("stat.registered")} value={summary.registered} />
        <Stat label={t("stat.inSessions")} value={byRoom["Main Stage"] ?? 0} />
        <Stat label={t("stat.connections")} value={summary.connections} />
      </div>

      <section className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-white p-4">
        <h2 className="text-sm font-semibold text-[var(--navy)]">{t("runOfShow")}</h2>
        <div className="mt-3 space-y-2">
          {sessions.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">{t("noSessions")}</p>
          ) : (
            sessions.map((s) => {
              const live = s.status === "live";
              const ended = s.status === "ended";
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[var(--navy)]">{s.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">{t(`status.${s.status}`)}</p>
                  </div>
                  {ended ? (
                    <span className="text-xs text-[var(--text-muted)]">{t("ended")}</span>
                  ) : live ? (
                    <button onClick={() => sessionLifecycle(s, false)} disabled={busy} className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 disabled:opacity-50">{t("endSession")}</button>
                  ) : (
                    <button onClick={() => sessionLifecycle(s, true)} disabled={busy} className="rounded-md bg-[var(--blue)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{t("start")}</button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-white p-4">
        <h2 className="text-sm font-semibold text-[var(--navy)]">{t("broadcast")}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input value={bTitle} onChange={(e) => setBTitle(e.target.value)} placeholder={t("titlePh")} maxLength={160} className="flex-1 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
          <select value={bRoom} onChange={(e) => setBRoom(e.target.value)} className="rounded-md border border-[var(--border-subtle)] px-2 py-2 text-sm">
            {!scoped && <option value="">{t("everyone")}</option>}
            {rooms.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <textarea value={bBody} onChange={(e) => setBBody(e.target.value)} rows={2} maxLength={400} placeholder={t("messagePh")} className="mt-2 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-muted)]">{t("eduOnly")}</span>
          <button onClick={broadcast} disabled={!bTitle.trim() || !bBody.trim()} className="cap-btn-primary rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50">{t("send")}</button>
        </div>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
          <h2 className="text-sm font-semibold text-[var(--navy)]">{t("dropPoints")}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select value={dropRoom} onChange={(e) => setDropRoom(e.target.value)} className="rounded-md border border-[var(--border-subtle)] px-2 py-2 text-sm">
              {rooms.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input type="number" min={1} max={500} value={dropAmount} onChange={(e) => setDropAmount(e.target.value)} className="w-20 rounded-md border border-[var(--border-subtle)] px-2 py-2 text-sm" />
            <button onClick={dropPoints} className="cap-btn-primary rounded-md px-3 py-2 text-sm font-medium">{t("drop")}</button>
          </div>
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">{t("dropHint")}</p>
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
          <h2 className="text-sm font-semibold text-[var(--navy)]">{t("livePoll")}</h2>
          {poll?.poll ? (
            <div className="mt-3">
              <p className="text-sm font-medium text-[var(--navy)]">{poll.poll.question}</p>
              <div className="mt-2 space-y-1.5">
                {poll.poll.options.map((o, i) => {
                  const c = poll.counts[i] ?? 0;
                  const pct = poll.total ? Math.round((c / poll.total) * 100) : 0;
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs"><span>{o}</span><span className="text-[var(--text-muted)]">{c} · {pct}%</span></div>
                      <div className="mt-0.5 h-1.5 rounded-full bg-[var(--surface-sunken)]"><div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: "#1D9E75" }} /></div>
                    </div>
                  );
                })}
              </div>
              <button onClick={endPoll} className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">{t("closePoll")}</button>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <input value={pQ} onChange={(e) => setPQ(e.target.value)} placeholder={t("pollQuestionPh")} maxLength={200} className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
              <textarea value={pOpts} onChange={(e) => setPOpts(e.target.value)} rows={3} placeholder={t("pollOptionsPh")} className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
              <button onClick={launchPoll} className="cap-btn-primary rounded-md px-3 py-2 text-sm font-medium">{t("launchPoll")}</button>
            </div>
          )}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-white p-4">
        <h2 className="text-sm font-semibold text-[var(--navy)]">{t("helpDesk", { n: help.length })}</h2>
        <div className="mt-3 space-y-2">
          {help.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">{t("noHelp")}</p>
          ) : (
            help.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-[var(--navy)]">“{h.message}”</p>
                  <p className="text-xs text-[var(--text-muted)]">{h.requesterName} · {new Date(h.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <button onClick={() => resolveHelp(h.id)} className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100">{t("resolve")}</button>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
          <h2 className="text-sm font-semibold text-[var(--navy)]">{t("attendees", { n: others.length })}</h2>
          <div className="mt-3 space-y-2">
            {others.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">{t("noOthers")}</p>
            ) : (
              others.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[var(--navy)]">{m.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{m.room}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select defaultValue={rooms.includes(m.room) ? m.room : rooms[0]} onChange={(e) => moveAttendee(m, e.target.value)} aria-label={t("moveAttendee")} className="rounded-md border border-[var(--border-subtle)] px-1.5 py-1 text-xs">
                      {rooms.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button onClick={() => toggleMute(m, true)} aria-label={t("muteAria", { name: m.name })} className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-slate-50">{t("mute")}</button>
                    <button onClick={() => removeAttendee(m)} aria-label={t("removeAria", { name: m.name })} className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">{t("remove")}</button>
                    <button onClick={() => banAttendee(m)} aria-label={t("banAria", { name: m.name })} className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100">{t("ban")}</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
          <h2 className="text-sm font-semibold text-[var(--navy)]">{t("auditLog")}</h2>
          <div className="mt-3 space-y-1.5">
            {audit.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">{t("noActions")}</p>
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
