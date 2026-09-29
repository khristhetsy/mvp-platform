import { describe, expect, it } from "vitest";
import { activeRatingFromOdoo, capitalTypesFromOdoo, checkSizeFromOdoo } from "@/lib/matching/odoo-mandate";

describe("checkSizeFromOdoo", () => {
  it("spans every selected band", () => {
    expect(checkSizeFromOdoo(["Less than $50k", "$50k - $100k", "$100k - $250k", "$250k - $500k"])).toEqual({ min: 0, max: 500_000 });
  });
  it("is open ended when Over $100m is selected", () => {
    expect(checkSizeFromOdoo(["$50m - $100m", "Over $100m"])).toEqual({ min: 50_000_000, max: null });
  });
  it("ignores numeric ids and unknown labels", () => {
    expect(checkSizeFromOdoo(["1", "2", "nonsense"])).toEqual({ min: null, max: null });
    expect(checkSizeFromOdoo("$500k - $1m")).toEqual({ min: 500_000, max: 1_000_000 });
  });
});

describe("capitalTypesFromOdoo", () => {
  it("maps to platform labels, dedupes, drops the rest", () => {
    expect(capitalTypesFromOdoo(["Equity Capital", "Debt Capital", "Business Loan", "Human Capital", "4", "Other"])).toEqual([
      "Equity",
      "Venture debt",
    ]);
  });
});

describe("activeRatingFromOdoo", () => {
  it("reads the leading 1 to 5", () => {
    expect(activeRatingFromOdoo("5-Excellent")).toBe(5);
    expect(activeRatingFromOdoo(["2-Fair"])).toBe(2);
    expect(activeRatingFromOdoo("Other")).toBeNull();
    expect(activeRatingFromOdoo(null)).toBeNull();
  });
});
