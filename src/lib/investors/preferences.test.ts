import { describe, it, expect } from "vitest";
import { extractInvestorPreferences, activeRatingScore } from "./preferences";
import { parseMoneyBand, scoreInvestorPreferenceMatch } from "./preference-match";

describe("extractInvestorPreferences", () => {
  it("maps Odoo labels to the typed shape (case-insensitive)", () => {
    const pref = extractInvestorPreferences([
      { label: "Active investor", values: ["5-Excellent"] },
      { label: "Investor investment size?", values: ["$250k - $500k"] },
      { label: "Investor preferences for use of funds?", values: ["Growth Stage", "Research & Development"] },
      { label: "Investor contact preference", values: ["Verified"] },
    ]);
    expect(pref.activeRating).toBe("5-Excellent");
    expect(pref.investmentSize).toEqual(["$250k - $500k"]);
    expect(pref.useOfFunds).toEqual(["Growth Stage", "Research & Development"]);
    expect(pref.contactPreference).toBe("Verified");
    expect(pref.revenueRange).toEqual([]);
  });

  it("reads the numeric active rating", () => {
    expect(activeRatingScore(extractInvestorPreferences([{ label: "Active investor", values: ["5-Excellent"] }]))).toBe(5);
    expect(activeRatingScore(extractInvestorPreferences([]))).toBeNull();
  });
});

describe("parseMoneyBand", () => {
  it("parses ranges and open-ended bands", () => {
    expect(parseMoneyBand("$250k - $500k")).toEqual({ min: 250_000, max: 500_000 });
    expect(parseMoneyBand("Less than $50k")).toEqual({ min: 0, max: 50_000 });
    expect(parseMoneyBand("$500k - $1m")).toEqual({ min: 500_000, max: 1_000_000 });
  });
});

describe("scoreInvestorPreferenceMatch", () => {
  const company = {
    fundingAmount: 400_000,
    revenue: 700_000,
    revenueStage: "growing",
    useOfFunds: "growth and hiring",
    industry: "SaaS",
  };

  it("scores a strong fit high with check-size + revenue + stage reasons", () => {
    const pref = extractInvestorPreferences([
      { label: "Investor investment size?", values: ["$250k - $500k"] },
      { label: "Investor preferences for the company with an annual revenue range of?", values: ["$500k - $1m"] },
      { label: "Investor preferences for use of funds?", values: ["Growth Stage"] },
      { label: "Active investor", values: ["5-Excellent"] },
    ]);
    const m = scoreInvestorPreferenceMatch(company, pref);
    expect(m.score).toBeGreaterThanOrEqual(85);
    expect(m.reasons).toContain("Check size fits the raise");
    expect(m.reasons).toContain("Revenue band matches");
  });

  it("scores an off-fit low", () => {
    const pref = extractInvestorPreferences([
      { label: "Investor investment size?", values: ["Less than $50k"] },
      { label: "Investor preferences for use of funds?", values: ["Turnaround"] },
    ]);
    const m = scoreInvestorPreferenceMatch(company, pref);
    expect(m.score).toBeLessThan(40);
  });

  it("returns a neutral 50 when the investor has no stated preferences", () => {
    expect(scoreInvestorPreferenceMatch(company, extractInvestorPreferences([])).score).toBe(50);
  });
});
