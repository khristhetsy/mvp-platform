import { describe, it, expect } from "vitest";
import { segmentFor } from "./models";

describe("segmentFor — single source of truth for lead segmentation", () => {
  it("is hot only when a strong score AND active raising coincide", () => {
    expect(segmentFor(70, true)).toBe("hot");
    expect(segmentFor(65, true)).toBe("hot");
    expect(segmentFor(64, true)).toBe("warm"); // strong intent, sub-threshold score
  });

  it("classifies a strong score with no active raise as warm, not cold", () => {
    // This is the case the two divergent implementations disagreed on: the old
    // models.ts band (40–64) dropped a 70-score non-raiser to cold, while
    // store.ts called it warm. Warm is correct — it's a nurture-worthy lead.
    expect(segmentFor(70, false)).toBe("warm");
    expect(segmentFor(40, false)).toBe("warm");
  });

  it("is warm on intent alone even with a low score", () => {
    expect(segmentFor(10, true)).toBe("warm");
  });

  it("is cold only when neither score nor intent qualifies", () => {
    expect(segmentFor(39, false)).toBe("cold");
    expect(segmentFor(0, false)).toBe("cold");
  });
});
