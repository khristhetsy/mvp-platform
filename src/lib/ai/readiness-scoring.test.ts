import { describe, it, expect } from "vitest";
import { scoreCompanyReadiness, readAsTypes } from "./readiness-scoring";

const base = { companyName: "Acme", industry: "SaaS", revenueStage: "early_revenue", fundingAmount: 1_000_000 };

function score(docs: Array<{ type: string; summary: string }>) {
  return scoreCompanyReadiness({
    ...base,
    documentSummaries: docs,
    uploadedDocumentTypes: docs.map((d) => d.type),
  });
}

const CAP = { type: "CAP_TABLE", summary: "Cap table: founders 80%, option pool 10%, angels 10%." };

describe("governance reads incorporation papers under their upload types", () => {
  it("CORPORATE_DOCUMENTS lifts governance above the missing-incorporation cap of 4", async () => {
    const without = await score([CAP]);
    const withCorp = await score([CAP, { type: "CORPORATE_DOCUMENTS", summary: "Certificate of incorporation, Delaware C-corp, and bylaws." }]);
    expect(without.factorScores.governance_legal.pts).toBeLessThanOrEqual(4);
    expect(withCorp.factorScores.governance_legal.pts).toBeGreaterThan(4);
  });

  it("LEGAL_DOCUMENTS counts only when the summary describes formation papers", () => {
    expect(readAsTypes("LEGAL_DOCUMENTS", "Signed mutual NDA with a prospective partner.")).toEqual(["LEGAL_DOCUMENTS"]);
    expect(readAsTypes("LEGAL_DOCUMENTS", "LLC operating agreement and certificate of formation.")).toContain("INCORPORATION_DOCS");
  });
});

describe("factors read the supporting upload types", () => {
  it("TEAM_BIOS feeds founder depth", async () => {
    const deck = { type: "PITCH_DECK", summary: "Pitch deck for a B2B product." };
    const a = await score([deck]);
    const b = await score([deck, { type: "TEAM_BIOS", summary: "Co-founder and CTO, previously founded and sold a startup; advisory board of three." }]);
    expect(b.factorScores.founder_team.pts).toBeGreaterThan(a.factorScores.founder_team.pts);
  });

  it("CUSTOMER_CONTRACTS feeds traction", async () => {
    const deck = { type: "PITCH_DECK", summary: "Pitch deck for a B2B product." };
    const a = await score([deck]);
    const b = await score([deck, { type: "CUSTOMER_CONTRACTS", summary: "Signed master services agreement with a paying customer, $120,000 annual contract; LOI from a second customer." }]);
    expect(b.factorScores.customer_traction.pts).toBeGreaterThan(a.factorScores.customer_traction.pts);
  });

  it("MARKET_RESEARCH feeds market evidence", async () => {
    const deck = { type: "PITCH_DECK", summary: "Pitch deck." };
    const a = await score([deck]);
    const b = await score([deck, { type: "MARKET_RESEARCH", summary: "TAM of $4 billion market, competitor analysis versus incumbent vendors, customer growth 40%." }]);
    expect(b.factorScores.market_evidence.pts).toBeGreaterThan(a.factorScores.market_evidence.pts);
  });
});

describe("every document of a type is read", () => {
  it("a second financial statement is not ignored", async () => {
    const first = { type: "FINANCIAL_STATEMENTS", summary: "Balance sheet as of year end." };
    const second = { type: "FINANCIAL_STATEMENTS", summary: "P&L: revenue $850,000, gross margin 72%, monthly burn $40,000, runway 18 months, MRR growing." };
    const a = await score([first]);
    const b = await score([first, second]);
    expect(b.totalScore).toBeGreaterThan(a.totalScore);
  });

  it("documentsUsed counts only documents a factor reads", async () => {
    const r = await score([CAP, { type: "OTHER", summary: "Miscellaneous notes." }, { type: "TEAM_BIOS", summary: "CEO bio." }]);
    expect(r.documentsUsed).toBe(2);
  });
});

describe("the IP and Moat upload feeds the IP and moat factor", () => {
  const ipDoc = {
    type: "IP_MOAT",
    summary: "Granted US patent for the scoring method, two registered trademarks, and a signed IP assignment from all founders. Switching costs and data advantage create a moat.",
  };

  it("lifts ip_moat above what a bare deck earns", async () => {
    const deck = { type: "PITCH_DECK", summary: "Pitch deck for a B2B product." };
    const a = await score([deck]);
    const b = await score([deck, ipDoc]);
    expect(b.factorScores.ip_moat.pts).toBeGreaterThan(a.factorScores.ip_moat.pts);
  });

  it("is read even when there is no deck or plan, instead of capping at 1", async () => {
    const r = await score([ipDoc]);
    expect(r.factorScores.ip_moat.pts).toBeGreaterThan(2);
  });

  it("credits ownership documented in IP and Moat files, and names them as the source", async () => {
    const r = await score([ipDoc]);
    const sub = r.factorScores.ip_moat.subScores?.find((x) => x.label === "IP / ownership documented legally");
    expect(sub?.pts).toBe(1);
    expect(r.factorScores.ip_moat.evidence.some((e) => e.src === "IP_MOAT")).toBe(true);
  });

  it("counts toward documentsUsed", async () => {
    const r = await score([ipDoc]);
    expect(r.documentsUsed).toBe(1);
  });

  it("a patent filed under Legal Documents is still not read by this factor", async () => {
    const legal = { type: "LEGAL_DOCUMENTS", summary: "Granted US patent for the scoring method." };
    const r = await score([legal]);
    expect(r.factorScores.ip_moat.pts).toBeLessThanOrEqual(1);
  });
});
