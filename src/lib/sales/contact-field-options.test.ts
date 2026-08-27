import { describe, it, expect } from "vitest";
import { aggregateExactLabels, buildFieldOptions } from "./contact-field-options";

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

  it("keeps genuinely distinct options separate", () => {
    const rows = [{ extra: { "Entrepreneur funding stage?": ["Seed", "Series A"] } }];
    const opts = buildFieldOptions(aggregateExactLabels(rows));
    expect(opts["Entrepreneur funding stage?"]).toEqual(["Seed", "Series A"]);
  });
});
