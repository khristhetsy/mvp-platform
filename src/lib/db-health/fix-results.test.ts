import { describe, expect, it } from "vitest";
import { buildFixResultsView, changeFrom, formatChange, shareOf, type FixResultRow } from "@/lib/db-health/fix-results";

const row = (over: Partial<FixResultRow>): FixResultRow => ({
  area: "sequences", label: "Marketing sequences", step: 1, sort_order: 1, fixed_at: null,
  before_per_day: 1000, projected_per_day: 100, after_per_day: null, measured_at: null,
  source: "Supabase API log, 24 hours", note: null, ...over,
});

describe("changeFrom", () => {
  it("reports how much lower the after is", () => {
    expect(changeFrom(24517, 96)).toEqual({ percent: 99.6, direction: "fewer" });
    expect(changeFrom(124903, 86921)).toEqual({ percent: 30.4, direction: "fewer" });
  });
  it("reports an increase as more, not as a negative saving", () => {
    expect(changeFrom(100, 150)).toEqual({ percent: 50, direction: "more" });
  });
  it("reports no change", () => {
    expect(changeFrom(100, 100)).toEqual({ percent: 0, direction: "same" });
  });
  it("is null until an after is measured, and when there is no before", () => {
    expect(changeFrom(100, null)).toBeNull();
    expect(changeFrom(0, 5)).toBeNull();
  });
});

describe("shareOf", () => {
  it("returns the share of the total to one decimal", () => {
    expect(shareOf(24517, 124903)).toBe(19.6);
  });
  it("is null without a usable total", () => {
    expect(shareOf(5, 0)).toBeNull();
    expect(shareOf(5, null)).toBeNull();
  });
});

describe("buildFixResultsView", () => {
  const rows = [
    row({ area: "profiles", label: "Profile reads", sort_order: 2, before_per_day: 21287, projected_per_day: 15735 }),
    row({ area: "total", label: "All requests", step: null, sort_order: 0, before_per_day: 124903, projected_per_day: 86921 }),
    row({ area: "sequences", sort_order: 1, before_per_day: 24517, projected_per_day: 96, after_per_day: 90, measured_at: "2026-11-02T18:00:00Z" }),
  ];
  const view = buildFixResultsView(rows);

  it("separates the total from the areas and orders areas by sort_order", () => {
    expect(view.total?.label).toBe("All requests");
    expect(view.areas.map((a) => a.area)).toEqual(["sequences", "profiles"]);
  });
  it("computes projected and measured changes from the stored counts", () => {
    const seq = view.areas[0]!;
    expect(formatChange(seq.projectedChange)).toBe("99.6% fewer");
    expect(formatChange(seq.measuredChange)).toBe("99.6% fewer");
  });
  it("leaves the measured change empty until it is measured", () => {
    const prof = view.areas[1]!;
    expect(prof.measured).toBeNull();
    expect(prof.measuredChange).toBeNull();
    expect(formatChange(prof.measuredChange)).toBe("");
  });
  it("gives each area its share of the total but not the total itself", () => {
    expect(view.areas[0]!.shareOfTotal).toBe(19.6);
    expect(view.total?.shareOfTotal).toBeNull();
  });
  it("copes with no total row", () => {
    const v = buildFixResultsView([row({})]);
    expect(v.total).toBeNull();
    expect(v.areas[0]!.shareOfTotal).toBeNull();
  });
});
