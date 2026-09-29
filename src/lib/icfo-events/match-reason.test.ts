/**
 * One line, and never an invented one.
 */
import { describe, it, expect } from "vitest";
import { matchReason } from "@/lib/icfo-events/match-reason";

describe("when they share sectors", () => {
  it("names them", () => {
    expect(matchReason({ sharedSectors: ["HealthTech", "Deep Tech"], role: "founder" }))
      .toBe("Shared: HealthTech, Deep Tech");
  });

  it("names one", () => {
    expect(matchReason({ sharedSectors: ["FinTech"], role: "investor" })).toBe("Shared: FinTech");
  });

  it("stops at three and counts the rest", () => {
    expect(matchReason({ sharedSectors: ["A", "B", "C", "D", "E"], role: "founder" }))
      .toBe("Shared: A, B, C +2 more");
  });

  it("ignores blanks rather than printing a stray comma", () => {
    expect(matchReason({ sharedSectors: ["  ", "FinTech", ""], role: "founder" })).toBe("Shared: FinTech");
  });

  it("prefers the sectors over the role — they are the specific thing in common", () => {
    expect(matchReason({ sharedSectors: ["HealthTech"], role: "presenter" })).toBe("Shared: HealthTech");
  });
});

describe("when they share nothing but the room", () => {
  it("says what the other person is", () => {
    expect(matchReason({ sharedSectors: [], role: "founder" })).toBe("Founder at this event");
    expect(matchReason({ sharedSectors: [], role: "investor" })).toBe("Investor at this event");
    expect(matchReason({ sharedSectors: [], role: "presenter" })).toBe("Presenting at this event");
    expect(matchReason({ sharedSectors: [], role: "service" })).toBe("Service provider at this event");
    expect(matchReason({ sharedSectors: [], role: "sponsor" })).toBe("Sponsor of this event");
  });

  it("never claims a shared interest that does not exist", () => {
    expect(matchReason({ sharedSectors: [], role: "founder" })).not.toContain("Shared");
  });
});
