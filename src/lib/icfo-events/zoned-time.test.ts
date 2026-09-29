import { describe, it, expect } from "vitest";
import { zonedInputToIso, isoToZonedInput, zoneAbbrev, formatEventDateRange } from "@/lib/icfo-events/zoned-time";

describe("zoned-time", () => {
  it("reads typed time in the event zone, not the browser zone", () => {
    // 12:00 PM Pacific on Oct 20 2026 (PDT, UTC-7) = 19:00 UTC
    expect(zonedInputToIso("2026-10-20T12:00", "America/Los_Angeles")).toBe("2026-10-20T19:00:00.000Z");
    expect(zonedInputToIso("2026-10-20T16:00", "America/Los_Angeles")).toBe("2026-10-20T23:00:00.000Z");
  });

  it("handles standard time and other zones", () => {
    expect(zonedInputToIso("2026-12-01T09:00", "America/Los_Angeles")).toBe("2026-12-01T17:00:00.000Z");
    expect(zonedInputToIso("2026-10-21T06:00", "Australia/Sydney")).toBe("2026-10-20T19:00:00.000Z");
    expect(zonedInputToIso("2026-10-20T21:00", "Europe/Paris")).toBe("2026-10-20T19:00:00.000Z");
  });

  it("round-trips back to the same wall time", () => {
    const iso = "2026-10-20T19:00:00.000Z";
    expect(isoToZonedInput(iso, "America/Los_Angeles")).toBe("2026-10-20T12:00");
    expect(isoToZonedInput(iso, "Australia/Sydney")).toBe("2026-10-21T06:00");
  });

  it("returns null / empty for blank input", () => {
    expect(zonedInputToIso("", "America/Los_Angeles")).toBeNull();
    expect(isoToZonedInput(null, "America/Los_Angeles")).toBe("");
  });

  it("gives the zone abbreviation", () => {
    expect(zoneAbbrev("2026-10-20T19:00:00.000Z", "America/Los_Angeles")).toBe("PDT");
  });

  it("shows one date when the event starts and ends on the same day", () => {
    const line = formatEventDateRange("2026-10-20T19:00:00.000Z", "2026-10-20T23:00:00.000Z", "America/Los_Angeles", "en-US");
    expect(line).toBe("Tuesday, October 20, 2026 · 12:00 PM PDT");
  });
});
