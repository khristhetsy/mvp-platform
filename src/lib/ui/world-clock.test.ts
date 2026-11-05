import { describe, it, expect } from "vitest";
import { clockAngles, formatClock, zoneTime } from "./world-clock";

describe("zoneTime", () => {
  // 2026-11-04 15:08 UTC: Paris is UTC+1, New York UTC-5, Singapore UTC+8.
  const at = new Date("2026-11-04T15:08:00Z");
  it("reads the wall clock in each zone", () => {
    expect(zoneTime(at, "Europe/Paris")).toEqual({ hour: 16, minute: 8 });
    expect(zoneTime(at, "America/New_York")).toEqual({ hour: 10, minute: 8 });
    expect(zoneTime(at, "Asia/Singapore")).toEqual({ hour: 23, minute: 8 });
  });
  it("never returns hour 24 at midnight", () => {
    const midnight = new Date("2026-11-04T00:00:00Z");
    expect(zoneTime(midnight, "Europe/London").hour).toBe(0);
  });
});

describe("clockAngles", () => {
  it("places the hands", () => {
    expect(clockAngles(3, 0)).toEqual({ hourDeg: 90, minuteDeg: 0 });
    expect(clockAngles(15, 30)).toEqual({ hourDeg: 105, minuteDeg: 180 });
    expect(clockAngles(0, 0)).toEqual({ hourDeg: 0, minuteDeg: 0 });
  });
});

describe("formatClock", () => {
  it("zero pads", () => {
    expect(formatClock(7, 8)).toBe("07:08");
  });
});
