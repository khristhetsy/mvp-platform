import { describe, expect, it } from "vitest";
import {
  DEFAULT_EVENT_NOTIFICATION_SETTINGS,
  PUBLISH_WINDOW_HOURS,
  applyAudience,
  dueKinds,
  eventDedupeKey,
  isUpcomingPublished,
  normalizeEventNotificationSettings,
  notificationSubject,
  nudgeSurfaceEnabled,
  pickNudgeEvent,
  timeLeftLabel,
  validateEventNotificationSettings,
  type EventNotificationSettings,
} from "./event-notification-rules";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-11-11T18:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

const ALL: Pick<EventNotificationSettings, "notifyOnPublish" | "offsetsHours"> = { notifyOnPublish: true, offsetsHours: [168, 24, 1] };

/** An event starting `startsIn` from now, published `publishedAgo` before now. */
function event(startsIn: number, publishedAgo: number | null = 30 * DAY, status = "published") {
  return { status, startsAt: iso(NOW + startsIn), publishedAt: publishedAgo === null ? null : iso(NOW - publishedAgo) };
}

describe("settings", () => {
  it("defaults: publish on, 7 days and 1 day, all founders, both nudges, 7 days", () => {
    expect(DEFAULT_EVENT_NOTIFICATION_SETTINGS).toEqual({
      notifyOnPublish: true, offsetsHours: [168, 24], audience: "all_founders", nudgeHome: true, nudgeBanner: true, nudgeStartDays: 7,
    });
    expect(normalizeEventNotificationSettings(null)).toEqual(DEFAULT_EVENT_NOTIFICATION_SETTINGS);
    expect(normalizeEventNotificationSettings("nonsense")).toEqual(DEFAULT_EVENT_NOTIFICATION_SETTINGS);
  });

  it("normalize drops unknown offsets, sorts the rest and keeps an empty list empty", () => {
    expect(normalizeEventNotificationSettings({ offsetsHours: [1, 48, 168, "24"] }).offsetsHours).toEqual([168, 24, 1]);
    expect(normalizeEventNotificationSettings({ offsetsHours: [] }).offsetsHours).toEqual([]);
  });

  it("normalize falls back field by field on bad values", () => {
    const s = normalizeEventNotificationSettings({ notifyOnPublish: false, audience: "everyone", nudgeStartDays: 5, nudgeHome: "yes", nudgeBanner: false });
    expect(s.notifyOnPublish).toBe(false);
    expect(s.audience).toBe("all_founders");
    expect(s.nudgeStartDays).toBe(7);
    expect(s.nudgeHome).toBe(true);
    expect(s.nudgeBanner).toBe(false);
  });

  it("validate accepts a complete valid object", () => {
    expect(validateEventNotificationSettings({ ...DEFAULT_EVENT_NOTIFICATION_SETTINGS, offsetsHours: [1], audience: "registered_only", nudgeStartDays: 14 })).toEqual([]);
  });

  it("validate names every problem and rejects non objects", () => {
    expect(validateEventNotificationSettings(null)).toHaveLength(1);
    expect(validateEventNotificationSettings([])).toHaveLength(1);
    const errors = validateEventNotificationSettings({ notifyOnPublish: "yes", offsetsHours: [48], audience: "investors", nudgeHome: true, nudgeBanner: true, nudgeStartDays: 5 });
    expect(errors).toHaveLength(4);
    expect(errors.join(" ")).toContain("offsetsHours");
    expect(errors.join(" ")).toContain("nudgeStartDays");
  });
});

describe("dueKinds", () => {
  it("published is due while the publish window is open", () => {
    expect(dueKinds(event(30 * DAY, HOUR), ALL, NOW)).toEqual(["published"]);
    expect(dueKinds(event(30 * DAY, (PUBLISH_WINDOW_HOURS - 1) * HOUR), ALL, NOW)).toEqual(["published"]);
  });

  it("published is skipped once the publish window has passed, with no published_at, or when turned off", () => {
    expect(dueKinds(event(30 * DAY, (PUBLISH_WINDOW_HOURS + 1) * HOUR), ALL, NOW)).toEqual([]);
    expect(dueKinds(event(30 * DAY, null), ALL, NOW)).toEqual([]);
    expect(dueKinds(event(30 * DAY, HOUR), { ...ALL, notifyOnPublish: false }, NOW)).toEqual([]);
  });

  it("each reminder is due once start minus offset is reached", () => {
    expect(dueKinds(event(7 * DAY + HOUR), ALL, NOW)).toEqual([]);
    expect(dueKinds(event(7 * DAY - HOUR), ALL, NOW)).toEqual(["offset_168"]);
    expect(dueKinds(event(DAY - HOUR), ALL, NOW)).toEqual(["offset_24"]);
    expect(dueKinds(event(30 * 60 * 1000), ALL, NOW)).toEqual(["offset_1"]);
  });

  it("a reminder is only sent when the admin selected it", () => {
    expect(dueKinds(event(7 * DAY - HOUR), { notifyOnPublish: true, offsetsHours: [24] }, NOW)).toEqual([]);
    expect(dueKinds(event(30 * 60 * 1000), { notifyOnPublish: true, offsetsHours: [168, 24] }, NOW)).toEqual([]);
  });

  it("skips a window that already passed instead of sending late", () => {
    // 3 days out: the 7 day reminder is long past, the 1 day one not yet due.
    expect(dueKinds(event(3 * DAY), ALL, NOW)).toEqual([]);
    // 6 days minus an hour: more than a day after the 7 day mark.
    expect(dueKinds(event(6 * DAY - HOUR), ALL, NOW)).toEqual([]);
    // 10 hours out: more than 12 hours after the 1 day mark.
    expect(dueKinds(event(10 * HOUR), ALL, NOW)).toEqual([]);
  });

  it("never sends two reminders for one event at the same moment", () => {
    for (const startsIn of [8 * DAY, 7 * DAY - 1, 6.5 * DAY, 2 * DAY, DAY - 1, 13 * HOUR, HOUR - 1, 60_000]) {
      expect(dueKinds(event(startsIn), ALL, NOW).length).toBeLessThanOrEqual(1);
    }
  });

  it("nothing is due once the event has started", () => {
    expect(dueKinds(event(-60_000), ALL, NOW)).toEqual([]);
    expect(dueKinds(event(-DAY, HOUR), ALL, NOW)).toEqual([]);
  });

  it("draft, archived and ended events never notify", () => {
    for (const status of ["draft", "archived", "ended"]) {
      expect(dueKinds(event(DAY - HOUR, HOUR, status), ALL, NOW)).toEqual([]);
    }
    expect(dueKinds({ status: "published", startsAt: null, publishedAt: iso(NOW - HOUR) }, ALL, NOW)).toEqual([]);
  });

  it("a reminder whose moment came before publishing is covered by the publish notice", () => {
    // Published an hour ago, 6.5 days out: the 7 day mark fell before publishing.
    expect(dueKinds(event(7 * DAY - 2 * HOUR, HOUR), ALL, NOW)).toEqual(["published"]);
    // With the publish notice off, the reminder is the only notice and goes out.
    expect(dueKinds(event(7 * DAY - 2 * HOUR, HOUR), { ...ALL, notifyOnPublish: false }, NOW)).toEqual(["offset_168"]);
  });
});

describe("audience and dedupe", () => {
  const founders = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("all_founders keeps everyone, registered or not", () => {
    expect(applyAudience(founders, "all_founders", new Set(["b"]))).toEqual(founders);
  });

  it("registered_only keeps only founders registered for the event", () => {
    expect(applyAudience(founders, "registered_only", new Set(["b"]))).toEqual([{ id: "b" }]);
    expect(applyAudience(founders, "registered_only", new Set())).toEqual([]);
  });

  it("dedupe key is event:{eventId}:{kind}:{userId}", () => {
    expect(eventDedupeKey("ev1", "offset_24", "u1")).toBe("event:ev1:offset_24:u1");
    expect(eventDedupeKey("ev1", "published", "u1")).not.toBe(eventDedupeKey("ev1", "offset_168", "u1"));
    expect(eventDedupeKey("ev1", "published", "u1")).not.toBe(eventDedupeKey("ev1", "published", "u2"));
  });
});

describe("wording", () => {
  it("says the time left in days, then hours", () => {
    expect(timeLeftLabel(iso(NOW + 7 * DAY), NOW)).toBe("7 days");
    expect(timeLeftLabel(iso(NOW + 6 * DAY + 2 * HOUR), NOW)).toBe("6 days");
    expect(timeLeftLabel(iso(NOW + DAY - 60_000), NOW)).toBe("1 day");
    expect(timeLeftLabel(iso(NOW + 13 * HOUR), NOW)).toBe("13 hours");
    expect(timeLeftLabel(iso(NOW + 50 * 60_000), NOW)).toBe("1 hour");
  });

  it("subjects follow the agreed copy and carry no dashes", () => {
    const start = iso(NOW + 7 * DAY);
    expect(notificationSubject("offset_168", "iCFO PE Expo, Singapore", start, NOW)).toBe("iCFO PE Expo, Singapore starts in 7 days");
    expect(notificationSubject("published", "iCFO PE Expo, Singapore", start, NOW)).toBe("New event: iCFO PE Expo, Singapore");
  });
});

describe("nudge eligibility", () => {
  const ev = (id: string, startsIn: number, status = "published") => ({ id, status, startsAt: iso(NOW + startsIn) });
  const base = { registeredIds: [] as string[], dismissedIds: [] as string[], nudgeStartDays: 7, now: NOW };

  it("picks the next upcoming published event inside the window", () => {
    const picked = pickNudgeEvent({ ...base, events: [ev("later", 5 * DAY), ev("sooner", 2 * DAY)] });
    expect(picked?.id).toBe("sooner");
  });

  it("skips an event the founder is registered for and moves to the next", () => {
    const events = [ev("a", 2 * DAY), ev("b", 4 * DAY)];
    expect(pickNudgeEvent({ ...base, events, registeredIds: ["a"] })?.id).toBe("b");
    expect(pickNudgeEvent({ ...base, events, registeredIds: new Set(["a", "b"]) })).toBeNull();
  });

  it("skips an event the founder dismissed", () => {
    expect(pickNudgeEvent({ ...base, events: [ev("a", 2 * DAY)], dismissedIds: ["a"] })).toBeNull();
  });

  it("shows nothing for an event outside the start window", () => {
    expect(pickNudgeEvent({ ...base, events: [ev("a", 8 * DAY)] })).toBeNull();
    expect(pickNudgeEvent({ ...base, nudgeStartDays: 14, events: [ev("a", 8 * DAY)] })?.id).toBe("a");
    expect(pickNudgeEvent({ ...base, nudgeStartDays: 3, events: [ev("a", 4 * DAY)] })).toBeNull();
  });

  it("stops when the event has started", () => {
    expect(pickNudgeEvent({ ...base, events: [ev("a", -60_000)] })).toBeNull();
    expect(isUpcomingPublished(ev("a", -60_000), NOW)).toBe(false);
  });

  it("ignores draft and archived events", () => {
    expect(pickNudgeEvent({ ...base, events: [ev("a", 2 * DAY, "draft"), ev("b", 2 * DAY, "archived")] })).toBeNull();
  });

  it("honors the Home and banner switches", () => {
    expect(nudgeSurfaceEnabled({ nudgeHome: true, nudgeBanner: false }, "home")).toBe(true);
    expect(nudgeSurfaceEnabled({ nudgeHome: true, nudgeBanner: false }, "banner")).toBe(false);
  });
});
