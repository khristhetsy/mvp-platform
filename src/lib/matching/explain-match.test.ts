/**
 * The breakdown and the score are one computation, and several ARR/MRR bands
 * on the investor side behave like one band did.
 */
import { describe, it, expect } from "vitest";
import {
  DEFAULT_ENGINE_WEIGHTS,
  explainMatch,
  joinBandList,
  matchInvestorToCompany,
  splitBandList,
  type CompanyMatchProfile,
  type InvestorMatchProfile,
} from "@/lib/matching/investor-company-matching";

function company(overrides: Partial<CompanyMatchProfile> = {}): CompanyMatchProfile {
  return {
    id: "c1",
    companyName: "Co",
    slug: null,
    industry: "Fintech",
    stage: "Seed",
    geography: "California, United States",
    fundingAmount: null,
    fundingBand: "$1m - $10m",
    readinessScore: null,
    onboardingPercent: 100,
    reviewStatus: null,
    isPublished: false,
    marketplaceVisible: false,
    publishedAt: null,
    arrBand: "$500k – $1M",
    mrrBand: "$10k – $50k",
    ...overrides,
  };
}

function investor(overrides: Partial<InvestorMatchProfile> = {}): InvestorMatchProfile {
  return {
    profile_id: "i1",
    investor_type: "family_office",
    check_size_min: 1_000_000,
    check_size_max: 5_000_000,
    preferred_sectors: ["Fintech"],
    preferred_geographies: ["United States"],
    preferred_stages: ["Seed"],
    preferred_arr_range: "$500k – $1M",
    preferred_mrr_range: null,
    approval_status: "approved",
    ...overrides,
  };
}

describe("explainMatch", () => {
  it("adds up to the same score matchInvestorToCompany returns", () => {
    const inv = investor();
    const co = company();
    const breakdown = explainMatch(inv, co);
    const summary = matchInvestorToCompany(inv, co);
    expect(breakdown.matchScore).toBe(summary.matchScore);
    expect(breakdown.matchReasons).toEqual(summary.matchReasons);
    expect(breakdown.missingFitReasons).toEqual(summary.missingFitReasons);
    const counted = breakdown.factors.filter((f) => f.counted);
    expect(counted.reduce((n, f) => n + f.points, 0)).toBe(breakdown.earned);
    expect(counted.reduce((n, f) => n + f.weight, 0)).toBe(breakdown.totalWeight);
    expect(Math.round((breakdown.earned / breakdown.totalWeight) * 100)).toBe(breakdown.matchScore);
  });

  it("lists every factor, fixed ones always counted, MRR dropped when the investor has no range", () => {
    const breakdown = explainMatch(investor(), company());
    expect(breakdown.factors.map((f) => f.key)).toEqual([
      "sector", "stage", "geography", "checkSize", "investorType", "capitalType", "activeRating", "arr", "mrr",
    ]);
    expect(breakdown.factors.find((f) => f.key === "capitalType")?.counted).toBe(true);
    expect(breakdown.factors.find((f) => f.key === "mrr")?.counted).toBe(false);
    expect(breakdown.factors.find((f) => f.key === "arr")?.counted).toBe(true);
  });

  it("uses the configured weights", () => {
    const weights = { ...DEFAULT_ENGINE_WEIGHTS, sector: 50 };
    const line = explainMatch(investor(), company(), weights).factors.find((f) => f.key === "sector");
    expect(line?.weight).toBe(50);
    expect(line?.points).toBe(50);
  });
});

describe("several preferred bands", () => {
  it("splits on semicolons and pipes, never on commas", () => {
    expect(splitBandList("$500k – $1M; $1M – $5M")).toEqual(["$500k – $1M", "$1M – $5M"]);
    expect(splitBandList("$1,000,000 - $5,000,000")).toEqual(["$1,000,000 - $5,000,000"]);
    expect(splitBandList(null)).toEqual([]);
    expect(joinBandList(["$500k – $1M", " $1M – $5M "])).toBe("$500k – $1M; $1M – $5M");
  });

  it("matches when the founder's band overlaps any one of them", () => {
    const inv = investor({ preferred_arr_range: "Under $100k; $500k – $1M" });
    const arr = explainMatch(inv, company({ arrBand: "$500k – $1M" })).factors.find((f) => f.key === "arr");
    expect(arr?.points).toBe(DEFAULT_ENGINE_WEIGHTS.arr);
  });

  it("misses when it overlaps none", () => {
    const inv = investor({ preferred_arr_range: "Under $100k; $5M+" });
    const arr = explainMatch(inv, company({ arrBand: "$500k – $1M" })).factors.find((f) => f.key === "arr");
    expect(arr?.evaluated).toBe(true);
    expect(arr?.points).toBe(0);
  });

  it("scores a single band exactly as before", () => {
    const inv = investor({ preferred_mrr_range: "$10k – $50k" });
    const mrr = explainMatch(inv, company()).factors.find((f) => f.key === "mrr");
    expect(mrr?.points).toBe(DEFAULT_ENGINE_WEIGHTS.mrr);
  });

  it("still compares an exact founder figure", () => {
    const inv = investor({ preferred_arr_range: "$100k – $500k; $1M – $5M" });
    const co = company({ arrBand: null, arr: 2_000_000 });
    expect(explainMatch(inv, co).factors.find((f) => f.key === "arr")?.points).toBe(DEFAULT_ENGINE_WEIGHTS.arr);
  });
});
