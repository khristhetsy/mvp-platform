import { describe, it, expect } from "vitest";
import { computeMonthlyModel } from "@/lib/financial-model/monthly";
import { computeProjections, type ProjectionAssumptions } from "@/lib/business-plan/projections";

const A: ProjectionAssumptions = {
  startingCustomers: 50,
  monthlyGrowthPct: 10,
  pricePerMonth: 400,
  grossMarginPct: 80,
  monthlyBurn: 90_000,
  raiseAmount: 2_000_000,
};

describe("financial model — monthly engine", () => {
  it("produces exactly 36 monthly rows", () => {
    expect(computeMonthlyModel(A)).toHaveLength(36);
  });

  it("annual revenue ties out to computeProjections (within per-month rounding)", () => {
    const monthly = computeMonthlyModel(A);
    const proj = computeProjections(A);
    for (let y = 0; y < 3; y++) {
      const sum = monthly.filter((r) => r.year === y + 1).reduce((a, r) => a + r.revenue, 0);
      expect(Math.abs(sum - proj.years[y].revenue)).toBeLessThanOrEqual(14);
    }
  });

  it("ending cash balance matches the projection's ending cash", () => {
    const monthly = computeMonthlyModel(A);
    const proj = computeProjections(A);
    expect(Math.abs(monthly[35].cashBalance - proj.endingCash)).toBeLessThanOrEqual(36);
  });

  it("running cash balance starts above zero from the raise", () => {
    const monthly = computeMonthlyModel(A);
    expect(monthly[0].cashBalance).toBeGreaterThan(0);
  });
});
