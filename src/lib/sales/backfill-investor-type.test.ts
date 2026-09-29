import { describe, it, expect } from "vitest";
import { decideInvestorTypes, odooInvestorTypes, isFormD, splitMulti, FORM_D_TYPES } from "./backfill-investor-type";

describe("splitMulti", () => {
  it("splits on comma, slash, semicolon, and 'and'", () => {
    expect(splitMulti("Venture Capital, Fund Manager")).toEqual(["Venture Capital", "Fund Manager"]);
    expect(splitMulti("Venture Capital and Fund Manager")).toEqual(["Venture Capital", "Fund Manager"]);
    expect(splitMulti("Angel / VC")).toEqual(["Angel", "VC"]);
  });
});

describe("odooInvestorTypes", () => {
  it("auto-detects a profile-ish extra label", () => {
    expect(odooInvestorTypes({ extra: { "Investor Profile": "Family Office" } })).toEqual({ types: ["Family Office"], label: "Investor Profile" });
    expect(odooInvestorTypes({ extra: { "Type of Investor": ["Angel Investor"] } }).types).toEqual(["Angel Investor"]);
  });
  it("honors a forced label", () => {
    expect(odooInvestorTypes({ extra: { "X Studio Foo": "Venture Capital" } }, "X Studio Foo").types).toEqual(["Venture Capital"]);
  });
  it("returns none when no matching label", () => {
    expect(odooInvestorTypes({ extra: { Industry: "FinTech" } })).toEqual({ types: [], label: null });
  });
});

describe("isFormD", () => {
  it("matches source formd or a Form D lead source", () => {
    expect(isFormD({ source: "formd" })).toBe(true);
    expect(isFormD({ source: "odoo", raw: { __profile: { leadSource: "SEC Form D" } } })).toBe(true);
    expect(isFormD({ source: "odoo" })).toBe(false);
  });
});

describe("decideInvestorTypes", () => {
  it("Form D is authoritative → Venture Capital + Fund Manager", () => {
    const d = decideInvestorTypes({ source: "formd", raw: { __profile: { extra: {} } } });
    expect(d.types).toEqual([...FORM_D_TYPES]);
    expect(d).toMatchObject({ from: "formd", write: true });
  });
  it("Form D replaces a wrong prior type (removes Family Office)", () => {
    const d = decideInvestorTypes({ source: "formd", raw: { __profile: { investorTypes: ["Family Office"] } } });
    expect(d.types).toEqual([...FORM_D_TYPES]);
    expect(d).toMatchObject({ from: "formd", write: true });
  });
  it("Form D already correct → no write", () => {
    const d = decideInvestorTypes({ source: "formd", raw: { __profile: { investorTypes: ["Venture Capital", "Fund Manager"] } } });
    expect(d).toMatchObject({ from: "formd", write: false });
  });
  it("non-Form-D: Odoo profile wins", () => {
    const d = decideInvestorTypes({ source: "odoo", raw: { __profile: { extra: { "Investor Profile": "Private Equity" } } } });
    expect(d).toMatchObject({ types: ["Private Equity"], from: "odoo", write: true });
  });
  it("fill-blanks: leaves an existing type untouched", () => {
    const d = decideInvestorTypes({ source: "odoo", raw: { __profile: { investorTypes: ["Angel Investor"], extra: { "Investor Profile": "VC" } } } });
    expect(d).toMatchObject({ from: "existing", write: false });
  });
  it("no source → no write", () => {
    expect(decideInvestorTypes({ source: "odoo", raw: { __profile: { extra: {} } } })).toMatchObject({ from: "none", write: false });
  });
});
