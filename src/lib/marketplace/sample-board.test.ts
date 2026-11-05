import { describe, it, expect } from "vitest";
import { SAMPLE_DEALS, bandForScore, sectorAverages } from "./sample-board";

describe("bandForScore", () => {
  it("uses the board's existing thresholds", () => {
    expect(bandForScore(84)).toBe("high");
    expect(bandForScore(80)).toBe("high");
    expect(bandForScore(79.9)).toBe("mid");
    expect(bandForScore(70)).toBe("mid");
    expect(bandForScore(69.9)).toBe("low");
  });
});

describe("SAMPLE_DEALS", () => {
  it("keeps the displayed metric in step with the numbers behind it", () => {
    for (const d of SAMPLE_DEALS) {
      expect(d.metricMain).toBe(`${d.indicatedPct}% indicated`);
      expect(d.metricSub).toBe(`${d.indicatedAmount} / ${d.targetAmount}`);
      expect(d.band).toBe(bandForScore(d.score));
    }
  });
  it("is ranked by readiness, highest first", () => {
    const scores = SAMPLE_DEALS.map((d) => d.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});

describe("sectorAverages", () => {
  it("averages readiness per tag and sorts highest first", () => {
    const out = sectorAverages(SAMPLE_DEALS);
    expect(out[0]).toEqual({ sector: "Vision", avgScore: 84, deals: 1 });
    const ai = out.find((s) => s.sector === "AI");
    expect(ai).toEqual({ sector: "AI", avgScore: 82.3, deals: 2 });
    const scores = out.map((s) => s.avgScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
  it("returns nothing for no deals", () => {
    expect(sectorAverages([])).toEqual([]);
  });
});
