import { describe, it, expect } from "vitest";
import { parseJobTitle, planChange } from "./job-title";
import { Q5_INVESTOR_TYPE } from "@/lib/fit/options";

describe("parseJobTitle — firm", () => {
  it("splits on 'at'", () => {
    expect(parseJobTitle("Technology Investor at TA Associates").firm).toBe("TA Associates");
  });
  it("splits on @, comma, pipe and dash", () => {
    expect(parseJobTitle("Managing Partner @ Aperture Ventures").firm).toBe("Aperture Ventures");
    expect(parseJobTitle("Principal, Kestrel Family Office").firm).toBe("Kestrel Family Office");
    expect(parseJobTitle("Partner | Redwood Capital").firm).toBe("Redwood Capital");
    expect(parseJobTitle("Founder — Northwind Holdings").firm).toBe("Northwind Holdings");
  });
  it("prefers 'at' over a comma so the fuller firm survives", () => {
    expect(parseJobTitle("Partner, Investor at Acme Capital").firm).toBe("Acme Capital");
  });
  it("returns null when no separator or no firm is named", () => {
    expect(parseJobTitle("Angel Investor").firm).toBeNull();
    expect(parseJobTitle("Retired").firm).toBeNull();
    expect(parseJobTitle("").firm).toBeNull();
    expect(parseJobTitle(null).firm).toBeNull();
  });
  it("rejects phrases that aren't firms", () => {
    expect(parseJobTitle("Investor at Large").firm).toBeNull();
    expect(parseJobTitle("Partner - Self").firm).toBeNull();
    expect(parseJobTitle("Advisor at N/A").firm).toBeNull();
  });
  it("trims trailing punctuation and collapses whitespace", () => {
    expect(parseJobTitle("  Partner   at   Blue   Harbor  Ventures. ").firm).toBe("Blue Harbor Ventures");
  });
  it("does not split a hyphenated role", () => {
    expect(parseJobTitle("Co-Founder at Vega Labs").firm).toBe("Vega Labs");
  });
});

describe("parseJobTitle — investor type", () => {
  it("reads a stated type from the role or the firm name", () => {
    expect(parseJobTitle("Angel Investor").investorType).toBe("Angel");
    expect(parseJobTitle("Managing Partner @ Aperture Ventures").investorType).toBe("VC");
    expect(parseJobTitle("Partner, Blackrock Private Equity").investorType).toBe("Private Equity");
    expect(parseJobTitle("Principal, Kestrel Family Office").investorType).toBe("Family Office");
    expect(parseJobTitle("Director of Corporate Venture at Siemens").investorType).toBe("Corporate Venture");
    expect(parseJobTitle("Partner at Techstars Accelerator").investorType).toBe("Accelerator");
  });
  it("leaves type null when the title states none", () => {
    // The whole point: "Partner at TA Associates" is a PE firm, but nothing SAYS so.
    expect(parseJobTitle("Technology Investor at TA Associates").investorType).toBeNull();
    expect(parseJobTitle("Managing Director at Goldman").investorType).toBeNull();
  });
  it("does not fire on words that merely contain a type word", () => {
    expect(parseJobTitle("Partner at Los Angeles Holdings").investorType).toBeNull();
  });
  it("prefers the more specific type", () => {
    expect(parseJobTitle("Head of Corporate Venture Capital, Intel").investorType).toBe("Corporate Venture");
  });
  it("only emits values the /fit matcher can compare against", () => {
    const matchable = new Set(Q5_INVESTOR_TYPE.flatMap((o) => o.stored));
    const titles = ["Angel Investor", "Partner at X Ventures", "Partner, X Private Equity", "X Family Office", "Corporate Venture at X"];
    for (const t of titles) {
      const got = parseJobTitle(t).investorType;
      expect(got, `"${t}" -> ${got}`).not.toBeNull();
      expect(matchable).toContain(got!);
    }
  });
});

describe("planChange", () => {
  const base = { id: "c1", name: "Ian Smith", jobTitle: "Technology Investor at TA Associates", hasType: false };

  it("fills the company when it holds the contact's own name", () => {
    expect(planChange({ ...base, company: "Ian Smith" })?.newCompany).toBe("TA Associates");
  });
  it("fills the company when it is empty", () => {
    expect(planChange({ ...base, company: null })?.newCompany).toBe("TA Associates");
    expect(planChange({ ...base, company: "   " })?.newCompany).toBe("TA Associates");
  });
  it("never overwrites a real, different company name", () => {
    expect(planChange({ ...base, company: "Smith Capital Partners" })).toBeNull();
  });
  it("is case-insensitive about the name match", () => {
    expect(planChange({ ...base, company: "IAN SMITH" })?.newCompany).toBe("TA Associates");
  });
  it("does not write a type the contact already has", () => {
    const c = planChange({ ...base, company: null, jobTitle: "Angel Investor at Foo Fund", hasType: true });
    expect(c?.newType).toBeNull();
    expect(c?.newCompany).toBe("Foo Fund");
  });
  it("returns a type-only change when no firm is parseable", () => {
    const c = planChange({ ...base, company: "Ian Smith", jobTitle: "Angel Investor" })!;
    expect(c.newCompany).toBeNull();
    expect(c.newType).toBe("Angel");
  });
  it("returns null when there is nothing to do", () => {
    expect(planChange({ ...base, company: "Ian Smith", jobTitle: null })).toBeNull();
    expect(planChange({ ...base, company: "Ian Smith", jobTitle: "Retired" })).toBeNull();
  });
  it("does not set the company to the person's own name", () => {
    expect(planChange({ ...base, company: null, jobTitle: "Investor at Ian Smith" })).toBeNull();
  });
});
