import { describe, it, expect } from "vitest";
import {
  computeFounderOnboardingProgress,
  ONBOARDING_STEPS,
  REQUIRED_ONBOARDING_STEP_IDS,
} from "@/lib/onboarding/progress";
import type { Company, DocumentRecord } from "@/lib/supabase/types";

/**
 * Onboarding completes on exactly two required steps: company profile (name +
 * industry + country + description >= 20) and funding information (the amount
 * of capital band). Documents and readiness are optional and stay on the
 * checklist. The investor readiness review is never shown. A company that has
 * already completed onboarding is never reopened.
 */

function company(overrides: Partial<Company> = {}): Company {
  return {
    company_name: "Acme",
    industry: "SaaS",
    country: "United States",
    business_description: "We build software that helps teams move faster every day.",
    funding_amount: null,
    funding_amount_band: "1m_5m",
    revenue_stage: "",
    use_of_funds: "",
    founder_goals: "",
    onboarding_step_state: null,
    onboarding_completed_at: null,
    review_status: "draft",
    status: "draft",
    ...overrides,
  } as unknown as Company;
}

const NO_DOCS: DocumentRecord[] = [];
const DECK: DocumentRecord[] = [{ document_type: "PITCH_DECK" } as DocumentRecord];

function progress(c: Company, documents: DocumentRecord[] = NO_DOCS, diligenceReportExists = false) {
  return computeFounderOnboardingProgress({ company: c, documents, diligenceReportExists });
}

describe("founder onboarding completion", () => {
  it("is 100% complete with company profile + funding band only", () => {
    const p = progress(company());
    expect(p.percent).toBe(100);
    expect(p.isComplete).toBe(true);
    expect(p.requiredCompleted).toBe(2);
    expect(p.requiredTotal).toBe(2);
    expect(p.completedAt).not.toBeNull();
  });

  it("marks funding complete on the band alone, without funding_amount or revenue stage", () => {
    const p = progress(company({ funding_amount: null, revenue_stage: "" }));
    expect(p.steps.funding_information.completed).toBe(true);
  });

  it("does not count funding_amount without a band", () => {
    const p = progress(company({ funding_amount_band: null, funding_amount: 1_000_000 }));
    expect(p.steps.funding_information.completed).toBe(false);
    expect(p.percent).toBe(50);
    expect(p.isComplete).toBe(false);
    expect(p.completedAt).toBeNull();
  });

  it("does NOT require a pitch deck or a diligence report", () => {
    expect(progress(company(), NO_DOCS, false).percent).toBe(100);
    expect(progress(company(), DECK, true).percent).toBe(100);
  });

  it("keeps documents and readiness on the checklist as optional steps", () => {
    const p = progress(company(), DECK, false);
    expect(p.steps.documents_uploaded.completed).toBe(true);
    expect(p.steps.readiness_generated.completed).toBe(false);
    const optional = ONBOARDING_STEPS.filter((s) => !s.required).map((s) => s.id);
    expect(optional).toEqual(["documents_uploaded", "readiness_generated"]);
  });

  it("never shows the investor readiness review step", () => {
    expect(ONBOARDING_STEPS.map((s) => s.id)).not.toContain("investor_readiness_review");
    expect(REQUIRED_ONBOARDING_STEP_IDS).toEqual(["company_profile", "funding_information"]);
  });

  it("does NOT require founder_goals or use_of_funds", () => {
    expect(progress(company({ founder_goals: "", use_of_funds: "" })).isComplete).toBe(true);
  });

  it("is 50% when country is missing", () => {
    const p = progress(company({ country: "" }));
    expect(p.percent).toBe(50);
    expect(p.isComplete).toBe(false);
  });

  it("is incomplete when the description is shorter than 20 characters", () => {
    expect(progress(company({ business_description: "Too short" })).isComplete).toBe(false);
  });

  it("treats the auto-generated placeholder description as incomplete", () => {
    const p = progress(company({ business_description: "Company profile created automatically during onboarding." }));
    expect(p.isComplete).toBe(false);
  });

  it("is 0% with neither required step done", () => {
    const p = progress(company({ country: "", funding_amount_band: null }));
    expect(p.percent).toBe(0);
    expect(p.currentStep).toBe("company_profile");
  });

  it("points the current step at the first open required step, then the optional ones", () => {
    expect(progress(company({ funding_amount_band: null })).currentStep).toBe("funding_information");
    expect(progress(company()).currentStep).toBe("documents_uploaded");
    expect(progress(company(), DECK).currentStep).toBe("readiness_generated");
  });

  it("does not reopen a company that already completed onboarding", () => {
    const completedAt = "2026-10-01T17:00:00.000Z";
    const p = progress(
      company({
        onboarding_completed_at: completedAt,
        funding_amount_band: null,
        funding_amount: 250_000,
        onboarding_step_state: { current_step: "documents_uploaded" },
      }),
    );
    expect(p.isComplete).toBe(true);
    expect(p.percent).toBe(100);
    expect(p.completedAt).toBe(completedAt);
    expect(p.steps.funding_information.completed).toBe(true);
    expect(p.steps.funding_information.completedAt).toBe(completedAt);
  });

  it("keeps the stored completion timestamp when still complete", () => {
    const completedAt = "2026-09-15T12:00:00.000Z";
    const p = progress(company({ onboarding_completed_at: completedAt }));
    expect(p.completedAt).toBe(completedAt);
  });
});
