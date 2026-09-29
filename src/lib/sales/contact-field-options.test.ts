import { describe, it, expect } from "vitest";
import { aggregateExactLabels, buildFieldOptions, canonicalizeIndustryOptions } from "./contact-field-options";

describe("buildFieldOptions — case-only dedupe", () => {
  it("collapses case-variant duplicates to one canonical spelling", () => {
    const rows = [
      { extra: { "Entrepreneur seeking type of investor(s)?": ["pre-series A", "Venture Capital"] } },
      { extra: { "Entrepreneur seeking type of investor(s)?": ["Pre-Series A", "Lender"] } },
    ];
    const opts = buildFieldOptions(aggregateExactLabels(rows));
    const list = opts["Entrepreneur seeking type of investor(s)?"];
    const preseries = list.filter((v) => v.toLowerCase() === "pre-series a");
    expect(preseries).toEqual(["Pre-Series A"]); // one entry, capitalized spelling wins
    expect(list).toContain("Venture Capital");
    expect(list).toContain("Lender");
  });

  it("merges investor-type synonyms into Angel Investor", () => {
    const rows = [
      { extra: { "Entrepreneur seeking type of investor(s)?": ["Accredited individuals", "Venture Capital"] } },
      { extra: { "Entrepreneur seeking type of investor(s)?": ["angels", "Angel Investor"] } },
    ];
    const opts = buildFieldOptions(aggregateExactLabels(rows));
    const list = opts["Entrepreneur seeking type of investor(s)?"];
    expect(list.filter((v) => v === "Angel Investor")).toEqual(["Angel Investor"]);
    expect(list).not.toContain("Accredited individuals");
    expect(list).not.toContain("angels");
    expect(list).toContain("Venture Capital");
  });

  it("keeps genuinely distinct options separate", () => {
    const rows = [{ extra: { "Entrepreneur funding stage?": ["Seed", "Series A"] } }];
    const opts = buildFieldOptions(aggregateExactLabels(rows));
    expect(opts["Entrepreneur funding stage?"]).toEqual(["Seed", "Series A"]);
  });

  it("drops stray pure-number option values from every field", () => {
    const rows = [{ extra: { "Entrepreneur seeking type(s) of capital?": ["Equity", "1", "2", "Convertible note", "7"] } }];
    const opts = buildFieldOptions(aggregateExactLabels(rows));
    expect(opts["Entrepreneur seeking type(s) of capital?"]).toEqual(["Convertible note", "Equity"]);
  });
});

describe("canonicalizeIndustryOptions — Industries picker cleanup", () => {
  it("drops stray Odoo number-ids and merges variants", () => {
    const out = canonicalizeIndustryOptions({
      Industries: ["20", "29", "3", "30", "33", "41", "42", "7", "9", "Business Service", "business services", "hospitality", "SaaS", "Other"],
    });
    // No pure-number ids survive.
    expect(out.Industries.filter((v) => /^\d+$/.test(v))).toEqual([]);
    // Business Service(s) collapse to one canonical label.
    expect(out.Industries.filter((v) => v === "Business Services")).toEqual(["Business Services"]);
    // Hospitality canon-cased, present once.
    expect(out.Industries).toContain("Hospitality");
    expect(out.Industries).toContain("SaaS");
    // "Other" sorts last.
    expect(out.Industries[out.Industries.length - 1]).toBe("Other");
  });

  it("leaves other fields untouched and returns the same object when no Industries key", () => {
    const input = { "Entrepreneur funding stage?": ["Seed"] };
    expect(canonicalizeIndustryOptions(input)).toBe(input);
  });
});
