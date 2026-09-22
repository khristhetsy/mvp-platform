/**
 * Only draw the bar when the text really says so.
 */
import { describe, it, expect } from "vitest";
import { parseUseOfFunds, unallocated } from "@/lib/founder/use-of-funds";

const REAL = `$500,000 will be deployed over [12–18 months] to accelerate growth:

1. **Sales & marketing** (~45%) — hire [first AE / growth lead], build demand generation
2. **Product & engineering** (~35%) — [key feature, e.g. integrations]
3. **Team & operations** (~20%) — [2–3 key hires in engineering/customer success]`;

describe("reading an allocation", () => {
  it("pulls the slices out of a numbered list", () => {
    expect(parseUseOfFunds(REAL)).toEqual([
      { label: "Sales & marketing", percent: 45 },
      { label: "Product & engineering", percent: 35 },
      { label: "Team & operations", percent: 20 },
    ]);
  });

  it("strips the numbering, bullets and bold markers", () => {
    expect(parseUseOfFunds("- Hiring 60%\n- Marketing 40%")).toEqual([
      { label: "Hiring", percent: 60 },
      { label: "Marketing", percent: 40 },
    ]);
  });

  it("refuses a paragraph that only mentions a percentage in passing", () => {
    expect(parseUseOfFunds("We grew 12% last quarter and will spend the round on hiring.")).toBeNull();
  });

  it("refuses a single slice — one bar is not an allocation", () => {
    expect(parseUseOfFunds("Everything goes to hiring (100%)")).toBeNull();
  });

  it("refuses slices that do not add up", () => {
    expect(parseUseOfFunds("Hiring 20%\nMarketing 15%")).toBeNull();
    expect(parseUseOfFunds("Hiring 90%\nMarketing 80%")).toBeNull();
  });

  it("allows rounding either side of 100", () => {
    expect(parseUseOfFunds("Hiring 33%\nProduct 33%\nOps 33%")).toHaveLength(3);
  });

  it("refuses an over-long label rather than printing a sentence in a legend", () => {
    const long = `${"x".repeat(45)} 50%\nOps 50%`;
    expect(parseUseOfFunds(long)).toBeNull();
  });

  it("says nothing about nothing", () => {
    expect(parseUseOfFunds("")).toBeNull();
    expect(parseUseOfFunds(null)).toBeNull();
    expect(parseUseOfFunds(undefined)).toBeNull();
  });
});

describe("what is left over", () => {
  it("reports the remainder", () => {
    expect(unallocated([{ label: "a", percent: 60 }, { label: "b", percent: 30 }])).toBe(10);
  });

  it("never goes negative", () => {
    expect(unallocated([{ label: "a", percent: 60 }, { label: "b", percent: 55 }])).toBe(0);
  });
});
