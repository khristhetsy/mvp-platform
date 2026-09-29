/**
 * Picking a time for an introduction.
 *
 * The founder chooses, inside the event's own window, from slots they have not
 * already given to somebody else. All pure: the rules that decide whether a
 * time is allowed have to be testable without a database, because the failure
 * mode — promising 1:30 to three investors — is invisible until the day.
 */

export const SLOT_MINUTES = 30;

export type Slot = {
  /** ISO, the moment it starts. */
  startsAt: string;
  endsAt: string;
  /** Already given to another introduction. */
  taken: boolean;
};

const ms = (minutes: number) => minutes * 60_000;

/**
 * Every slot inside the event window.
 *
 * Slots start on the event's own start time rather than on the clock, so an
 * event beginning at 12:15 offers 12:15 and 12:45, not 12:30 and 1:00. A
 * trailing part-slot is dropped: half a meeting inside the window is not a
 * slot, it is an overrun.
 */
export function slotsFor(input: {
  startsAt: string | null;
  endsAt: string | null;
  /** Slots already scheduled for this founder, as ISO start times. */
  taken?: string[];
  minutes?: number;
  /** Slots that have already begun are not offered. */
  now?: Date;
}): Slot[] {
  const { startsAt, endsAt } = input;
  if (!startsAt || !endsAt) return [];

  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return [];

  const length = ms(input.minutes ?? SLOT_MINUTES);
  const nowMs = input.now ? input.now.getTime() : null;
  const takenSet = new Set((input.taken ?? []).map((t) => new Date(t).getTime()));

  const out: Slot[] = [];
  for (let t = start; t + length <= end; t += length) {
    if (nowMs !== null && t < nowMs) continue;
    out.push({
      startsAt: new Date(t).toISOString(),
      endsAt: new Date(t + length).toISOString(),
      taken: takenSet.has(t),
    });
  }
  return out;
}

export type SlotCheck = { ok: true } | { ok: false; reason: string };

/**
 * Whether this founder may take this slot.
 *
 * Every rejection names itself: the picker is generated from the same window,
 * so a refusal here means something moved between rendering and confirming —
 * usually another investor taking the slot first.
 */
export function checkSlot(input: {
  chosen: string;
  startsAt: string | null;
  endsAt: string | null;
  taken?: string[];
  minutes?: number;
  now?: Date;
}): SlotCheck {
  const chosen = new Date(input.chosen).getTime();
  if (Number.isNaN(chosen)) return { ok: false, reason: "That is not a time." };

  const slots = slotsFor(input);
  if (!slots.length) return { ok: false, reason: "This event has no times left to meet in." };

  const match = slots.find((s) => new Date(s.startsAt).getTime() === chosen);
  if (!match) return { ok: false, reason: "That time is outside the event." };
  if (match.taken) return { ok: false, reason: "You have already given that slot to someone else." };
  return { ok: true };
}

const LINK = /^https:\/\/[\w.-]+\.[a-z]{2,}(\/\S*)?$/i;

/**
 * The meeting link the founder brings.
 *
 * Any provider — Meet, Zoom, Teams — because requiring Google would exclude
 * every founder who never connected an account, and a link we cannot check is
 * still better than no meeting. Only the shape is enforced: https, a real
 * host, no spaces.
 */
export function checkMeetingUrl(raw: string): { ok: true; url: string } | { ok: false; reason: string } {
  const url = raw.trim();
  if (!url) return { ok: false, reason: "Add the link people should join." };
  if (!LINK.test(url)) return { ok: false, reason: "That does not look like a link. It should start with https://" };
  if (url.length > 500) return { ok: false, reason: "That link is too long." };
  return { ok: true, url };
}

/** Is this link a Google Meet? Only used to word the button. */
export function isGoogleMeet(url: string): boolean {
  return /^https:\/\/meet\.google\.com\//i.test(url.trim());
}
