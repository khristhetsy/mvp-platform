"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, Video, Check } from "lucide-react";
import type { TimeInterval } from "@/lib/scheduling/types";

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const HORIZON_DAYS = 14;

export function BookingClient({ hostId, hostName }: { hostId: string; hostName: string }) {
  const [slots, setSlots] = useState<TimeInterval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ when: string; meetUrl: string | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = new Date().toISOString();
      const to = new Date(Date.now() + HORIZON_DAYS * 86400000).toISOString();
      const res = await fetch(`/api/scheduling/slots?host=${hostId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load slots.");
      setSlots(data.slots ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [hostId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const byDay = useMemo(() => {
    const map = new Map<string, TimeInterval[]>();
    for (const s of slots) {
      const key = new Date(s.start).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [slots]);

  const book = useCallback(async (slot: TimeInterval) => {
    setBooking(slot.start);
    setError(null);
    try {
      const res = await fetch("/api/scheduling/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId, startTime: slot.start, endTime: slot.end, timezone: LOCAL_TZ }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Booking failed.");
      setConfirmed({
        when: new Date(slot.start).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }),
        meetUrl: data.meetUrl ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed.");
      await load();
    } finally {
      setBooking(null);
    }
  }, [hostId, load]);

  if (confirmed) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Check className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-emerald-900">You&apos;re booked with {hostName}</h2>
        <p className="mt-1 text-sm text-emerald-800">{confirmed.when}</p>
        {confirmed.meetUrl ? (
          <a href={confirmed.meetUrl} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
            <Video className="h-4 w-4" /> Join Google Meet
          </a>
        ) : null}
        <p className="mt-3 text-xs text-emerald-700">A confirmation and calendar invite are on their way.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-950">
          <Calendar className="h-5 w-5 text-[var(--gold)]" aria-hidden /> Book a meeting with {hostName}
        </h1>
        <p className="mt-1 text-sm text-slate-600">Pick an open time. Slots shown in your timezone ({LOCAL_TZ}).</p>
      </div>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-slate-500">Finding open times…</p>
      ) : byDay.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No open times in the next {HORIZON_DAYS} days.</p>
      ) : (
        <div className="space-y-3">
          {byDay.map(([day, daySlots]) => (
            <div key={day} className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-[var(--shadow-panel)]">
              <p className="mb-2 text-sm font-semibold text-slate-800">{day}</p>
              <div className="flex flex-wrap gap-2">
                {daySlots.map((s) => (
                  <button
                    key={s.start}
                    type="button"
                    disabled={booking !== null}
                    onClick={() => void book(s)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-[var(--blue)] hover:bg-[#E6F1FB] disabled:opacity-50"
                  >
                    {booking === s.start ? "Booking…" : new Date(s.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
