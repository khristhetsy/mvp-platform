"use client";

import Link from "next/link";
import { useEventPresence } from "@/components/events/EventPresenceProvider";

/** Attendee-facing popup that appears when an admin broadcasts a live
 *  announcement (e.g. "the keynote has started — join the auditorium"). */
export function LiveAnnouncementPopup() {
  const { announcement, dismissAnnouncement } = useEventPresence();
  if (!announcement) return null;

  return (
    <div
      role="dialog"
      aria-label="Live announcement"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(4,12,28,.55)" }}
      onClick={dismissAnnouncement}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium"
          style={{ background: "#FCEBEB", color: "#A32D2D" }}
        >
          <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "#E24B4A" }} aria-hidden />
          LIVE NOW{announcement.room ? ` · ${announcement.room.toUpperCase()}` : ""}
        </span>
        <p className="mt-3.5 text-lg font-medium" style={{ color: "#0c2340" }}>{announcement.title}</p>
        <p className="mt-1 text-sm" style={{ color: "#5b6470" }}>{announcement.body}</p>
        <div className="mt-4 flex flex-col gap-2">
          {announcement.href && (
            <Link
              href={announcement.href}
              onClick={dismissAnnouncement}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white"
              style={{ background: "#1D9E75" }}
            >
              Join now ↗
            </Link>
          )}
          <button
            onClick={dismissAnnouncement}
            className="w-full rounded-lg border px-4 py-2 text-sm"
            style={{ borderColor: "#d8dce1", color: "#5b6470" }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
