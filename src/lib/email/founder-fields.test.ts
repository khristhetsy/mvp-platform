import { describe, expect, it } from "vitest";
import { addTermLine, hasTermLine, removeTermLine, termLine } from "./founder-fields";

const all = "Raise: $500k - $1m\nFunding stage: Pre-Seed\nCapital type: Equity Capital\nRevenue: Pre-revenue\nUse of funds: Pre-seed capital";

describe("founder terms lines", () => {
  it("builds the line the founder fill uses", () => {
    expect(termLine("raise", "$500k - $1m (request) · range $500k - $1m")).toBe("Raise: $500k - $1m");
    expect(termLine("funding_stage", "Pre-Seed · operating: Startup")).toBe("Funding stage: Pre-Seed");
  });
  it("removes one line and keeps the rest", () => {
    const out = removeTermLine(all, "revenue");
    expect(hasTermLine(out, "revenue")).toBe(false);
    expect(out.split("\n")).toHaveLength(4);
  });
  it("adds a line back in its usual place, keeping typed lines", () => {
    const typed = `${removeTermLine(all, "funding_stage")}\nInterest: 8%`;
    const back = addTermLine(typed, "funding_stage", "Pre-Seed · operating: Startup");
    expect(back.split("\n")).toEqual(["Raise: $500k - $1m", "Funding stage: Pre-Seed", "Capital type: Equity Capital", "Revenue: Pre-revenue", "Use of funds: Pre-seed capital", "Interest: 8%"]);
    expect(addTermLine(back, "raise", "$1m")).toBe(back);
    expect(addTermLine("", "raise", "$1m")).toBe("Raise: $1m");
  });
});
