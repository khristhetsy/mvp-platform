import { describe, it, expect } from "vitest";
import { investorProfileFromContact } from "./contact-match";
import { EMPTY_PREFERENCES } from "@/lib/investors/preferences";
import type { ScoredInvestorContact } from "@/lib/investors/load-investor-matches";

const contact = (over: Partial<ScoredInvestorContact>): ScoredInvestorContact => ({
  id: "c1", name: "Investor", email: null, company: null, investorType: null, capitalTypes: [], sectors: [],
  preferences: { ...EMPTY_PREFERENCES, useOfFunds: ["Growth Stage"] }, match: null, ...over,
});

describe("investorProfileFromContact", () => {
  it("feeds the stage factor from Odoo funding stages, not use of funds", () => {
    expect(investorProfileFromContact(contact({ fundingStages: ["Seed Round", "Series A"] })).preferred_stages).toEqual(["Seed Round", "Series A"]);
  });
  it("leaves stage empty when the contact has no funding stages", () => {
    expect(investorProfileFromContact(contact({})).preferred_stages).toEqual([]);
  });
});
