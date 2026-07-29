import { describe, it, expect } from "vitest";
import { extractInvestorPreferences, activeRatingScore, EMPTY_PREFERENCES } from "./preferences";
import { parseMoneyBand, scoreInvestorPreferenceMatch } from "./preference-match";
import { computeInformativeFields, maskPreferences } from "./load-investor-matches";

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

describe("computeInformativeFields / maskPreferences (non-discriminating data)", () => {
  it("drops fields everyone shares and keeps ones that vary", () => {
    // Every investor has the identical (full) investment-size set — no signal.
    // Only activeRating varies.
    const prefs = [
      { ...EMPTY_PREFERENCES, investmentSize: ["a", "b"], activeRating: "5-Excellent" },
      { ...EMPTY_PREFERENCES, investmentSize: ["a", "b"], activeRating: "2-Fair" },
      { ...EMPTY_PREFERENCES, investmentSize: ["a", "b"], activeRating: "3-Good" },
    ];
    const informative = computeInformativeFields(prefs);
    expect(informative.has("investmentSize")).toBe(false);
    expect(informative.has("activeRating")).toBe(true);

    const masked = maskPreferences(prefs[0], informative);
    expect(masked.investmentSize).toEqual([]); // dropped
    expect(masked.activeRating).toBe("5-Excellent"); // kept
  });

  it("makes an all-identical directory score neutral instead of a false 100%", () => {
    const c = { fundingAmount: 400_000, revenue: null, revenueStage: "growing", useOfFunds: "growth", industry: "SaaS" };
    // Two investors, both with the identical full band set → nothing discriminates.
    const identical = { ...EMPTY_PREFERENCES, investmentSize: ["$250k - $500k"], useOfFunds: ["Growth Stage"], activeRating: "5-Excellent" };
    const prefs = [identical, { ...identical }];
    const informative = computeInformativeFields(prefs);
    const score = scoreInvestorPreferenceMatch(c, maskPreferences(prefs[0], informative)).score;
    expect(score).toBe(50); // neutral, not 100
  });
});
