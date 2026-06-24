import { describe, expect, it } from "vitest";
import { isFillingFast, readinessTrend, type MetricSnapshot } from "./metric-trends";

const DAY = 24 * 60 * 60 * 1000;
function snap(daysAgo: number, readiness: number | null, indicated: number): MetricSnapshot {
  return {
    capturedAt: new Date(Date.now() - daysAgo * DAY).toISOString(),
    readinessScore: readiness,
    totalIndicated: indicated,
  };
}

describe("readinessTrend", () => {
  it("returns flat/null with fewer than 2 readiness points", () => {
    expect(readinessTrend([])).toEqual({ direction: "flat", delta: null, sparkline: [] });
    expect(readinessTrend([snap(0, 84, 0)])).toEqual({ direction: "flat", delta: null, sparkline: [84] });
  });

  it("computes an upward delta over the window", () => {
    const t = readinessTrend([snap(8, 80.0, 0), snap(4, 82.0, 0), snap(0, 84.2, 0)]);
    expect(t.direction).toBe("up");
    expect(t.delta).toBe(4.2);
    expect(t.sparkline).toEqual([80, 82, 84.2]);
  });

  it("computes a downward delta", () => {
    const t = readinessTrend([snap(8, 75, 0), snap(0, 71.5, 0)]);
    expect(t.direction).toBe("down");
    expect(t.delta).toBe(-3.5);
  });

  it("drops null readiness points from the sparkline", () => {
    const t = readinessTrend([snap(8, 70, 0), snap(4, null, 0), snap(0, 73, 0)]);
    expect(t.sparkline).toEqual([70, 73]);
    expect(t.delta).toBe(3);
  });

  it("uses oldest available when all points are within the window", () => {
    const t = readinessTrend([snap(3, 60, 0), snap(1, 64, 0)]);
    expect(t.delta).toBe(4);
    expect(t.direction).toBe("up");
  });
});

describe("isFillingFast", () => {
  it("is false with fewer than 2 points", () => {
    expect(isFillingFast([])).toBe(false);
    expect(isFillingFast([snap(0, 80, 500_000)])).toBe(false);
  });

  it("is true on a large enough absolute + percent gain", () => {
    expect(isFillingFast([snap(8, 1_000_000, 1_000_000), snap(0, 1_000_000, 1_300_000)])).toBe(true);
  });

  it("is false when the absolute gain is below the floor", () => {
    expect(isFillingFast([snap(8, 80, 10_000), snap(0, 80, 40_000)])).toBe(false);
  });

  it("is false when percent gain is below threshold despite large base", () => {
    // +100k on 5M base = 2% < 15%
    expect(isFillingFast([snap(8, 80, 5_000_000), snap(0, 80, 5_100_000)])).toBe(false);
  });

  it("treats growth from zero base as filling fast when above abs floor", () => {
    expect(isFillingFast([snap(8, 80, 0), snap(0, 80, 200_000)])).toBe(true);
  });
});
