/**
 * The rules that stop a founder promising the same half hour twice.
 */
import { describe, it, expect } from "vitest";
import { checkMeetingUrl, checkSlot, isGoogleMeet, slotsFor } from "@/lib/icfo-events/intro-scheduling";

// A four-hour event: 12:00 to 16:00 UTC.
const WINDOW = { startsAt: "2026-09-22T12:00:00.000Z", endsAt: "2026-09-22T16:00:00.000Z" };
const at = (hhmm: string) => `2026-09-22T${hhmm}:00.000Z`;

describe("the slots an event offers", () => {
  it("fills the window in half hours", () => {
    const slots = slotsFor(WINDOW);
    expect(slots).toHaveLength(8);
    expect(slots[0].startsAt).toBe(at("12:00"));
    expect(slots[7].startsAt).toBe(at("15:30"));
  });

  it("ends each slot where the next begins", () => {
    const [first, second] = slotsFor(WINDOW);
    expect(first.endsAt).toBe(second.startsAt);
  });

  it("starts on the event's own time, not on the clock", () => {
    // A 12:15 start offers 12:15 and 12:45 — not 12:30.
    const slots = slotsFor({ startsAt: at("12:15"), endsAt: at("13:15") });
    expect(slots.map((s) => s.startsAt)).toEqual([at("12:15"), at("12:45")]);
  });

  it("drops a trailing part-slot rather than overrunning", () => {
    // 12:00–13:20 fits two half hours; the last twenty minutes are not a slot.
    expect(slotsFor({ startsAt: at("12:00"), endsAt: at("13:20") })).toHaveLength(2);
  });

  it("marks the ones this founder has already given away", () => {
    const slots = slotsFor({ ...WINDOW, taken: [at("13:00")] });
    expect(slots.find((s) => s.startsAt === at("13:00"))?.taken).toBe(true);
    expect(slots.find((s) => s.startsAt === at("12:00"))?.taken).toBe(false);
  });

  it("does not offer a slot that has already begun", () => {
    const slots = slotsFor({ ...WINDOW, now: new Date(at("14:00")) });
    expect(slots[0].startsAt).toBe(at("14:00"));
  });

  it("offers nothing for an event with no dates", () => {
    expect(slotsFor({ startsAt: null, endsAt: null })).toEqual([]);
    expect(slotsFor({ startsAt: at("12:00"), endsAt: null })).toEqual([]);
  });

  it("offers nothing when the window is backwards or empty", () => {
    expect(slotsFor({ startsAt: at("16:00"), endsAt: at("12:00") })).toEqual([]);
    expect(slotsFor({ startsAt: at("12:00"), endsAt: at("12:00") })).toEqual([]);
  });
});

describe("confirming a chosen slot", () => {
  it("accepts one from the list", () => {
    expect(checkSlot({ ...WINDOW, chosen: at("13:30") })).toEqual({ ok: true });
  });

  it("refuses a time outside the event", () => {
    expect(checkSlot({ ...WINDOW, chosen: at("17:00") }))
      .toEqual({ ok: false, reason: "That time is outside the event." });
  });

  it("refuses a time that is not on a slot boundary", () => {
    expect(checkSlot({ ...WINDOW, chosen: at("13:11") }).ok).toBe(false);
  });

  it("refuses a slot they already gave away — the race this exists to lose safely", () => {
    expect(checkSlot({ ...WINDOW, chosen: at("13:00"), taken: [at("13:00")] }))
      .toEqual({ ok: false, reason: "You have already given that slot to someone else." });
  });

  it("refuses nonsense", () => {
    expect(checkSlot({ ...WINDOW, chosen: "not a date" }).ok).toBe(false);
  });

  it("says so when the event has no times left", () => {
    expect(checkSlot({ startsAt: null, endsAt: null, chosen: at("12:00") }))
      .toEqual({ ok: false, reason: "This event has no times left to meet in." });
  });
});

describe("the link the founder brings", () => {
  it("takes a Meet link", () => {
    expect(checkMeetingUrl("https://meet.google.com/abc-defg-hij"))
      .toEqual({ ok: true, url: "https://meet.google.com/abc-defg-hij" });
  });

  it("takes Zoom and Teams just as happily — requiring Google would exclude most founders", () => {
    expect(checkMeetingUrl("https://us02web.zoom.us/j/8412345").ok).toBe(true);
    expect(checkMeetingUrl("https://teams.microsoft.com/l/meetup-join/xyz").ok).toBe(true);
  });

  it("trims what was pasted", () => {
    expect(checkMeetingUrl("  https://meet.google.com/abc  "))
      .toEqual({ ok: true, url: "https://meet.google.com/abc" });
  });

  it("asks for one when the box is empty", () => {
    expect(checkMeetingUrl("   ")).toEqual({ ok: false, reason: "Add the link people should join." });
  });

  it("refuses something that is not a link", () => {
    expect(checkMeetingUrl("call me").ok).toBe(false);
    expect(checkMeetingUrl("meet.google.com/abc").ok).toBe(false);
    expect(checkMeetingUrl("http://meet.google.com/abc").ok).toBe(false);
  });

  it("knows a Meet link from any other, for wording only", () => {
    expect(isGoogleMeet("https://meet.google.com/abc")).toBe(true);
    expect(isGoogleMeet("https://zoom.us/j/1")).toBe(false);
  });
});
