import { describe, expect, it } from "vitest";
import { ptDayDiff } from "@/lib/time/pt-day-diff";

// Oct 8, 2:25 PM PT (11:25 PM Paris): the moment the bug was reported.
const now = new Date("2026-10-08T21:25:00Z");

describe("ptDayDiff counts calendar days in PT", () => {
  it("a date-only due date of tomorrow is 1, not 0", () => {
    expect(ptDayDiff("2026-10-09", now)).toBe(1);
  });
  it("today is 0 and yesterday is -1", () => {
    expect(ptDayDiff("2026-10-08", now)).toBe(0);
    expect(ptDayDiff("2026-10-07", now)).toBe(-1);
  });
  it("reads timestamps in PT", () => {
    // 2026-10-09T05:00Z is still Oct 8 in PT.
    expect(ptDayDiff("2026-10-09T05:00:00Z", now)).toBe(0);
    expect(ptDayDiff("2026-10-09T18:00:00Z", now)).toBe(1);
  });
  it("crosses month ends", () => {
    expect(ptDayDiff("2026-11-01", now)).toBe(24);
  });
  it("returns null for junk", () => {
    expect(ptDayDiff("not a date", now)).toBeNull();
  });
});
