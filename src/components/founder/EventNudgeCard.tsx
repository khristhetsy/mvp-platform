"use client";

import Link from "next/link";
import { CalendarDays, X } from "lucide-react";
import { useEventNudge } from "@/components/founder/useEventNudge";

/**
 * Founder Home: a card pointing to the next upcoming event the founder has not
 * registered for. Renders nothing when there is no such event, when the founder
 * dismissed it, or when an admin turned the Home nudge off.
 */
export function EventNudgeCard() {
  const { nudge, dismiss } = useEventNudge("home");
  if (!nudge) return null;

  return (
    <section
      aria-label="Upcoming event"
      className="relative mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white sm:flex"
    >
      <div className="relative h-32 shrink-0 sm:h-auto sm:w-56" style={{ background: "#0A1A40" }}>
        {nudge.coverUrl ? (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ backgroundImage: `url(${nudge.coverUrl})`, backgroundSize: "cover", backgroundPosition: nudge.coverFocal ?? "center" }}
          />
        ) : null}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "#0A1A40", opacity: nudge.coverUrl ? (nudge.coverOverlay ?? 40) / 100 : 1 }}
        />
        <p className="absolute bottom-3 left-3 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#0A1A40]">
          Starts in {nudge.timeLeft}
        </p>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 pr-14 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1A6CE4]">Upcoming event</p>
          <p className="mt-1 text-base font-semibold leading-snug text-[#0A1A40]">{nudge.title}</p>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {nudge.dateLabel}
              {nudge.formatLabel ? ` · ${nudge.formatLabel}` : ""}
            </span>
          </p>
        </div>
        <Link
          href={`/events/${nudge.slug}`}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg bg-[#1A6CE4] px-4 text-sm font-semibold text-white hover:bg-[#2E78F5]"
        >
          View event page
        </Link>
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label={`Dismiss the reminder for ${nudge.title}`}
        className="absolute right-1 top-1 inline-flex h-11 w-11 items-center justify-center rounded-lg text-white hover:bg-white/15 sm:text-slate-500 sm:hover:bg-slate-100"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
    </section>
  );
}
