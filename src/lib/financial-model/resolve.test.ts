import { describe, it, expect } from "vitest";
import { resolveAssumptions } from "@/lib/financial-model/resolve";

describe("financial-model assumption guards", () => {
  it("falls back to stage defaults when given nothing", () => {
    const a = resolveAssumptions(null, "early_revenue", 2_000_000);
    expect(a.raiseAmount).toBe(2_000_000);
    expect(a.monthlyGrowthPct).toBeGreaterThan(0);
    expect(a.grossMarginPct).toBeGreaterThan(0);
  });

  it("keeps valid founder-supplied values", () => {
    const a = resolveAssumptions(
      { startingCustomers: 50, monthlyGrowthPct: 8, pricePerMonth: 400, grossMarginPct: 80, monthlyBurn: 90_000, raiseAmount: 1_500_000 },
      "growing",
      null,
    );
    expect(a.startingCustomers).toBe(50);
    expect(a.pricePerMonth).toBe(400);
    expect(a.raiseAmount).toBe(1_500_000);
  });

  it("clamps nonsensical input to defensible ranges (no negatives, growth ≤ 100, margin ≤ 100)", () => {
    const a = resolveAssumptions(
      { startingCustomers: -5, monthlyGrowthPct: 500, pricePerMonth: -10, grossMarginPct: 250, monthlyBurn: -100, raiseAmount: -50 },
      null,
      null,
    );
    expect(a.startingCustomers).toBeGreaterThanOrEqual(0);
    expect(a.monthlyGrowthPct).toBeLessThanOrEqual(100);
    expect(a.pricePerMonth).toBeGreaterThanOrEqual(0);
    expect(a.grossMarginPct).toBeLessThanOrEqual(100);
    expect(a.monthlyBurn).toBeGreaterThanOrEqual(0);
    expect(a.raiseAmount).toBeGreaterThanOrEqual(0);
  });

  it("rounds starting customers to a whole number", () => {
    const a = resolveAssumptions({ startingCustomers: 12.7 }, null, null);
    expect(Number.isInteger(a.startingCustomers)).toBe(true);
  });

  it("ignores non-finite values and uses the default instead", () => {
    const a = resolveAssumptions({ monthlyGrowthPct: Number.NaN, raiseAmount: Infinity }, "pre_revenue", 1_000_000);
    expect(Number.isFinite(a.monthlyGrowthPct)).toBe(true);
    expect(Number.isFinite(a.raiseAmount)).toBe(true);
  });
});
