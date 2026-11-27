import { describe, expect, it } from "vitest";
import { visitorIsInvestor } from "./visitor";

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
