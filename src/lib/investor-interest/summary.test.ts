import { describe, expect, it } from "vitest";
import { daysUntil, expiryLabel, firstOf, interestHeadline, investorDescriptor } from "@/lib/investor-interest/summary";

describe("interest headline", () => {
  it("names both counts", () => {
    expect(interestHeadline(3, 2)).toBe("3 investors viewed your deal, 2 requested an introduction");
  });
  it("handles singular and missing halves", () => {
    expect(interestHeadline(1, 0)).toBe("1 investor viewed your deal");
    expect(interestHeadline(0, 1)).toBe("1 investor requested an introduction");
    expect(interestHeadline(0, 0)).toBe("No investor interest yet");
  });
});

describe("expiry", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  it("rounds partial days up", () => {
    expect(daysUntil("2026-10-10T18:00:00Z", now)).toBe(2);
    expect(expiryLabel("2026-10-23T12:00:00Z", now)).toBe("Expires in 14 days");
    expect(expiryLabel("2026-10-10T06:00:00Z", now)).toBe("Expires in 1 day");
  });
  it("says expired once the time has passed", () => {
    expect(expiryLabel("2026-10-08T12:00:00Z", now)).toBe("Expired");
  });
  it("is null when the request never expires", () => {
    expect(expiryLabel(null, now)).toBeNull();
    expect(daysUntil("not a date", now)).toBeNull();
  });
});

describe("descriptors", () => {
  it("joins what is known", () => {
    expect(investorDescriptor("Angel", "Seed")).toBe("Angel · Seed");
    expect(investorDescriptor(null, "Seed")).toBe("Seed");
    expect(investorDescriptor(null, " ")).toBeNull();
  });
  it("reads the first value of a loose list", () => {
    expect(firstOf(["", "VC", "Angel"])).toBe("VC");
    expect(firstOf("Family office")).toBe("Family office");
    expect(firstOf(null)).toBeNull();
  });
});
