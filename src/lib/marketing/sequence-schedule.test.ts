import { describe, expect, it } from "vitest";
import { countRuns, describeSchedule, formatIn, formatPt, latestRun, nextRuns, runsBetween } from "./sequence-schedule";

const base = { start_date: "2026-10-07", end_date: "2026-11-30", repeat: "weekdays" as const, weekdays: [], send_time: "09:00" };

describe("sequence schedule", () => {
  it("runs weekdays at 9:00 AM PT (16:00 UTC in PDT)", () => {
    const now = new Date("2026-10-06T22:08:00Z"); // Oct 6, 3:08 PM PT
    const next = nextRuns(base, now, 3).map((d) => d.toISOString());
    expect(next).toEqual(["2026-10-07T16:00:00.000Z", "2026-10-08T16:00:00.000Z", "2026-10-09T16:00:00.000Z"]);
  });

  it("skips the weekend", () => {
    const now = new Date("2026-10-09T17:00:00Z"); // Fri after the run
    expect(nextRuns(base, now, 1)[0].toISOString()).toBe("2026-10-12T16:00:00.000Z");
  });

  it("keeps 9:00 AM PT after the November clock change (17:00 UTC in PST)", () => {
    const now = new Date("2026-11-02T00:00:00Z");
    expect(nextRuns(base, now, 1)[0].toISOString()).toBe("2026-11-02T17:00:00.000Z");
  });

  it("counts 39 weekday runs from Oct 7 to Nov 30", () => {
    expect(countRuns(base)).toBe(39);
  });

  it("stops at the end date", () => {
    expect(nextRuns(base, new Date("2026-12-01T00:00:00Z"), 1)).toEqual([]);
  });

  it("weekly uses the picked days", () => {
    const s = { ...base, repeat: "weekly" as const, weekdays: [2, 4] }; // Tue, Thu
    const next = nextRuns(s, new Date("2026-10-07T00:00:00Z"), 3).map((d) => d.toISOString().slice(0, 10));
    expect(next).toEqual(["2026-10-08", "2026-10-13", "2026-10-15"]);
  });

  it("monthly clamps to the last day of short months", () => {
    const s = { ...base, start_date: "2026-01-31", end_date: null, repeat: "monthly" as const };
    const runs = runsBetween(s, new Date("2026-02-01T00:00:00Z"), new Date("2026-04-01T00:00:00Z")).map((d) => d.toISOString().slice(0, 10));
    expect(runs).toEqual(["2026-02-28", "2026-03-31"]);
  });

  it("once runs on the start date only", () => {
    const s = { ...base, repeat: "once" as const };
    expect(countRuns(s)).toBe(1);
  });

  it("finds the run that just passed", () => {
    expect(latestRun(base, new Date("2026-10-07T16:04:00Z"))?.toISOString()).toBe("2026-10-07T16:00:00.000Z");
    expect(latestRun(base, new Date("2026-10-07T15:59:00Z"))).toBeNull();
  });

  it("formats in PT", () => {
    expect(formatPt(new Date("2026-10-07T16:00:00Z"))).toBe("Wed Oct 7, 9:00 AM PT");
    expect(formatIn(new Date("2026-10-07T16:00:00Z"), new Date("2026-10-07T07:05:00Z"))).toBe("in 8h 55m");
    expect(describeSchedule({ ...base, enabled: true })).toBe("Weekdays 9:00 AM PT · Oct 7 to Nov 30");
  });
});
