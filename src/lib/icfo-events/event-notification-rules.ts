/**
 * Founder event notifications and the event nudge: every decision, with no I/O.
 *
 * Shared by the cron runner, the nudge API, the admin screen and the founder
 * cards, and tested directly. Nothing here imports server code, so client
 * components may import it.
 *
 * Admin sets everything (Admin, Events, Notifications). Founders have no
 * options: each notification reaches them in the bell and by email.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// ── Settings ──────────────────────────────────────────────────────────────

export const EVENT_NOTIFICATION_SETTINGS_KEY = "event_notification_settings";

/** Hours before the start a reminder can go out: 7 days, 1 day, 1 hour. */
export const OFFSET_HOURS = [168, 24, 1] as const;
export type OffsetHours = (typeof OFFSET_HOURS)[number];

export const AUDIENCES = ["all_founders", "registered_only"] as const;
export type EventAudience = (typeof AUDIENCES)[number];

export const NUDGE_START_DAYS = [14, 7, 3] as const;
export type NudgeStartDays = (typeof NUDGE_START_DAYS)[number];

export type EventNotificationSettings = {
  /** Tell founders when an event is published. */
  notifyOnPublish: boolean;
  /** Reminders, in hours before the start. Always sorted largest first. */
  offsetsHours: OffsetHours[];
  audience: EventAudience;
  /** Show the nudge card on founder Home. */
  nudgeHome: boolean;
  /** Show the nudge banner on Raise, Present at event. */
  nudgeBanner: boolean;
  /** The nudge starts this many days before the event. */
  nudgeStartDays: NudgeStartDays;
};

export const DEFAULT_EVENT_NOTIFICATION_SETTINGS: EventNotificationSettings = {
  notifyOnPublish: true,
  offsetsHours: [168, 24],
  audience: "all_founders",
  nudgeHome: true,
  nudgeBanner: true,
  nudgeStartDays: 7,
};

export const OFFSET_LABEL: Record<OffsetHours, string> = {
  168: "7 days before",
  24: "1 day before",
  1: "1 hour before",
};

export const AUDIENCE_LABEL: Record<EventAudience, string> = {
  all_founders: "All founders",
  registered_only: "Registered founders only",
};

/**
 * Fill gaps and drop anything unknown, so a hand edited row can never break a
 * send. Used on every read and before every save.
 */
export function normalizeEventNotificationSettings(raw: unknown): EventNotificationSettings {
  const d = DEFAULT_EVENT_NOTIFICATION_SETTINGS;
  const v = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const bool = (x: unknown, fallback: boolean) => (typeof x === "boolean" ? x : fallback);
  const offsets = Array.isArray(v.offsetsHours)
    ? OFFSET_HOURS.filter((o) => (v.offsetsHours as unknown[]).some((x) => Number(x) === o))
    : [...d.offsetsHours];
  return {
    notifyOnPublish: bool(v.notifyOnPublish, d.notifyOnPublish),
    offsetsHours: offsets,
    audience: (AUDIENCES as readonly unknown[]).includes(v.audience) ? (v.audience as EventAudience) : d.audience,
    nudgeHome: bool(v.nudgeHome, d.nudgeHome),
    nudgeBanner: bool(v.nudgeBanner, d.nudgeBanner),
    nudgeStartDays: (NUDGE_START_DAYS as readonly unknown[]).includes(Number(v.nudgeStartDays))
      ? (Number(v.nudgeStartDays) as NudgeStartDays)
      : d.nudgeStartDays,
  };
}

/**
 * Strict check for what an admin submits. Returns the problems found; an empty
 * list means the input is safe to save after normalizing.
 */
export function validateEventNotificationSettings(raw: unknown): string[] {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return ["Settings must be an object."];
  const v = raw as Record<string, unknown>;
  for (const key of ["notifyOnPublish", "nudgeHome", "nudgeBanner"] as const) {
    if (typeof v[key] !== "boolean") errors.push(`${key} must be true or false.`);
  }
  if (!Array.isArray(v.offsetsHours) || v.offsetsHours.some((x) => !(OFFSET_HOURS as readonly unknown[]).includes(x))) {
    errors.push("offsetsHours may only contain 168, 24 and 1.");
  }
  if (!(AUDIENCES as readonly unknown[]).includes(v.audience)) errors.push("audience must be all_founders or registered_only.");
  if (!(NUDGE_START_DAYS as readonly unknown[]).includes(v.nudgeStartDays)) errors.push("nudgeStartDays must be 3, 7 or 14.");
  return errors;
}

// ── What is due ───────────────────────────────────────────────────────────

export type EventNotificationKind = "published" | "offset_168" | "offset_24" | "offset_1";

export const NOTIFICATION_TYPE = "event_notification";

/** How long after publishing the "new event" notice may still go out. */
export const PUBLISH_WINDOW_HOURS = 72;

/**
 * How long a reminder may run late before it is skipped. A reminder also ends
 * when the next one begins, and always when the event starts.
 */
const OFFSET_GRACE_HOURS: Record<OffsetHours, number> = { 168: 24, 24: 12, 1: 1 };

export type NotifiableEvent = {
  id: string;
  title: string;
  slug: string;
  status: string;
  startsAt: string | null;
  endsAt?: string | null;
  timezone: string | null;
  publishedAt: string | null;
  format?: string | null;
  coverPath?: string | null;
};

/** Published and not yet started. Draft, archived, ended and undated events never notify. */
export function isUpcomingPublished(e: Pick<NotifiableEvent, "status" | "startsAt">, now: number): boolean {
  if (e.status !== "published" && e.status !== "live") return false;
  const start = e.startsAt ? Date.parse(e.startsAt) : NaN;
  return Number.isFinite(start) && start > now;
}

/**
 * The notifications due for one event right now.
 *
 *   published   published_at is set and no older than PUBLISH_WINDOW_HOURS
 *   offset_N    start minus N hours is reached, the event has not started, and
 *               the reminder's window is still open
 *
 * A window that already passed is skipped, never sent late: an event published
 * three days out gets no "7 days" reminder. A reminder whose moment came before
 * the event was published is skipped too when the publish notice is on, since
 * that notice already covers it.
 */
export function dueKinds(
  event: Pick<NotifiableEvent, "status" | "startsAt" | "publishedAt">,
  settings: Pick<EventNotificationSettings, "notifyOnPublish" | "offsetsHours">,
  now: number,
): EventNotificationKind[] {
  if (!isUpcomingPublished(event, now)) return [];
  const start = Date.parse(event.startsAt as string);
  const published = event.publishedAt ? Date.parse(event.publishedAt) : NaN;
  const due: EventNotificationKind[] = [];

  if (settings.notifyOnPublish && Number.isFinite(published) && published <= now && now - published < PUBLISH_WINDOW_HOURS * HOUR) {
    due.push("published");
  }

  for (const offset of OFFSET_HOURS) {
    if (!settings.offsetsHours.includes(offset)) continue;
    const opens = start - offset * HOUR;
    const nextSmaller = OFFSET_HOURS.filter((o) => o < offset)[0];
    const closes = Math.min(
      start,
      opens + OFFSET_GRACE_HOURS[offset] * HOUR,
      nextSmaller !== undefined ? start - nextSmaller * HOUR : start,
    );
    if (now < opens || now >= closes) continue;
    if (settings.notifyOnPublish && Number.isFinite(published) && published > opens) continue;
    due.push(`offset_${offset}` as EventNotificationKind);
  }
  return due;
}

/** Most urgent first, so a capped pass spends its budget on what expires soonest. */
export const KIND_PRIORITY: EventNotificationKind[] = ["offset_1", "offset_24", "offset_168", "published"];

/** One notification per event, kind and founder, ever. */
export function eventDedupeKey(eventId: string, kind: EventNotificationKind, userId: string): string {
  return `event:${eventId}:${kind}:${userId}`;
}

// ── Who receives ──────────────────────────────────────────────────────────

/** Founders who receive a notification for an event, given who is registered for it. */
export function applyAudience<T extends { id: string }>(
  founders: T[],
  audience: EventAudience,
  registeredIds: ReadonlySet<string>,
): T[] {
  return audience === "registered_only" ? founders.filter((f) => registeredIds.has(f.id)) : founders;
}

// ── Wording ───────────────────────────────────────────────────────────────

const FORMAT_LABEL: Record<string, string> = {
  showcase: "Showcase",
  demo_day: "Demo day",
  webinar: "Webinar",
  hybrid: "Hybrid",
};

export function eventFormatLabel(format: string | null | undefined): string | null {
  if (!format) return null;
  return FORMAT_LABEL[format] ?? null;
}

/** "7 days", "1 day", "13 hours", "1 hour": the time left, as said in copy. */
export function timeLeftLabel(startsAt: string, now: number): string {
  const ms = Math.max(0, Date.parse(startsAt) - now);
  if (ms >= 23 * HOUR) {
    const days = Math.max(1, Math.round(ms / DAY));
    return days === 1 ? "1 day" : `${days} days`;
  }
  const hours = Math.max(1, Math.round(ms / HOUR));
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

export function notificationSubject(kind: EventNotificationKind, title: string, startsAt: string, now: number): string {
  return kind === "published" ? `New event: ${title}` : `${title} starts in ${timeLeftLabel(startsAt, now)}`;
}

export function firstNameOf(fullName: string | null | undefined): string | null {
  return (fullName ?? "").trim().split(/\s+/)[0] || null;
}

// ── The nudge ─────────────────────────────────────────────────────────────

export type NudgeSurface = "home" | "banner";

export function nudgeSurfaceEnabled(settings: Pick<EventNotificationSettings, "nudgeHome" | "nudgeBanner">, surface: NudgeSurface): boolean {
  return surface === "home" ? settings.nudgeHome : settings.nudgeBanner;
}

/**
 * The event to nudge a founder toward: the next published event that starts
 * inside the window, that they have not registered for and have not dismissed.
 * Null when there is none. Stops by itself when the event starts.
 */
export function pickNudgeEvent<T extends Pick<NotifiableEvent, "id" | "status" | "startsAt">>(input: {
  events: T[];
  registeredIds: ReadonlySet<string> | readonly string[];
  dismissedIds: ReadonlySet<string> | readonly string[];
  nudgeStartDays: number;
  now: number;
}): T | null {
  const registered = new Set(input.registeredIds);
  const dismissed = new Set(input.dismissedIds);
  const horizon = input.now + input.nudgeStartDays * DAY;
  const eligible = input.events
    .filter((e) => isUpcomingPublished(e, input.now))
    .filter((e) => Date.parse(e.startsAt as string) <= horizon)
    .filter((e) => !registered.has(e.id) && !dismissed.has(e.id))
    .sort((a, b) => Date.parse(a.startsAt as string) - Date.parse(b.startsAt as string));
  return eligible[0] ?? null;
}

/** What the nudge API returns and both founder components render. */
export type EventNudge = {
  eventId: string;
  title: string;
  slug: string;
  startsAt: string;
  /** "7 days", "1 day", "5 hours". */
  timeLeft: string;
  /** Date and time in the event's timezone. */
  dateLabel: string;
  formatLabel: string | null;
  coverUrl: string | null;
  coverFocal: string | null;
  coverOverlay: number | null;
};
