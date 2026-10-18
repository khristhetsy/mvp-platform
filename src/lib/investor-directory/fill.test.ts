import { describe, expect, it } from "vitest";
import { companyEmailDomain, missingFields, suggestFill } from "./fill";

const none = { investor_types: [], capital_types: [], industries: [] };

describe("companyEmailDomain", () => {
  it("returns the domain of a company address", () => expect(companyEmailDomain("Rob@Asymmetry.vc")).toBe("asymmetry.vc"));
  it("ignores free mail and bad input", () => {
    expect(companyEmailDomain("a@gmail.com")).toBeNull();
    expect(companyEmailDomain("nope")).toBeNull();
    expect(companyEmailDomain(null)).toBeNull();
  });
});

describe("suggestFill", () => {
  it("guesses venture capital and equity capital from a name and .vc domain, strong", () => {
    const f = suggestFill({ firm: "Asymmetry Ventures", email: "rob@asymmetry.vc", have: none });
    expect(f.investor_types).toMatchObject({ values: ["venture-capital"], level: "strong" });
    expect(f.capital_types).toMatchObject({ values: ["equity-capital"], level: "strong" });
  });
  it("guesses the website from a company email, strong when the name agrees", () => {
    const f = suggestFill({ firm: "Asymmetry Ventures", email: "rob@asymmetry.vc", have: none });
    expect(f.website).toMatchObject({ values: ["https://asymmetry.vc"], level: "strong" });
  });
  it("marks the website possible when the name does not match the domain", () => {
    expect(suggestFill({ firm: "Alpha Capital", email: "x@zeta.com", have: none }).website?.level).toBe("possible");
  });
  it("does not guess a website from free mail", () => {
    expect(suggestFill({ firm: "Alpha Capital", email: "x@gmail.com", have: none }).website).toBeUndefined();
  });
  it("is possible with one source and makes no guess with none", () => {
    const f = suggestFill({ firm: "Riverfront Ventures", have: none });
    expect(f.investor_types).toMatchObject({ values: ["venture-capital"], level: "possible" });
    expect(suggestFill({ firm: "Next47", have: none })).toEqual({});
  });
  it("guesses a lender and debt capital", () => {
    const f = suggestFill({ firm: "Bridge Lending Group", have: none });
    expect(f.investor_types?.values).toEqual(["lender"]);
    expect(f.capital_types?.values).toEqual(["debt-capital"]);
  });
  it("uses profile and website text", () => {
    const f = suggestFill({ firm: "Pear", website: "https://pear.vc", profile: "Seed stage venture fund for cybersecurity", siteText: "We back cyber security startups", have: none });
    expect(f.investor_types?.level).toBe("strong");
    expect(f.industries?.values).toContain("cyber-security");
    expect(f.industries?.level).toBe("strong");
  });
  it("never overwrites a field that is filled", () => {
    const f = suggestFill({ firm: "Asymmetry Ventures", website: "https://asymmetry.vc", email: "rob@asymmetry.vc", have: { investor_types: ["family-office"], capital_types: ["debt-capital"], industries: ["healthtech"] } });
    expect(f).toEqual({});
  });
  it("derives capital type from the investor type already on the record", () => {
    const f = suggestFill({ firm: "Something", have: { investor_types: ["private-equity"], capital_types: [], industries: ["software"] } });
    expect(f.capital_types).toMatchObject({ values: ["equity-capital"], level: "strong" });
  });
});

describe("missingFields", () => {
  it("lists the empty fields", () => {
    expect(missingFields({ website: null, investor_types: [], capital_types: ["equity-capital"], industries: [] })).toEqual(["industries", "investor_types", "website"]);
  });
});
