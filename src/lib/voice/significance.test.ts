import { describe, it, expect } from "vitest";
import { normalCdf, twoProportionConfidence, variantSignificance, MIN_SAMPLE } from "./significance";

describe("normalCdf", () => {
  it("is ~0.5 at 0 and ~0.975 at 1.96", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 2);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 2);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 2);
  });
});

describe("twoProportionConfidence", () => {
  it("high confidence for a clear, well-powered difference", () => {
    // 20% vs 5% over 500 each → very significant.
    const c = twoProportionConfidence(100, 500, 25, 500);
    expect(c).not.toBeNull();
    expect(c as number).toBeGreaterThan(99);
  });
  it("low confidence for near-equal rates", () => {
    const c = twoProportionConfidence(52, 500, 50, 500);
    expect((c as number)).toBeLessThan(95);
  });
  it("returns null when a side has no calls", () => {
    expect(twoProportionConfidence(0, 0, 5, 100)).toBeNull();
  });
});

describe("variantSignificance", () => {
  it("names a significant leader when the gap is real and powered", () => {
    const r = variantSignificance([
      { variantId: "a", calls: 500, booked: 100 }, // 20%
      { variantId: "b", calls: 500, booked: 25 },  // 5%
    ]);
    expect(r.leaderId).toBe("a");
    expect(r.significant).toBe(true);
    expect(r.confidence as number).toBeGreaterThan(95);
  });
  it("no winner below the minimum sample", () => {
    const r = variantSignificance([
      { variantId: "a", calls: MIN_SAMPLE - 1, booked: 10 },
      { variantId: "b", calls: MIN_SAMPLE - 1, booked: 1 },
    ]);
    expect(r.leaderId).toBeNull();
    expect(r.significant).toBe(false);
  });
  it("leader but not significant when rates are close", () => {
    const r = variantSignificance([
      { variantId: "a", calls: 200, booked: 42 },
      { variantId: "b", calls: 200, booked: 40 },
    ]);
    expect(r.leaderId).toBe("a");
    expect(r.significant).toBe(false);
  });
});
