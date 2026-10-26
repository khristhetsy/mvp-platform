import { describe, expect, it } from "vitest";
import { buildOnboardingCoachContext, buildOnboardingFallbackReply } from "./onboarding-coach";
import { buildFallbackCoachReply } from "./class-assistant";
import type { FounderOnboardingProgress } from "@/lib/onboarding/progress";

function progress(profile: boolean, funding: boolean): FounderOnboardingProgress {
  const step = (completed: boolean) => ({ completed, completedAt: null });
  return {
    percent: [profile, funding].filter(Boolean).length * 50,
    completedAt: null,
    currentStep: profile ? "funding_information" : "company_profile",
    steps: {
      company_profile: step(profile),
      funding_information: step(funding),
      documents_uploaded: step(false),
      readiness_generated: step(false),
      investor_readiness_review: step(false),
    },
    pitchDeckUploaded: false,
    diligenceReportExists: false,
    isComplete: profile && funding,
  };
}

describe("onboarding coach", () => {
  it("points to the first open required step", () => {
    expect(buildOnboardingFallbackReply(progress(true, false))).toContain("Funding information");
    expect(buildOnboardingFallbackReply(progress(false, false))).toContain("Company profile");
  });

  it("says onboarding is done when both required steps are complete, and never asks for a deck", () => {
    const reply = buildOnboardingFallbackReply(progress(true, true));
    expect(reply).toContain("optional");
  });

  it("builds a context that treats the pitch deck as optional and forbids filling fields", () => {
    const ctx = buildOnboardingCoachContext({ founderName: "Maya", companyName: "Acme", progress: progress(true, false) });
    expect(ctx.coachAddendum).toContain("Open: Funding information");
    expect(ctx.coachAddendum).toContain("Done: Company profile");
    expect(ctx.coachAddendum).toContain("cannot fill in or save any field");
    expect(ctx.coachAddendum).toContain("optional for onboarding");
    expect(ctx.courseProgressPercent).toBe(50);
  });

  it("uses the onboarding fallback instead of the lesson fallback", () => {
    const ctx = buildOnboardingCoachContext({ founderName: "Maya", companyName: null, progress: progress(false, false) });
    expect(buildFallbackCoachReply({ message: "pitch deck help", ctx })).toBe(ctx.fallbackReply);
  });
});
