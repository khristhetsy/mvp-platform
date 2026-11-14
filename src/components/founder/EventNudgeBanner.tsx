"use client";

import Link from "next/link";
import { CalendarDays, X } from "lucide-react";
import { useEventNudge } from "@/components/founder/useEventNudge";

/**
 * Raise, Present at event: one line at the top of the page pointing to the next
 * upcoming event the founder has not registered for. Renders nothing when there
 * is none, when it was dismissed, or when an admin turned the banner off.
 */
export function EventNudgeBanner() {
  const { nudge, dismiss } = useEventNudge("banner");
  if (!nudge) return null;

  return (
    <div
      role="region"
      aria-label="Upcoming event"
      className="mb-4 flex items-center gap-2 rounded-xl border border-[#BFD4F6] bg-[#F2F7FF] py-1 pl-3 pr-1"
    >
      <CalendarDays className="h-4 w-4 shrink-0 text-[#1A6CE4]" aria-hidden />
      <p className="min-w-0 flex-1 truncate text-sm text-[#0A1A40]">
        <span className="font-semibold">{nudge.title}</span> starts in {nudge.timeLeft}
      </p>
      <Link
        href={`/events/${nudge.slug}/register`}
        className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg bg-[#1A6CE4] px-4 text-sm font-semibold text-white hover:bg-[#2E78F5]"
      >
        Register
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label={`Dismiss the reminder for ${nudge.title}`}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}
