/**
 * Reusing a presenter from a past event.
 *
 * There is no person record behind the roster: `event_presenters` holds one row
 * per person *per event*, and nothing links the two. So "people who have
 * presented before" has to be reconstructed by collapsing past rows, and the
 * collapse key is the whole trick — get it wrong and the same person appears
 * twice, or two people merge into one.
 *
 * Pure on purpose: the keying and the carry-over rules are where this can
 * silently do the wrong thing, so they are testable without a database.
 */

import type { EventPresenter } from "@/lib/icfo-events/types";

/**
 * What identifies a person across events, best evidence first.
 *
 * `profile_id` is an actual account, so it wins. Email is next — normalised,
 * because the same person typed into two events is rarely typed identically.
 * Name is the last resort and the one that can be wrong in both directions:
 * two "John Smith"s merge, and "Bob Wood" / "Robert Wood" stay apart. Nothing
 * in the data can settle that, so the picker shows the email and lets a human
 * see it rather than guessing harder here.
 */
export function personKey(p: Pick<EventPresenter, "profileId" | "email" | "displayName">): string {
  if (p.profileId) return `profile:${p.profileId}`;
  const email = p.email?.trim().toLowerCase();
  if (email) return `email:${email}`;
  return `name:${p.displayName.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

export type ReuseCandidate = {
  /** The row this person's details would be copied from — their most recent. */
  source: EventPresenter;
  key: string;
  /** How many past events this person has appeared at. */
  appearances: number;
  /** Already on the target event's roster — listed, but not selectable. */
  onTarget: boolean;
};

/** Newest first, using created_at when present and falling back to the slot time. */
function recencyOf(p: EventPresenter): number {
  const stamp = p.createdAt ?? p.startsAt;
  const t = stamp ? Date.parse(stamp) : Number.NaN;
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Everyone who has presented before, one entry per person, ready to copy onto
 * `targetEventId`.
 *
 * Rows already on the target are what makes someone `onTarget` — they stay in
 * the list so it's clear they were considered, rather than quietly missing.
 */
export function reuseCandidates(all: EventPresenter[], targetEventId: string): ReuseCandidate[] {
  const byKey = new Map<string, { rows: EventPresenter[]; onTarget: boolean }>();

  for (const p of all) {
    const key = personKey(p);
    const entry = byKey.get(key) ?? { rows: [], onTarget: false };
    if (p.eventId === targetEventId) {
      entry.onTarget = true;
    } else {
      entry.rows.push(p);
    }
    byKey.set(key, entry);
  }

  const out: ReuseCandidate[] = [];
  for (const [key, entry] of byKey) {
    // Someone whose only appearance is the target event has nothing to copy.
    if (entry.rows.length === 0) continue;
    const sorted = [...entry.rows].sort((a, b) => recencyOf(b) - recencyOf(a));
    out.push({
      source: sorted[0],
      key,
      appearances: new Set(entry.rows.map((r) => r.eventId)).size,
      onTarget: entry.onTarget,
    });
  }

  // Selectable people first, then most recently seen.
  return out.sort((a, b) => {
    if (a.onTarget !== b.onTarget) return a.onTarget ? 1 : -1;
    return recencyOf(b.source) - recencyOf(a.source);
  });
}

export type ReuseFilter = { q?: string; fromEventId?: string; role?: string };

/** Search across every column the picker shows — name, email, company, topic. */
export function filterCandidates(list: ReuseCandidate[], f: ReuseFilter): ReuseCandidate[] {
  const q = f.q?.trim().toLowerCase();
  return list.filter((c) => {
    const p = c.source;
    if (f.fromEventId && p.eventId !== f.fromEventId) return false;
    if (f.role && (p.roleLabel ?? "") !== f.role) return false;
    if (!q) return true;
    const hay = [p.displayName, p.email, p.headline, p.companySummary, p.eventTitle]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export type CarryOptions = {
  /** Their standing description — the same at any event. On by default. */
  keepBio: boolean;
  /** The talk they gave last time. Off by default: it belongs to that talk. */
  keepHeadline: boolean;
};

export type PresenterCopy = {
  profileId: string | null;
  displayName: string;
  roleLabel: string | null;
  email: string | null;
  links: string[];
  headshotPath: string | null;
  bio: string | null;
  companySummary: string | null;
  headline: string | null;
};

/**
 * The fields that travel to a new event.
 *
 * Everything left out is left out deliberately: `sessionId`, `startsAt`,
 * `timezone` and `meetingUrl` describe a slot at the old event (a copied Meet
 * link would be a dead room in the new booklet), `applicationId` records why
 * the old row exists, and the invitation materials — video URL, deck — are
 * collected again per event.
 */
export function copyFrom(p: EventPresenter, opts: CarryOptions): PresenterCopy {
  return {
    profileId: p.profileId,
    displayName: p.displayName,
    roleLabel: p.roleLabel,
    email: p.email,
    links: p.links ?? [],
    headshotPath: p.headshotPath,
    bio: opts.keepBio ? p.bio : null,
    companySummary: opts.keepBio ? p.companySummary : null,
    headline: opts.keepHeadline ? p.headline : null,
  };
}
