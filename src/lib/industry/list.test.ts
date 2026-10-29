import { describe, expect, it } from "vitest";
import { joinIndustries, splitIndustries } from "./list";

describe("splitIndustries", () => {
  it("returns an empty array for null, undefined and blank input", () => {
    expect(splitIndustries(null)).toEqual([]);
    expect(splitIndustries(undefined)).toEqual([]);
    expect(splitIndustries("")).toEqual([]);
    expect(splitIndustries("   ")).toEqual([]);
  });

  it("keeps a single stored industry as one item", () => {
    expect(splitIndustries("Fintech")).toEqual(["Fintech"]);
  });

  it("splits a comma separated list and trims each item", () => {
    expect(splitIndustries("Fintech, Energy ,Retail")).toEqual(["Fintech", "Energy", "Retail"]);
  });

  it("ignores empty items", () => {
    expect(splitIndustries(",Fintech,, Energy, ,")).toEqual(["Fintech", "Energy"]);
  });

  it("de-duplicates while keeping first occurrence order", () => {
    expect(splitIndustries("Energy, Fintech, Energy")).toEqual(["Energy", "Fintech"]);
  });
});

describe("joinIndustries", () => {
  it("returns an empty string for no values", () => {
    expect(joinIndustries([])).toEqual("");
    expect(joinIndustries(["", "  "])).toEqual("");
  });

  it("stores a single industry exactly as today", () => {
    expect(joinIndustries(["Fintech"])).toEqual("Fintech");
  });

  it("joins with a comma and a space", () => {
    expect(joinIndustries(["Fintech", "Energy", "Retail"])).toEqual("Fintech, Energy, Retail");
  });

  it("trims, drops empties and de-duplicates", () => {
    expect(joinIndustries([" Fintech ", "", "Energy", "Fintech"])).toEqual("Fintech, Energy");
  });

  it("round trips through splitIndustries", () => {
    const list = ["Fintech", "Energy", "Retail"];
    expect(splitIndustries(joinIndustries(list))).toEqual(list);
  });
});
