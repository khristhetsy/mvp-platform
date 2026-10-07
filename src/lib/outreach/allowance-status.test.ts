import { describe, expect, it } from "vitest";
import { allowanceStatus, runsLeft } from "./allowance-status";

const end = new Date("2026-10-24T00:00:00Z");

describe("outreach allowance status", () => {
  it("counts runs left every 6 days before the reset", () => {
    expect(runsLeft(new Date("2026-10-12T19:00:00Z"), end)).toBe(2); // Oct 12, Oct 18
    expect(runsLeft(null, end)).toBe(0);
  });
  it("Professional at 19 of 50 with 2 runs of 10 left is behind (39)", () => {
    expect(allowanceStatus({ cap: 50, reached: 19, windowEnd: end, nextRunAt: new Date("2026-10-12T19:00:00Z"), perRun: 10, blockedReason: null }))
      .toEqual({ status: "behind", projected: 39 });
  });
  it("Basic at 0 of 5 with a run tonight is on pace", () => {
    expect(allowanceStatus({ cap: 5, reached: 0, windowEnd: new Date("2026-11-01T00:00:00Z"), nextRunAt: new Date("2026-10-07T19:00:00Z"), perRun: 5, blockedReason: null }).status).toBe("on_pace");
  });
  it("full when the limit is reached", () => {
    expect(allowanceStatus({ cap: 5, reached: 5, windowEnd: end, nextRunAt: null, perRun: 0, blockedReason: null }).status).toBe("full");
  });
  it("stalled with no campaign or a block", () => {
    expect(allowanceStatus({ cap: 50, reached: 0, windowEnd: end, nextRunAt: null, perRun: 10, blockedReason: null }).status).toBe("stalled");
    expect(allowanceStatus({ cap: 5, reached: 0, windowEnd: end, nextRunAt: new Date("2026-10-12T19:00:00Z"), perRun: 5, blockedReason: "unpublished" }).status).toBe("stalled");
  });
  it("uncapped Managed IR with a run scheduled is on pace", () => {
    expect(allowanceStatus({ cap: null, reached: 12, windowEnd: end, nextRunAt: new Date("2026-10-12T19:00:00Z"), perRun: 10, blockedReason: null }).status).toBe("on_pace");
  });
});
