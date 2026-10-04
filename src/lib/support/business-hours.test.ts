import { describe, expect, it } from "vitest";
import { addBusinessHours, dueLabel, isBusinessTime, nextBusinessStart } from "./business-hours";

// 2026-10-05 is a Monday. PDT is UTC-7, so 9:00 PT = 16:00 UTC, 18:00 PT = 01:00 UTC next day.
const iso = (s: string) => new Date(s);

describe("support business hours", () => {
  it("knows weekday hours from nights and weekends", () => {
    expect(isBusinessTime(iso("2026-10-05T16:00:00Z"))).toBe(true); // Mon 9:00 PT
    expect(isBusinessTime(iso("2026-10-05T15:59:00Z"))).toBe(false); // Mon 8:59 PT
    expect(isBusinessTime(iso("2026-10-06T01:00:00Z"))).toBe(false); // Mon 18:00 PT
    expect(isBusinessTime(iso("2026-10-03T18:00:00Z"))).toBe(false); // Sat 11:00 PT
  });

  it("moves a Saturday to Monday opening", () => {
    expect(nextBusinessStart(iso("2026-10-03T18:00:00Z")).toISOString()).toBe("2026-10-05T16:00:00.000Z");
  });

  it("adds one business day inside the window", () => {
    // Mon 10:00 PT + 9 business hours = Tue 10:00 PT
    expect(addBusinessHours(iso("2026-10-05T17:00:00Z"), 9).toISOString()).toBe("2026-10-06T17:00:00.000Z");
  });

  it("counts a Friday evening request from Monday morning", () => {
    // Fri 2026-10-02 20:00 PT -> starts Mon 9:00 PT -> due Mon 18:00 PT
    expect(addBusinessHours(iso("2026-10-03T03:00:00Z"), 9).toISOString()).toBe("2026-10-06T01:00:00.000Z");
  });

  it("labels due and overdue times", () => {
    const now = iso("2026-10-05T16:00:00Z");
    expect(dueLabel("2026-10-05T19:00:00Z", now)).toEqual({ text: "Due in 3h", overdue: false });
    expect(dueLabel("2026-10-03T14:00:00Z", now)).toEqual({ text: "Overdue 2d 2h", overdue: true });
    expect(dueLabel(null, now)).toBeNull();
  });
});
