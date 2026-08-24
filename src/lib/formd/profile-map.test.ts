import { describe, it, expect } from "vitest";
import { amountBand, revenueBand, fundingStageOption, investorTypeOptions, businessEntityStatus } from "./profile-map";

describe("amountBand", () => {
  it("buckets to existing bands", () => {
    expect(amountBand(3_179_273)).toBe("$1m - $10m");
    expect(amountBand(35_000_000)).toBe("$10m - $50m");
    expect(amountBand(750_000)).toBe("$500k - $1m");
    expect(amountBand(300_000)).toBe("$250k - $500k");
    expect(amountBand(250_000_000)).toBe("$50m - $100m");
  });
  it("returns null for missing / zero", () => {
    expect(amountBand(null)).toBeNull();
    expect(amountBand(0)).toBeNull();
  });
});

describe("fundingStageOption", () => {
  it("maps derived stages to real options", () => {
    expect(fundingStageOption("Seed")).toBe("Seed Round");
    expect(fundingStageOption("Series B+")).toBe("Series B");
    expect(fundingStageOption("Pre-Seed")).toBe("Pre-Seed");
    expect(fundingStageOption("Growth")).toBe("Series C");
    expect(fundingStageOption(null)).toBeNull();
  });
});

describe("investorTypeOptions", () => {
  it("maps accredited individuals / angels to Angel Investor", () => {
    expect(investorTypeOptions("Accredited individuals, angels")).toEqual(["Angel Investor"]);
    expect(investorTypeOptions("Venture Capital")).toEqual(["Venture Capital"]);
    expect(investorTypeOptions("")).toEqual([]);
  });
});

describe("revenueBand", () => {
  it("maps SEC brackets and declines", () => {
    expect(revenueBand("No Revenues")).toBe("Pre-revenue");
    expect(revenueBand("$1,000,001 - $5,000,000")).toBe("$1m - $10m");
    expect(revenueBand("Decline to Disclose")).toBeNull();
    expect(revenueBand(null)).toBeNull();
  });
});

describe("businessEntityStatus", () => {
  it("is always Private Held for Form D issuers", () => {
    expect(businessEntityStatus()).toBe("Private Held");
  });
});
