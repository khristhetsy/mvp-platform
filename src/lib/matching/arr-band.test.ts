/**
 * Bands on both sides, finally comparable.
 */
import { describe, it, expect } from "vitest";
import { bandsOverlap } from "@/lib/investors/preference-match";
import { buildCompanyMatchProfile } from "@/lib/matching/contact-match";

describe("comparing two stated bands", () => {
  it("matches when they overlap", () => {
    expect(bandsOverlap("$100k – $500k", "$250k - $1m")).toBe(true);
  });

  it("does not match when they do not", () => {
    expect(bandsOverlap("Under $100k", "$1M – $5M")).toBe(false);
  });

  it("handles an open-ended band on either side", () => {
    expect(bandsOverlap("$5M+", "more than $1m")).toBe(true);
    expect(bandsOverlap("Under $100k", "over $500k")).toBe(false);
  });

  it("returns null — not false — when a side says nothing numeric", () => {
    // "None" and "Pre-revenue" carry no figure; scoring them 0 would penalise a
    // founder for answering honestly.
    expect(bandsOverlap("None", "$100k – $500k")).toBeNull();
    expect(bandsOverlap("Pre-revenue", "$100k – $500k")).toBeNull();
    expect(bandsOverlap("", "$100k – $500k")).toBeNull();
    expect(bandsOverlap("$100k – $500k", null)).toBeNull();
  });
});

describe("reading ARR off a company row", () => {
  const base = { id: "c1", company_name: "Acme" };

  it("takes the band the founder picked in settings", () => {
    const p = buildCompanyMatchProfile({ ...base, arr: "$100k – $500k", mrr: "$10k – $50k" });
    expect(p.arrBand).toBe("$100k – $500k");
    expect(p.mrrBand).toBe("$10k – $50k");
    expect(p.arr).toBeNull();
  });

  it("still takes an exact figure from a CRM contact", () => {
    const p = buildCompanyMatchProfile({ ...base, arr: 240_000 });
    expect(p.arr).toBe(240_000);
    expect(p.arrBand).toBeNull();
  });

  it("leaves both null when the founder said nothing", () => {
    const p = buildCompanyMatchProfile(base);
    expect(p.arr).toBeNull();
    expect(p.arrBand).toBeNull();
  });
});
