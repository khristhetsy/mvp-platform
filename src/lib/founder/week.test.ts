import { describe, expect, it } from "vitest";
import { isInWeek, latestIso, weekWindow } from "@/lib/founder/week";

describe("weekWindow (Monday to Sunday, Pacific time)", () => {
  it("finds the week of a Sunday evening in winter", () => {
    // Sun Nov 22 2026, 23:19 in Paris is 2:19 PM PST the same day.
    const w = weekWindow(new Date("2026-11-22T22:19:00Z"));
    expect(w.startIso).toBe("2026-11-16T08:00:00.000Z");
    expect(w.label).toBe("Nov 16 to Nov 22");
    expect(w.resetsLabel).toBe("Monday, Nov 23");
  });

  it("uses the summer offset", () => {
    const w = weekWindow(new Date("2026-07-08T12:00:00Z")); // Wednesday, PDT
    expect(w.startIso).toBe("2026-07-06T07:00:00.000Z");
    expect(w.label).toBe("Jul 6 to Jul 12");
    expect(w.resetsLabel).toBe("Monday, Jul 13");
  });

  it("starts a new week at Monday 00:00 PT, not at UTC midnight", () => {
    const justBefore = weekWindow(new Date("2026-11-23T07:59:00Z")); // Sunday 11:59 PM PST
    const justAfter = weekWindow(new Date("2026-11-23T08:00:00Z")); // Monday 12:00 AM PST
    expect(justBefore.startIso).toBe("2026-11-16T08:00:00.000Z");
    expect(justAfter.startIso).toBe("2026-11-23T08:00:00.000Z");
  });

  it("keeps Monday in its own week", () => {
    expect(weekWindow(new Date("2026-11-16T20:00:00Z")).startIso).toBe("2026-11-16T08:00:00.000Z");
  });
});

describe("isInWeek", () => {
  const start = "2026-11-16T08:00:00.000Z";
  it("is true from the first instant of the week", () => {
    expect(isInWeek("2026-11-16T08:00:00.000Z", start)).toBe(true);
    expect(isInWeek("2026-11-20T10:00:00Z", start)).toBe(true);
  });
  it("is false before the week, empty, or unreadable", () => {
    expect(isInWeek("2026-11-16T07:59:59.000Z", start)).toBe(false);
    expect(isInWeek(null, start)).toBe(false);
    expect(isInWeek(undefined, start)).toBe(false);
    expect(isInWeek("not a date", start)).toBe(false);
  });
});

describe("latestIso", () => {
  it("returns the most recent readable timestamp", () => {
    expect(latestIso(["2026-11-12T10:00:00Z", null, "2026-11-18T09:00:00Z", "bad"])).toBe("2026-11-18T09:00:00Z");
  });
  it("returns null when nothing is readable", () => {
    expect(latestIso([null, undefined, "bad"])).toBeNull();
    expect(latestIso([])).toBeNull();
  });
});
