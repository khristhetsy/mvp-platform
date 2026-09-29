import { describe, expect, it } from "vitest";
import { countAtOrAbove, readThresholds, validThreshold } from "@/lib/matching/matching-thresholds-shared";

describe("matching thresholds", () => {
  it("defaults to 60 and 60 and ignores values out of range", () => {
    expect(readThresholds(null)).toEqual({ readiness: 60, match: 60 });
    expect(readThresholds({ readiness: 50 })).toEqual({ readiness: 50, match: 60 });
    expect(readThresholds({ readiness: 6, match: 95 })).toEqual({ readiness: 60, match: 60 });
    expect(readThresholds({ readiness: "50", match: 55.5 })).toEqual({ readiness: 60, match: 60 });
  });
  it("accepts whole numbers from 30 to 90", () => {
    expect(validThreshold(30)).toBe(true);
    expect(validThreshold(90)).toBe(true);
    expect(validThreshold(29)).toBe(false);
    expect(validThreshold(45.5)).toBe(false);
  });
  it("counts companies at or above a threshold (today's top scores)", () => {
    const scores = [51, 50, 48, 40, 38, 12];
    expect(countAtOrAbove(scores, 60)).toBe(0);
    expect(countAtOrAbove(scores, 50)).toBe(2);
    expect(countAtOrAbove(scores, 45)).toBe(3);
    expect(countAtOrAbove(scores, 40)).toBe(4);
  });
});
