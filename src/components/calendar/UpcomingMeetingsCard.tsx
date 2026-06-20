"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Video } from "lucide-react";
import type { CalendarEventRecord } from "@/lib/scheduling/types";

/**
 * Compact dashboard card showing the next few upcoming meetings (7-day window).
 * Self-contained — fetches its own data from the calendar API.
 */
export function UpcomingMeetingsCard({
  calendarHref = "/founder/calendar",
  scheduleHref = "/founder/schedule",
}: {
  calendarHref?: string;
  scheduleHref?: string;
}) {
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const from = new Date().toISOString();
        const to = new Date(Date.now() + 7 * 86400000).toISOString();
        const res = await fetch(`/api/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (active) setEvents(data.events ?? []);
      } catch {
        // ignore — card just shows empty
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const now = new Date().getTime();
  const upcoming = events
    .filter((e) => new Date(e.end_time).getTime() >= now)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .slice(0, 5);

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          <CalendarClock className="h-4 w-4 text-[var(--gold)]" aria-hidden /> Upcoming meetings
        </h3>
        <Link href={calendarHref} className="text-xs font-medium text-[var(--blue)] hover:underline">
          View calendar
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : upcoming.length === 0 ? (
        <p className="text-sm text-slate-500">
          No meetings in the next 7 days.{" "}
          <Link href={scheduleHref} className="font-medium text-[var(--blue)] hover:underline">
            Share your availability →
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {upcoming.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2">
              <span className="w-24 shrink-0 text-xs text-slate-500">
                {new Date(e.start_time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </span>
              <span className="w-16 shrink-0 text-xs font-medium text-slate-700">
                {new Date(e.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </span>
              <span className="flex-1 truncate text-sm text-slate-900">{e.title}</span>
              {e.meet_url ? (
                <a href={e.meet_url} className="shrink-0 text-[#534AB7] hover:text-[#3C3489]" title="Join Google Meet">
                  <Video className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
