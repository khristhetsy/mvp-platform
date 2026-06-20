"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Video, Check, Globe, ChevronLeft, ChevronRight } from "lucide-react";
import { CapitalOSLogo } from "@/components/CapitalOSLogo";
import type { TimeInterval, ScheduleQuestion } from "@/lib/scheduling/types";

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function monthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}
function initials(name: string): string {
  return name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("") || "?";
}

export function BookingClient({
  hostId,
  hostName,
  meetingTitle,
  questions = [],
  viewerName,
  viewerEmail,
}: {
  hostId: string;
  hostName: string;
  meetingTitle?: string;
  questions?: ScheduleQuestion[];
  viewerName?: string | null;
  viewerEmail?: string | null;
}) {
  const title = meetingTitle?.trim() || `Meeting with ${hostName}`;
  const [firstSeed, lastSeed] = (() => {
    const parts = (viewerName ?? "").trim().split(/\s+/);
    return [parts[0] ?? "", parts.slice(1).join(" ")];
  })();

  const [anchor, setAnchor] = useState(() => new Date());
  const [slots, setSlots] = useState<TimeInterval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pending, setPending] = useState<TimeInterval | null>(null);
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState<{ when: string; meetUrl: string | null } | null>(null);

  const [firstName, setFirstName] = useState(firstSeed);
  const [lastName, setLastName] = useState(lastSeed);
  const [email, setEmail] = useState(viewerEmail ?? "");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  const grid = useMemo(() => monthGrid(anchor), [anchor]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const from = new Date(Math.max(grid[0].getTime(), now.getTime())).toISOString();
      const to = new Date(grid[41].getTime() + 86400000).toISOString();
      const res = await fetch(`/api/scheduling/slots?host=${hostId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to load times.");
      setSlots(data.slots ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [grid, hostId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, TimeInterval[]>();
    for (const s of slots) {
      const key = ymd(new Date(s.start));
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [slots]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (selectedDate && slotsByDay.has(selectedDate)) return;
    const firstDay = grid.find((d) => slotsByDay.has(ymd(d)));
    setSelectedDate(firstDay ? ymd(firstDay) : null);
  }, [slotsByDay, grid, selectedDate]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const durationMin = slots.length > 0 ? Math.round((Date.parse(slots[0].end) - Date.parse(slots[0].start)) / 60000) : 30;
  const daySlots = selectedDate ? slotsByDay.get(selectedDate) ?? [] : [];
  const currentMonth = anchor.getMonth();
  const todayKey = ymd(new Date());
  const monthLabel = anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const toggleMulti = (qid: string, opt: string) =>
    setAnswers((prev) => {
      const cur = Array.isArray(prev[qid]) ? (prev[qid] as string[]) : [];
      return { ...prev, [qid]: cur.includes(opt) ? cur.filter((o) => o !== opt) : [...cur, opt] };
    });

  const book = useCallback(async () => {
    if (!pending) return;
    if (!firstName.trim() || !email.trim()) { setError("Name and email are required."); return; }
    for (const q of questions) {
      if (!q.required) continue;
      const v = answers[q.id];
      const answered = Array.isArray(v) ? v.length > 0 : Boolean((v ?? "").toString().trim());
      if (!answered) { setError(`Please answer: ${q.label}`); return; }
    }
    setBooking(true);
    setError(null);
    try {
      const answerPayload = questions
        .map((q) => {
          const v = answers[q.id];
          const value = Array.isArray(v) ? v.join(", ") : (v ?? "").toString().trim();
          return { label: q.label, value };
        })
        .filter((a) => a.value);
      const res = await fetch("/api/scheduling/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostId,
          startTime: pending.start,
          endTime: pending.end,
          timezone: LOCAL_TZ,
          name: `${firstName} ${lastName}`.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          note: note.trim() || undefined,
          answers: answerPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Booking failed.");
      setConfirmed({
        when: new Date(pending.start).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }),
        meetUrl: data.meetUrl ?? null,
      });
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed.");
      await load();
    } finally {
      setBooking(false);
    }
  }, [hostId, pending, firstName, lastName, email, phone, note, questions, answers, load]);

  if (confirmed) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-6 w-6" /></div>
        <h2 className="text-lg font-semibold text-emerald-900">You&apos;re booked with {hostName}</h2>
        <p className="mt-1 text-sm text-emerald-800">{confirmed.when}</p>
        {confirmed.meetUrl ? (
          <a href={confirmed.meetUrl} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"><Video className="h-4 w-4" /> Join Google Meet</a>
        ) : null}
        <p className="mt-3 text-xs text-emerald-700">A confirmation and calendar invite are on their way.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
      <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
        {/* Meeting info */}
        <div className="border-b border-slate-100 p-5 md:border-b-0 md:border-r">
          <CapitalOSLogo height={24} />
          <div className="mt-5 mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#E6F1FB] text-sm font-semibold text-[#0C447C]">{initials(hostName)}</div>
          <p className="text-xs text-slate-500">{hostName}</p>
          <p className="mb-3 text-lg font-semibold text-slate-950">{title}</p>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-600"><Clock className="h-4 w-4 text-slate-400" /> {durationMin} min</p>
          {pending ? (
            <p className="mb-1.5 text-xs font-medium text-[#185FA5]">{new Date(pending.start).toLocaleString("en-US", { hour: "numeric", minute: "2-digit" })} – {new Date(pending.end).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}, {new Date(pending.start).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
          ) : null}
          <p className="flex items-start gap-1.5 text-xs text-slate-600"><Video className="mt-0.5 h-4 w-4 text-slate-400" /> Google Meet link added on confirmation</p>
        </div>

        {/* Calendar (always visible) + right panel */}
        <div className="p-5">
          {error ? <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p> : null}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            {/* Month picker */}
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-900">Select a date &amp; time</p>
              <div className="mb-2 flex items-center justify-between">
                <button type="button" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
                <span className="text-sm font-medium text-slate-900">{monthLabel}</span>
                <button type="button" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS.map((d) => <div key={d} className="py-1 text-[10px] text-slate-400">{d[0]}</div>)}
                {grid.map((day) => {
                  const key = ymd(day);
                  const has = slotsByDay.has(key);
                  const inMonth = day.getMonth() === currentMonth;
                  const selected = key === selectedDate;
                  return (
                    <button key={key} type="button" disabled={!has} onClick={() => { setSelectedDate(key); setPending(null); }}
                      className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs ${selected ? "bg-[#185FA5] font-semibold text-white" : has ? "bg-[#E6F1FB] font-medium text-[#185FA5] hover:bg-[#B5D4F4]" : key === todayKey ? "text-slate-400 ring-1 ring-slate-200" : inMonth ? "text-slate-300" : "text-slate-200"}`}>
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400"><Globe className="h-3.5 w-3.5" /> {LOCAL_TZ}</p>
            </div>

            {/* Right panel: times, or details + custom questions */}
            <div className="max-h-[440px] overflow-y-auto pr-1">
              {!pending ? (
                <>
                  <p className="mb-2 text-xs font-semibold text-slate-700">{selectedDate ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : ""}</p>
                  {loading ? (
                    <p className="text-xs text-slate-400">Loading…</p>
                  ) : daySlots.length === 0 ? (
                    <p className="text-xs text-slate-400">{slotsByDay.size === 0 ? "No open times this month." : "Pick a highlighted date."}</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {daySlots.map((s) => (
                        <button key={s.start} type="button" onClick={() => { setPending(s); setError(null); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-[#185FA5] hover:border-[var(--blue)] hover:bg-[#E6F1FB]">
                          {new Date(s.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-700">Enter details</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name *" className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
                  </div>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email *" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />

                  {questions.map((q) => (
                    <div key={q.id} className="mt-3 border-t border-slate-100 pt-3">
                      <p className="mb-1.5 text-xs font-medium text-slate-800">{q.label}{q.required ? <span className="text-red-500"> *</span> : null}</p>
                      {q.type === "short_text" ? (
                        <input value={(answers[q.id] as string) ?? ""} onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
                      ) : q.type === "single" ? (
                        <div className="flex flex-col gap-1.5">
                          {q.options.map((opt) => (
                            <label key={opt} className="flex items-center gap-2 text-xs text-slate-700">
                              <input type="radio" name={q.id} checked={answers[q.id] === opt} onChange={() => setAnswers((p) => ({ ...p, [q.id]: opt }))} className="h-3.5 w-3.5" />
                              {opt}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {q.options.map((opt) => (
                            <label key={opt} className="flex items-center gap-2 text-xs text-slate-700">
                              <input type="checkbox" checked={Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(opt)} onChange={() => toggleMulti(q.id, opt)} className="h-3.5 w-3.5 rounded" />
                              {opt}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Anything else? (optional)" className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => void book()} disabled={booking} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{booking ? "Scheduling…" : "Schedule"}</button>
                    <button type="button" onClick={() => { setPending(null); setError(null); }} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Back</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
