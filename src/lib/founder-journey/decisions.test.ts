import { describe, it, expect } from "vitest";
import {
  shouldAdvanceInitializeToQualify,
  shouldAutoRequestReview,
  shouldAdvanceDeployToOptimize,
} from "@/lib/founder-journey/decisions";
import type { StageConditions } from "@/lib/founder-journey/types";

function conditions(overrides: Partial<StageConditions> = {}): StageConditions {
  return {
    onboardingComplete: false,
    readinessScore: 0,
    readinessQualified: false,
    requiredDocsUploaded: false,
    hasDealRoom: false,
    hasInvestorInterest: false,
    ...overrides,
  };
}

describe("initialize → qualify", () => {
  it("advances when onboarding is complete", () => {
    expect(shouldAdvanceInitializeToQualify("initialize", conditions({ onboardingComplete: true }))).toBe(true);
  });
  it("does not advance when onboarding is incomplete", () => {
    expect(shouldAdvanceInitializeToQualify("initialize", conditions({ onboardingComplete: false }))).toBe(false);
  });
  it("does nothing when already past initialize", () => {
    expect(shouldAdvanceInitializeToQualify("qualify", conditions({ onboardingComplete: true }))).toBe(false);
  });
});

describe("qualify → deploy auto-request", () => {
  const met = conditions({ readinessQualified: true, requiredDocsUploaded: true });

  it("auto-requests when requirements are met and never reviewed", () => {
    expect(shouldAutoRequestReview("qualify", met, null)).toBe(true);
  });
  it("does NOT re-request when already pending (idempotent)", () => {
    expect(shouldAutoRequestReview("qualify", met, "pending")).toBe(false);
  });
  it("does NOT re-request when already approved", () => {
    expect(shouldAutoRequestReview("qualify", met, "approved")).toBe(false);
  });
  it("does NOT auto-resubmit after a rejection (no override loop)", () => {
    expect(shouldAutoRequestReview("qualify", met, "rejected")).toBe(false);
  });
  it("does not request without readiness ≥ 75", () => {
    expect(shouldAutoRequestReview("qualify", conditions({ requiredDocsUploaded: true }), null)).toBe(false);
  });
  it("does not request without the core documents", () => {
    expect(shouldAutoRequestReview("qualify", conditions({ readinessQualified: true }), null)).toBe(false);
  });
  it("does nothing outside the qualify stage", () => {
    expect(shouldAutoRequestReview("initialize", met, null)).toBe(false);
  });
});

describe("deploy → optimize", () => {
  it("advances with a deal room", () => {
    expect(shouldAdvanceDeployToOptimize("deploy", conditions({ hasDealRoom: true }))).toBe(true);
  });
  it("advances with investor interest", () => {
    expect(shouldAdvanceDeployToOptimize("deploy", conditions({ hasInvestorInterest: true }))).toBe(true);
  });
  it("does not advance with neither", () => {
    expect(shouldAdvanceDeployToOptimize("deploy", conditions())).toBe(false);
  });
  it("does nothing outside the deploy stage", () => {
    expect(shouldAdvanceDeployToOptimize("qualify", conditions({ hasDealRoom: true }))).toBe(false);
  });
});
