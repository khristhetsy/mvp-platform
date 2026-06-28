import { describe, it, expect } from "vitest";
import { computeFounderOnboardingProgress } from "@/lib/onboarding/progress";
import type { Company, DocumentRecord } from "@/lib/supabase/types";

/**
 * Regression coverage for the onboarding-completion bug: founders were stranded
 * below 100% because country was never collected, the funding step secretly
 * required a use_of_funds description, founder_goals was required from an optional
 * field, and documents were required. Onboarding (Stage 1) must complete on
 * exactly: company profile (name + industry + country + description>=20) and
 * funding (amount + revenue stage). Nothing else.
 */

function company(overrides: Partial<Company> = {}): Company {
  return {
    company_name: "Acme",
    industry: "SaaS",
    country: "United States",
    business_description: "We build software that helps teams move faster every day.",
    funding_amount: 1_000_000,
    revenue_stage: "early_revenue",
    use_of_funds: "",
    founder_goals: "",
    onboarding_step_state: null,
    review_status: "draft",
    status: "draft",
    ...overrides,
  } as unknown as Company;
}

const NO_DOCS: DocumentRecord[] = [];

function progress(c: Company, documents: DocumentRecord[] = NO_DOCS) {
  return computeFounderOnboardingProgress({ company: c, documents, diligenceReportExists: false });
}

describe("founder onboarding completion (Stage 1)", () => {
  it("is 100% complete with company profile + funding only — no docs, goals, or use_of_funds", () => {
    const p = progress(company());
    expect(p.percent).toBe(100);
    expect(p.isComplete).toBe(true);
  });

  it("does NOT require a pitch deck / any document", () => {
    const withDeck = progress(company(), [{ document_type: "PITCH_DECK" } as DocumentRecord]);
    const withoutDeck = progress(company(), []);
    expect(withoutDeck.percent).toBe(100);
    expect(withDeck.percent).toBe(100);
  });

  it("does NOT require founder_goals", () => {
    const p = progress(company({ founder_goals: "" }));
    expect(p.isComplete).toBe(true);
  });

  it("does NOT require use_of_funds", () => {
    const p = progress(company({ use_of_funds: "" }));
    expect(p.isComplete).toBe(true);
  });

  it("is incomplete (50%) when country is missing — the original bug", () => {
    const p = progress(company({ country: "" }));
    expect(p.percent).toBe(50);
    expect(p.isComplete).toBe(false);
  });

  it("is incomplete when the description is shorter than 20 characters", () => {
    const p = progress(company({ business_description: "Too short" }));
    expect(p.isComplete).toBe(false);
  });

  it("is incomplete when funding amount is missing or zero", () => {
    expect(progress(company({ funding_amount: 0 })).isComplete).toBe(false);
    expect(progress(company({ funding_amount: null })).isComplete).toBe(false);
  });

  it("is incomplete when the revenue stage is missing", () => {
    const p = progress(company({ revenue_stage: "" }));
    expect(p.isComplete).toBe(false);
  });

  it("is 50% with only the company profile done (no funding)", () => {
    const p = progress(company({ funding_amount: 0, revenue_stage: "" }));
    expect(p.percent).toBe(50);
  });

  it("treats the auto-generated placeholder description as incomplete", () => {
    const p = progress(company({ business_description: "Company profile created automatically during onboarding." }));
    expect(p.isComplete).toBe(false);
  });
});
