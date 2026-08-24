import { describe, it, expect } from "vitest";
import { scoreFormD } from "./score";
import { deriveFundingStage, deriveInvestorType } from "./derive";
import { decidePromotion, normalizeName } from "./dedupe";
import type { FormDFiling } from "./types";

function filing(over: Partial<FormDFiling> = {}): FormDFiling {
  return {
    accessionNo: "a", cik: "1", formType: "D", isAmendment: false, dateFiled: "2025-08-20",
    companyName: "Acme, Inc.", phone: "512-555-0100", street1: null, street2: null, city: "Austin", state: "TX", zipCode: null,
    entityType: "Corporation", jurisdiction: "DE", yearOfInc: "2021",
    industry: "Manufacturing", isFund: false, revenueRange: "$1M-$5M", exemptions: "06c", is506c: true,
    totalOffering: 10_000_000, totalSold: 3_000_000, totalRemaining: 7_000_000, pctSold: 30, minInvestment: 100_000, investorCount: 12,
    dateFirstSale: "2025-06-01", saleYetToOccur: false, daysSinceFirstSale: 120,
    hasPlacementAgent: false, placementAgents: null, salesCommission: null,
    signerName: "Jane Doe", signerTitle: "CEO",
    relatedPersons: [
      { firstName: "Jane", middleName: null, lastName: "Doe", fullName: "Jane Doe", relationships: "Executive Officer", city: "Austin", state: "TX", isSigner: true },
      { firstName: "John", middleName: null, lastName: "Smith", fullName: "John Smith", relationships: "Director", city: "Austin", state: "TX", isSigner: false },
    ],
    filingUrl: null,
    ...over,
  };
}

describe("scoreFormD (§6)", () => {
  it("scores a strong operating lead high and stamps derived fields", () => {
    // raw = 30(rem 7M) + 30(stale 120d) + 15(traction 30%) + 15(operating+rev) + 10(no agent) + 10(phone+2principals+506c)
    //     = 110 → 100
    const r = scoreFormD(filing());
    expect(r.score).toBe(100);
    expect(r.notes).toContain("Remaining raise: 30/30");
    expect(r.notes).toContain("DERIVED funding stage: Series A");
    expect(r.notes).toContain("DERIVED investor type: Family offices, institutions");
  });

  it("penalizes funds and agented deals", () => {
    const fund = scoreFormD(filing({ isFund: true, hasPlacementAgent: true, placementAgents: "X LLC" }));
    const clean = scoreFormD(filing());
    expect(fund.score).toBeLessThan(clean.score);
  });

  it("staleness rewards the 90–365 day window most", () => {
    const stale = scoreFormD(filing({ daysSinceFirstSale: 200 })).score;
    const fresh = scoreFormD(filing({ daysSinceFirstSale: 20 })).score;
    const dead = scoreFormD(filing({ daysSinceFirstSale: 600 })).score;
    expect(stale).toBeGreaterThan(fresh);
    expect(stale).toBeGreaterThan(dead);
  });

  it("never returns a negative score", () => {
    const junk = scoreFormD(filing({ totalRemaining: 100_000, isFund: true, hasPlacementAgent: true, pctSold: 95, phone: null, is506c: false, relatedPersons: [] }));
    expect(junk.score).toBeGreaterThanOrEqual(0);
  });
});

describe("derived fields (§5)", () => {
  it("funding stage by offering size + revenue", () => {
    expect(deriveFundingStage({ totalOffering: 500_000, revenueRange: null })).toBe("Pre-seed");
    expect(deriveFundingStage({ totalOffering: 3_000_000, revenueRange: null })).toBe("Seed");
    expect(deriveFundingStage({ totalOffering: 10_000_000, revenueRange: "$1M-$5M" })).toBe("Series A");
    expect(deriveFundingStage({ totalOffering: 40_000_000, revenueRange: null })).toBe("Series B+");
    expect(deriveFundingStage({ totalOffering: null, revenueRange: null })).toBeNull();
  });

  it("investor type by exemption + minimum", () => {
    expect(deriveInvestorType({ exemptions: "04", is506c: false, minInvestment: null })).toBe("Friends and family");
    expect(deriveInvestorType({ exemptions: "06b", is506c: false, minInvestment: 25_000 })).toBe("Accredited individuals, angels");
    expect(deriveInvestorType({ exemptions: "06c", is506c: true, minInvestment: 250_000 })).toBe("Family offices, institutions");
    expect(deriveInvestorType({ exemptions: "06c", is506c: true, minInvestment: 5_000 })).toBe("Accredited, general solicitation");
  });
});

describe("dedupe (§9)", () => {
  it("normalizes company names", () => {
    expect(normalizeName("Acme Robotics, Inc.")).toBe("acme robotics");
    expect(normalizeName("Acme Robotics LLC")).toBe("acme robotics");
  });

  it("same CIK → update (amendments make one contact, not three)", () => {
    const d = decidePromotion({ cik: "1234567", companyName: "Acme", phone: "5125550100" }, [
      { id: "c1", formdCik: "1234567", companyName: "Acme", phone: "5125550100" },
    ]);
    expect(d).toEqual({ action: "update", contactId: "c1" });
  });

  it("name+phone match → possible match (never auto-merge)", () => {
    const d = decidePromotion({ cik: "999", companyName: "Acme, Inc.", phone: "(512) 555-0100" }, [
      { id: "c2", formdCik: null, companyName: "Acme LLC", phone: "512-555-0100" },
    ]);
    expect(d).toEqual({ action: "possible_match", contactId: "c2" });
  });

  it("no match → create", () => {
    expect(decidePromotion({ cik: "999", companyName: "Zed", phone: "1" }, []).action).toBe("create");
  });
});
