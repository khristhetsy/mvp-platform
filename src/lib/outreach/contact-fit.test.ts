import { describe, expect, it } from "vitest";
import { contactFit, fitCompany } from "./contact-fit";

const company = fitCompany({ industry: "Fintech", fundingStage: "Seed", investorTypes: "Venture Capital" });

describe("contactFit", () => {
  it("is not scored without a company profile", () => {
    expect(fitCompany(undefined)).toBeNull();
    expect(fitCompany({ industry: null, fundingStage: null, investorTypes: null })).toBeNull();
    expect(contactFit({ id: "a", investorType: "Venture Capital", sectors: "Fintech" }, null)).toBeNull();
  });

  it("is not scored when the contact has nothing to compare", () => {
    expect(contactFit({ id: "a", investorType: null, sectors: null }, company)).toBeNull();
  });

  it("scores a matching contact higher than a non matching one", () => {
    const good = contactFit({ id: "a", investorType: "Venture Capital", sectors: "Fintech", stages: "Seed" }, company);
    const poor = contactFit({ id: "b", investorType: "Lender", sectors: "Agriculture", stages: "Series C" }, company);
    expect(good).not.toBeNull();
    expect(poor).not.toBeNull();
    expect(good as number).toBeGreaterThan(poor as number);
  });

  it("stays within 0 to 100", () => {
    const s = contactFit({ id: "a", investorType: "Venture Capital", sectors: "Fintech", stages: "Seed" }, company) as number;
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});
