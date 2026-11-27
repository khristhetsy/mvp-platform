import { describe, it, expect } from "vitest";
import { monthGrid, shiftMonth, timeOptions, formatTime12, combineDateTime, nextQuarterHour } from "./campaign-schedule-picker";

describe("monthGrid", () => {
  it("lays out November 2026 starting on a Sunday", () => {
    const weeks = monthGrid(2026, 10);
    expect(weeks[0][0]).toEqual({ date: "2026-11-01", day: 1 });
    expect(weeks.at(-1)?.[1]).toEqual({ date: "2026-11-30", day: 30 });
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it("pads the first week when the month starts midweek", () => {
    const weeks = monthGrid(2026, 11); // December 2026 starts on a Tuesday
    expect(weeks[0].slice(0, 2)).toEqual([null, null]);
    expect(weeks[0][2]).toEqual({ date: "2026-12-01", day: 1 });
  });
});

describe("shiftMonth", () => {
  it("rolls over year boundaries both ways", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe("time helpers", () => {
  it("lists 96 quarter hour options", () => {
    const t = timeOptions();
    expect(t).toHaveLength(96);
    expect(t[0]).toBe("00:00");
    expect(t.at(-1)).toBe("23:45");
  });

  it("formats 12 hour times", () => {
    expect(formatTime12("08:15")).toBe("8:15 AM");
    expect(formatTime12("00:00")).toBe("12:00 AM");
    expect(formatTime12("12:30")).toBe("12:30 PM");
    expect(formatTime12("23:45")).toBe("11:45 PM");
  });

  it("combines a date and time only when both exist", () => {
    expect(combineDateTime("2026-11-30", "08:15")).toBe("2026-11-30T08:15");
    expect(combineDateTime("", "08:15")).toBe("");
    expect(combineDateTime("2026-11-30", "")).toBe("");
  });

  it("finds the next quarter hour, rolling to the next day", () => {
    expect(nextQuarterHour("2026-11-27T12:31")).toEqual({ date: "2026-11-27", time: "12:45" });
    expect(nextQuarterHour("2026-11-27T12:45")).toEqual({ date: "2026-11-27", time: "13:00" });
    expect(nextQuarterHour("2026-11-30T23:50")).toEqual({ date: "2026-12-01", time: "00:00" });
  });
});
