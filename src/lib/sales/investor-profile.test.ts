import { describe, it, expect } from "vitest";
import { canonicalInvestorProfile, normalizeInvestorProfiles, isInvestorProfileLabel, isListedInvestorProfile, INVESTOR_PROFILE_OPTIONS } from "./investor-profile";

describe("investor profile", () => {
  it("canonicalises Odoo aliases and keeps unknowns as typed", () => {
    expect(canonicalInvestorProfile(" vc ")).toBe("Venture Capital");
    expect(canonicalInvestorProfile("Angel")).toBe("Angel Investor");
    expect(canonicalInvestorProfile("represents investors")).toBe("Represent Investors");
    expect(canonicalInvestorProfile("Sovereign Wealth")).toBe("Sovereign Wealth");
  });
  it("splits comma-joined input, drops blanks and Odoo's false, dedupes", () => {
    expect(normalizeInvestorProfiles(["vc, angel", "Venture Capital", " ", "false"])).toEqual(["Venture Capital", "Angel Investor"]);
  });
  it("recognises every label the field has gone by", () => {
    for (const l of ["Investor type", "Investor profile", "Investor profile?", "investor type"]) expect(isInvestorProfileLabel(l)).toBe(true);
    expect(isInvestorProfileLabel("Investor investment size?")).toBe(false);
  });
  it("every option is listed and canonical to itself", () => {
    for (const o of INVESTOR_PROFILE_OPTIONS) { expect(isListedInvestorProfile(o)).toBe(true); expect(canonicalInvestorProfile(o)).toBe(o); }
  });
});
