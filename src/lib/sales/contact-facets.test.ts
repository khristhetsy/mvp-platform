import { describe, it, expect } from "vitest";
import { aggregateFacetRows } from "./contact-facets";

describe("aggregateFacetRows", () => {
  it("collects distinct, sorted values across rows", () => {
    const rows = [
      { industries: ["Healthcare", "Industrial"], capital: ["Equity"] },
      { industries: ["Industrial", "Information Technology"], capital: ["Debt", "Equity"] },
    ];
    const f = aggregateFacetRows(rows);
    expect(f.industries).toEqual(["Healthcare", "Industrial", "Information Technology"]);
    expect(f.capital).toEqual(["Debt", "Equity"]);
  });

  it("ignores null/non-array facet values", () => {
    const rows = [{ industries: null }, { industries: "Healthcare" }, { capital: undefined }];
    const f = aggregateFacetRows(rows);
    expect(f.industries).toEqual([]);
    expect(f.capital).toEqual([]);
  });

  it("trims whitespace and drops empties", () => {
    const f = aggregateFacetRows([{ fundingStages: ["  Seed  ", "", "   "] }]);
    expect(f.fundingStages).toEqual(["Seed"]);
  });

  it("coerces non-string array items to trimmed strings", () => {
    const f = aggregateFacetRows([{ capital: [3, 5, 3] }]);
    expect(f.capital).toEqual(["3", "5"]);
  });

  it("returns all five facet keys even when empty", () => {
    const f = aggregateFacetRows([]);
    expect(Object.keys(f).sort()).toEqual(["capital", "fundingStages", "industries", "investorTypes", "operatingStages"]);
    expect(f.operatingStages).toEqual([]);
  });
});
