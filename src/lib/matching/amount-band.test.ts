/**
 * Amount of capital as a band: the vocabulary, and how check size scores it.
 */
import { describe, it, expect } from "vitest";
import { MONEY_BAND_OPTIONS, moneyBandFor, isMoneyBand } from "@/lib/profile/options";
import { buildCompanyMatchProfile } from "@/lib/matching/contact-match";
import { matchInvestorToCompany, type InvestorMatchProfile } from "@/lib/matching/investor-company-matching";
import { scoreInvestorPreferenceMatch } from "@/lib/investors/preference-match";
import { EMPTY_PREFERENCES } from "@/lib/investors/preferences";
import { companyUpdateSchema } from "@/lib/validation";

describe("the money band vocabulary", () => {
  it("is exactly the nine bands already in the contact records", () => {
    expect([...MONEY_BAND_OPTIONS]).toEqual([
      "Less than $50k",
      "$50k - $100k",
      "$100k - $250k",
      "$250k - $500k",
      "$500k - $1m",
      "$1m - $10m",
      "$10m - $50m",
      "$50m - $100m",
      "Over $100m",
    ]);
  });

  it("puts an exact amount in its band, boundaries going to the higher band", () => {
    expect(moneyBandFor(450_000)).toBe("$250k - $500k");
    expect(moneyBandFor(750_000)).toBe("$500k - $1m");
    expect(moneyBandFor(1_000_000)).toBe("$1m - $10m");
    expect(moneyBandFor(5_000_000)).toBe("$1m - $10m");
    expect(moneyBandFor(15_000_000)).toBe("$10m - $50m");
    expect(moneyBandFor(250_000)).toBe("$250k - $500k");
    expect(moneyBandFor(100_000_000)).toBe("Over $100m");
  });

  it("puts zero and negative figures in the lowest band", () => {
    expect(moneyBandFor(0)).toBe("Less than $50k");
    expect(moneyBandFor(-891_686)).toBe("Less than $50k");
  });

  it("returns null when there is no figure", () => {
    expect(moneyBandFor(null)).toBeNull();
    expect(moneyBandFor(undefined)).toBeNull();
    expect(moneyBandFor(Number.NaN)).toBeNull();
  });

  it("recognises only the exact labels", () => {
    expect(isMoneyBand("$1m - $10m")).toBe(true);
    expect(isMoneyBand("Break-even")).toBe(false);
    expect(isMoneyBand("$1M – $5M")).toBe(false);
  });
});

describe("saving the settings fields", () => {
  it("accepts a band and clears with an empty string", () => {
    const ok = companyUpdateSchema.safeParse({ funding_amount_band: "$1m - $10m", annual_ebitda: "Less than $50k" });
    expect(ok.success).toBe(true);
    const cleared = companyUpdateSchema.safeParse({ annual_ebitda: "" });
    expect(cleared.success && cleared.data.annual_ebitda).toBeNull();
  });

  it("rejects free text and invented options", () => {
    expect(companyUpdateSchema.safeParse({ annual_ebitda: "Projected EBITDA: ($230K) Year 1" }).success).toBe(false);
    expect(companyUpdateSchema.safeParse({ annual_ebitda: "Break-even" }).success).toBe(false);
    expect(companyUpdateSchema.safeParse({ funding_amount_band: "1500000" }).success).toBe(false);
  });
});

const investor = (min: number | null, max: number | null): InvestorMatchProfile => ({
  profile_id: "inv1",
  investor_type: null,
  check_size_min: min,
  check_size_max: max,
  preferred_sectors: [],
  preferred_geographies: [],
  preferred_stages: [],
  preferred_arr_range: null,
  preferred_mrr_range: null,
  approval_status: "approved",
});

const checkSize = (company: Parameters<typeof buildCompanyMatchProfile>[0], inv: InvestorMatchProfile) =>
  matchInvestorToCompany(inv, buildCompanyMatchProfile(company));

describe("check size scoring against the founder's band", () => {
  const base = { id: "c1", company_name: "Acme" };

  it("reads the band off the company row", () => {
    expect(buildCompanyMatchProfile({ ...base, funding_amount_band: "$1m - $10m" }).fundingBand).toBe("$1m - $10m");
    expect(buildCompanyMatchProfile(base).fundingBand).toBeNull();
  });

  it("fits when the band overlaps the investor's range", () => {
    const r = checkSize({ ...base, funding_amount_band: "$1m - $10m" }, investor(2_000_000, 5_000_000));
    expect(r.matchReasons).toContain("Check size fit");
  });

  it("gives partial credit just outside the range", () => {
    const r = checkSize({ ...base, funding_amount_band: "$250k - $500k" }, investor(600_000, 900_000));
    expect(r.matchReasons).toContain("Partial check size overlap");
  });

  it("does not fit when far apart", () => {
    const r = checkSize({ ...base, funding_amount_band: "Less than $50k" }, investor(5_000_000, 20_000_000));
    expect(r.missingFitReasons).toContain("Target raise outside investor check size range");
  });

  it("uses the band over a stale exact amount", () => {
    const r = checkSize({ ...base, funding_amount: 100_000, funding_amount_band: "$1m - $10m" }, investor(2_000_000, 5_000_000));
    expect(r.matchReasons).toContain("Check size fit");
  });

  it("keeps the exact amount logic when there is no band", () => {
    expect(checkSize({ ...base, funding_amount: 3_000_000 }, investor(2_000_000, 5_000_000)).matchReasons).toContain("Check size fit");
    expect(checkSize({ ...base, funding_amount: 9_000_000 }, investor(2_000_000, 5_000_000)).missingFitReasons)
      .toContain("Target raise outside investor check size range");
  });
});

describe("CRM investor preference scoring against the founder's band", () => {
  const company = { fundingAmount: null, revenue: null, revenueStage: null, useOfFunds: null, industry: null };
  const pref = (investmentSize: string[]) => ({ ...EMPTY_PREFERENCES, investmentSize });

  it("fits when the band overlaps one of the investor's bands", () => {
    const m = scoreInvestorPreferenceMatch({ ...company, fundingBand: "$250k - $500k" }, pref(["$100k - $250k", "$250k - $500k"]));
    expect(m.reasons).toContain("Check size fits the raise");
  });

  it("gives partial credit when the investor's check is a slice of a bigger round", () => {
    const m = scoreInvestorPreferenceMatch({ ...company, fundingBand: "$1m - $10m" }, pref(["$250k - $500k"]));
    expect(m.reasons).toContain("Check fits as part of the round");
  });
});
