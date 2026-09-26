import { describe, it, expect } from "vitest";
import { notSentReason, nudgeSummary, nudgedWithin } from "@/lib/admin/stuck-founder-nudge";

const now = new Date("2026-09-26T12:00:00Z");

describe("Stuck founders nudge columns", () => {
  it("summarises the document nudge and the general reminder", () => {
    expect(nudgeSummary("2 documents left before investor matching")).toBe("2 documents left");
    expect(nudgeSummary("1 document left before investor matching")).toBe("1 document left");
    expect(nudgeSummary("You're one step from investor matching")).toBe("General reminder");
    expect(nudgeSummary(null)).toBe("General reminder");
  });

  it("explains why a founder was not nudged", () => {
    expect(notSentReason({ stage: "initialize", companyUpdatedAt: null, approvalStatus: null, now })).toBe("Not in Ready yet");
    expect(notSentReason({ stage: "qualify", companyUpdatedAt: "2026-09-10T00:00:00Z", approvalStatus: "pending", now })).toBe("Waiting on iCFO review");
    expect(notSentReason({ stage: "qualify", companyUpdatedAt: "2026-09-24T00:00:00Z", approvalStatus: null, now })).toBe("Active in last 5 days");
    expect(notSentReason({ stage: "qualify", companyUpdatedAt: "2026-09-10T00:00:00Z", approvalStatus: null, now })).toBe("Due on the next daily run");
    expect(notSentReason({ stage: "qualify", companyUpdatedAt: null, approvalStatus: null, now })).toBe("Due on the next daily run");
  });

  it("counts nudges from the last 7 days", () => {
    expect(nudgedWithin("2026-09-20T12:00:00Z", 7, now)).toBe(true);
    expect(nudgedWithin("2026-09-18T12:00:00Z", 7, now)).toBe(false);
    expect(nudgedWithin("not a date", 7, now)).toBe(false);
  });
});
