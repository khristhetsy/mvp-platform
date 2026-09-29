/**
 * The status an event should be treated as right now.
 *
 * A published or live event whose end date has passed counts as ended, even
 * when nobody pressed End event, so the public page, registration, and the
 * admin list agree. End = endsAt, falling back to startsAt. Drafts and archived
 * events are never promoted: an ended event is publicly readable, so a draft
 * that was never published must not become visible by its date passing.
 *
 * Pure, so the rule is testable without a database.
 */

import type { EventStatus } from "./types";

type Lifecycle = { status: EventStatus; startsAt: string | null; endsAt: string | null };

function endMs(ev: Pick<Lifecycle, "startsAt" | "endsAt">): number | null {
  const end = ev.endsAt ?? ev.startsAt;
  if (!end) return null;
  const t = new Date(end).getTime();
  return Number.isNaN(t) ? null : t;
}

export function effectiveStatus(ev: Lifecycle, now: number = Date.now()): EventStatus {
  if (ev.status === "published" || ev.status === "live") {
    const t = endMs(ev);
    if (t !== null && t < now) return "ended";
  }
  return ev.status;
}

/** A draft whose date has already passed without it ever being published. */
export function isPastDraft(ev: Lifecycle, now: number = Date.now()): boolean {
  if (ev.status !== "draft") return false;
  const t = endMs(ev);
  return t !== null && t < now;
}
