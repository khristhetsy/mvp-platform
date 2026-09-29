import { describe, it, expect } from "vitest";
import { arrivalLabel, usZoneForState } from "@/lib/founder-outreach/us-time-zone";

describe("founder US time zone", () => {
  it("maps state codes and names", () => {
    expect(usZoneForState("SC", "United States")).toMatchObject({ abbr: "ET", stateName: "South Carolina" });
    expect(usZoneForState("california", "USA")).toMatchObject({ abbr: "PT", iana: "America/Los_Angeles" });
    expect(usZoneForState("TX", null)).toMatchObject({ abbr: "CT" });
    expect(usZoneForState("AZ", "US")).toMatchObject({ abbr: "MT", iana: "America/Phoenix" });
    expect(usZoneForState("HI", "US")).toMatchObject({ abbr: "HT" });
  });

  it("returns null outside the US or for an unknown state", () => {
    expect(usZoneForState("Ontario", "Canada")).toBeNull();
    expect(usZoneForState("Nowhere", "United States")).toBeNull();
    expect(usZoneForState(null, "United States")).toBeNull();
  });

  it("labels the arrival time in the founder's zone", () => {
    // 15:00 in Paris on Mon 28 Sep 2026 is 13:00 UTC.
    const iso = "2026-09-28T13:00:00Z";
    expect(arrivalLabel(iso, usZoneForState("SC")!)).toBe("Mon 28 Sep, 9:00 AM ET");
    expect(arrivalLabel(iso, usZoneForState("CA")!)).toBe("Mon 28 Sep, 6:00 AM PT");
    expect(arrivalLabel(iso, usZoneForState("AZ")!)).toBe("Mon 28 Sep, 6:00 AM MT");
  });
});
