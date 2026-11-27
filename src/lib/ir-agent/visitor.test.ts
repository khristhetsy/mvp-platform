import { describe, expect, it } from "vitest";
import { prospectSummary, visitorIsInvestor } from "./visitor";

describe("visitorIsInvestor", () => {
  it("treats the investor facing agents as talking to investors", () => {
    expect(visitorIsInvestor(undefined)).toBe(true);
    expect(visitorIsInvestor("founder")).toBe(true);
    expect(visitorIsInvestor("ir")).toBe(true);
  });
  it("treats sales, marketing and deal flow agents as talking to prospects", () => {
    expect(visitorIsInvestor("sales")).toBe(false);
    expect(visitorIsInvestor("marketing")).toBe(false);
    expect(visitorIsInvestor("investor")).toBe(false);
  });
});

describe("prospectSummary", () => {
  it("reads back the visitor's own answers and skips bare yes or no taps", () => {
    expect(
      prospectSummary({
        "What does your company do?": "We are a SaaS startup, I am the founder.",
        "Are you seeking funding?": "Yes",
        "What stage?": "Pre revenue",
        "How much?": "About 2 million, closing in Q1",
      }),
    ).toBe("So: We are a SaaS startup, I am the founder; Pre revenue; About 2 million, closing in Q1.");
  });
  it("returns nothing when there is nothing to read back", () => {
    expect(prospectSummary({})).toBe("");
    expect(prospectSummary({ q: "Yes" })).toBe("");
  });
});
