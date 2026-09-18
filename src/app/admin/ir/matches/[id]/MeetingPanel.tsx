"use client";

/**
 * Meetings tab on a Share Project record. Booked: a card with the time, host, Meet link,
 * Reschedule / Mark held / Cancel. Not booked: host + duration, a two-week grid of the
 * host's open scheduler slots (their hours minus Google busy), or a custom time agreed
 * outside the scheduler. Booking invites the investor (email read server-side), moves
 * the stage to Meeting scheduled and opens a "Send deck before meeting" to-do.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { IrActivity } from "@/lib/ir/types";

type Slots = { hostId: string; slots: Array<{ start: string; end: string }>; timezone: string; durations: number[]; hasHours: boolean; current: { activity: IrActivity; meetUrl: string | null; hostName: string | null; timezone: string | null } | null };
const inp = "rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] focus:border-indigo-400 focus:outline-none";
const fmtDT = (iso: string, tz?: string) => new Date(iso).toLocaleString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const fmtT = (iso: string, tz?: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
const dayKey = (iso: string, tz?: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" });

export function MeetingPanel({ matchId, meId, assigneeId, staff, onChanged }: { matchId: string; meId: string; assigneeId: string | null; staff: Array<{ id: string; name: string }>; onChanged: () => Promise<void> }) {
  const [host, setHost] = useState(assigneeId ?? meId);
  const [duration, setDuration] = useState<number | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<Slots | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"slots" | "custom">("slots");
  const [custom, setCustom] = useState(""); const [customLen, setCustomLen] = useState(30);
  const [note, setNote] = useState(""); const [notify, setNotify] = useState(true);
  const [reschedule, setReschedule] = useState(false);
  const [picked, setPicked] = useState<{ start: string; end: string } | null>(null);

  const load = useCallback(async () => {
    const from = new Date(Date.now() + weekOffset * 14 * 86_400_000); const to = new Date(from.getTime() + 14 * 86_400_000);
    const q = new URLSearchParams({ host, from: from.toISOString(), to: to.toISOString() }); if (duration) q.set("duration", String(duration));
    const r = await fetch(`/api/admin/ir/matches/${matchId}/meeting?${q}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? "Couldn't load slots."); return; }
    setData(j); setError(null);
  }, [matchId, host, duration, weekOffset]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set
  useEffect(() => { void load(); }, [load]);

  const byDay = useMemo(() => { const m = new Map<string, Array<{ start: string; end: string }>>(); for (const s of data?.slots ?? []) { const k = dayKey(s.start, data?.timezone); m.set(k, [...(m.get(k) ?? []), s]); } return m; }, [data]);
  const tz = data?.timezone;

  async function post(body: Record<string, unknown>) {
    setBusy(true); setError(null); setNotice(null);
    const r = await fetch(`/api/admin/ir/matches/${matchId}/meeting`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(j.error ?? "Couldn't complete that."); return null; }
    return j;
  }
  async function book() {
    let start: string, end: string, isCustom = false;
    if (mode === "custom") { if (!custom) { setError("Pick a date and time."); return; } start = new Date(custom).toISOString(); end = new Date(new Date(custom).getTime() + customLen * 60_000).toISOString(); isCustom = true; }
    else { if (!picked) { setError("Pick an open slot."); return; } start = picked.start; end = picked.end; }
    const j = await post({ action: reschedule ? "reschedule" : "book", hostId: host, startTime: start, endTime: end, timezone: tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone, note: note || null, notify, custom: isCustom });
    if (!j) return;
    setNotice(`${reschedule ? "Rescheduled" : "Booked"} for ${fmtDT(j.startTime, tz)}${j.meetUrl ? " with a Google Meet link" : ""}.${j.warning ? ` ${j.warning}` : ""}`);
    setReschedule(false); setPicked(null); setCustom("");
    await onChanged(); await load();
  }
  async function cancel() {
    if (!window.confirm("Cancel this meeting? The calendar event is removed and the investor is notified.")) return;
    const j = await post({ action: "cancel", notify: true });
    if (!j) return;
    setNotice("Meeting cancelled."); await onChanged(); await load();
  }
  async function held() {
    if (!data?.current) return;
    setBusy(true);
    await fetch(`/api/admin/ir/activities/${data.current.activity.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: true }) });
    await fetch(`/api/admin/ir/matches/${matchId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage: "meeting_held" }) });
    setBusy(false); setNotice("Marked held — stage moved to Meeting held."); await onChanged(); await load();
  }

  if (error && !data) return <p className="text-[12.5px] text-rose-700">{error}</p>;
  if (!data) return <p className="text-[12.5px] text-slate-400">Loading…</p>;
  const cur = data.current;

  return (
    <div className="flex flex-col gap-3">
      {notice ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800">{notice}</p> : null}
      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p> : null}
      {cur && !reschedule ? (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
          <p className="text-[13px] font-semibold text-indigo-900">{cur.activity.subject}</p>
          <p className="text-[12.5px] text-indigo-800">{cur.activity.due_at ? fmtDT(cur.activity.due_at, cur.timezone ?? undefined) : "—"}{cur.hostName ? ` · hosted by ${cur.hostName}` : ""}</p>
          {cur.meetUrl ? <a href={cur.meetUrl} target="_blank" rel="noreferrer" className="text-[12.5px] text-indigo-700 underline">Google Meet link</a> : <p className="text-[12px] text-indigo-700">No Meet link — the host&rsquo;s Google Calendar isn&rsquo;t connected.</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={held} className="rounded-md bg-emerald-600 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-emerald-700 disabled:opacity-60">Mark held</button>
            <button type="button" disabled={busy} onClick={() => { setReschedule(true); setPicked(null); }} className="rounded-md border border-indigo-300 bg-white px-2.5 py-1 text-[12px] text-indigo-800 hover:bg-indigo-100 disabled:opacity-60">Reschedule</button>
            <button type="button" disabled={busy} onClick={cancel} className="rounded-md border border-rose-200 bg-white px-2.5 py-1 text-[12px] text-rose-700 hover:bg-rose-50 disabled:opacity-60">Cancel meeting</button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px] text-slate-600">
            <span className="font-semibold text-slate-900">{reschedule ? "Reschedule" : "Book a meeting"}</span>
            <label className="ml-auto">Host <select value={host} onChange={(e) => { setHost(e.target.value); setPicked(null); }} className={`ml-1 ${inp}`}>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label>Length <select value={duration ?? data.durations[0] ?? 30} onChange={(e) => { setDuration(Number(e.target.value)); setCustomLen(Number(e.target.value)); setPicked(null); }} className={`ml-1 ${inp}`}>{(data.durations.length ? data.durations : [30, 60]).map((d) => <option key={d} value={d}>{d} min</option>)}</select></label>
            <div className="flex rounded-lg bg-slate-100 p-0.5"><button type="button" onClick={() => setMode("slots")} className={`rounded-md px-2 py-0.5 text-[11.5px] ${mode === "slots" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"}`}>Open slots</button><button type="button" onClick={() => setMode("custom")} className={`rounded-md px-2 py-0.5 text-[11.5px] ${mode === "custom" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"}`}>Custom time</button></div>
          </div>
          {mode === "slots" ? (
            <>
              <div className="mb-1 flex items-center justify-between text-[11.5px] text-slate-500"><span>Host&rsquo;s open times · {tz}</span><span className="flex gap-1"><button type="button" disabled={weekOffset === 0} onClick={() => setWeekOffset((w) => w - 1)} className="rounded border border-slate-200 px-1.5 disabled:opacity-40">‹</button><span>{weekOffset === 0 ? "Next 2 weeks" : `Weeks ${weekOffset * 2 + 1}–${weekOffset * 2 + 2}`}</span><button type="button" onClick={() => setWeekOffset((w) => w + 1)} className="rounded border border-slate-200 px-1.5">›</button></span></div>
              {!data.hasHours ? <p className="text-[12px] text-amber-800">This host hasn&rsquo;t set booking hours yet (CEO Hub › Scheduling). Use a custom time, or pick another host.</p> : byDay.size === 0 ? <p className="text-[12px] text-slate-400">No open slots in this range.</p> : (
                <div className="grid max-h-64 gap-2 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
                  {[...byDay].map(([day, slots]) => <div key={day}><p className="mb-1 text-[11.5px] font-semibold text-slate-700">{day}</p><div className="flex flex-wrap gap-1">{slots.map((s) => <button key={s.start} type="button" onClick={() => setPicked(s)} className={`rounded-md border px-2 py-0.5 text-[11.5px] ${picked?.start === s.start ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-200 text-slate-700 hover:border-indigo-300"}`}>{fmtT(s.start, tz)}</button>)}</div></div>)}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-600">
              <label>When <input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} className={`ml-1 ${inp}`} /></label>
              <label>Length <input type="number" min={15} step={15} value={customLen} onChange={(e) => setCustomLen(Number(e.target.value))} className={`ml-1 w-20 ${inp}`} /> min</label>
              <span className="text-[11.5px] text-slate-400">A time agreed outside the scheduler — no hours check, still lands on the host&rsquo;s calendar with a Meet link.</span>
            </div>
          )}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the invite (optional)" className={`mt-2 w-full ${inp}`} />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[12px] text-slate-700"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Email the investor a confirmation with the Meet link</label>
            <span className="ml-auto flex gap-2">
              {reschedule ? <button type="button" onClick={() => setReschedule(false)} className="rounded-md border border-slate-200 px-2.5 py-1 text-[12px] text-slate-600 hover:bg-slate-50">Keep current</button> : null}
              <button type="button" disabled={busy || (mode === "slots" ? !picked : !custom)} onClick={book} className="rounded-md bg-indigo-600 px-3 py-1 text-[12px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? "Booking…" : reschedule ? "Confirm new time" : picked && mode === "slots" ? `Book ${fmtDT(picked.start, tz)}` : "Book"}</button>
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Booking moves the stage to Meeting scheduled, logs the meeting with its calendar event, and opens a &ldquo;Send deck before meeting&rdquo; to-do due the day before.</p>
        </div>
      )}
    </div>
  );
}
