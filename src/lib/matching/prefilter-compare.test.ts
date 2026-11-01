import { describe, expect, it } from "vitest";
import { overlapStats, summarize, topRanked, type FounderComparison } from "./prefilter-compare";

describe("overlapStats", () => {
  it("counts the old ids the new list also has", () => {
    expect(overlapStats(["a", "b", "c", "d"], ["b", "c", "x"])).toEqual({ shared: 2, of: 4, pct: 50 });
  });
  it("is 100 for identical lists and 0 for disjoint ones", () => {
    expect(overlapStats(["a", "b"], ["b", "a"]).pct).toBe(100);
    expect(overlapStats(["a"], ["z"]).pct).toBe(0);
  });
  it("has no percentage when there was nothing to compare against", () => {
    expect(overlapStats([], ["a"])).toEqual({ shared: 0, of: 0, pct: null });
  });
  it("rounds to one decimal", () => {
    expect(overlapStats(["a", "b", "c"], ["a"]).pct).toBe(33.3);
  });
});

describe("topRanked", () => {
  it("orders by score and breaks ties by id so reruns match", () => {
    const out = topRanked([{ id: "b", score: 80 }, { id: "a", score: 80 }, { id: "c", score: 90 }, { id: "d", score: 10 }], 3);
    expect(out.map((r) => r.id)).toEqual(["c", "a", "b"]);
  });
});

const row = (over: Partial<FounderComparison>): FounderComparison => ({
  companyId: "c", companyName: null, industry: null, canonicalIndustries: [], fellBack: false,
  oldMs: 2000, newMs: 200, newCandidates: 300, overlap: { shared: 40, of: 50, pct: 80 },
  oldAvgScore: 70, newAvgScore: 69, oldMinScore: 60, newMinScore: 58, ...over,
});

describe("summarize", () => {
  it("averages only the founders that were compared and counts fallbacks", () => {
    const s = summarize([row({}), row({ overlap: { shared: 25, of: 50, pct: 50 }, newMs: 400 }), row({ fellBack: true, overlap: null, newCandidates: null })]);
    expect(s).toMatchObject({ founders: 3, fellBack: 1, compared: 2, avgOverlapPct: 65, lowestOverlapPct: 50, avgNewMs: 300 });
  });
  it("is empty safe", () => {
    expect(summarize([])).toMatchObject({ founders: 0, compared: 0, avgOverlapPct: null, lowestOverlapPct: null });
  });
});
