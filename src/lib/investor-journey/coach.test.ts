import { describe, it, expect } from "vitest";
import { buildInvestorStageCoach, type InvestorCoachInput } from "./coach";

function input(over: Partial<InvestorCoachInput>): InvestorCoachInput {
  return { stage: "access", approvalStatus: "approved", kycStatus: "verified", ...over };
}

describe("buildInvestorStageCoach", () => {
  it("onboard: points draft profiles to onboarding", () => {
    const c = buildInvestorStageCoach(input({ stage: "onboard", approvalStatus: "draft" }));
    expect(c.action?.href).toBe("/investor/onboarding");
    expect(c.headline).toMatch(/profile/i);
  });

  it("onboard: submitted shows under-review, not a CTA to redo the profile", () => {
    const c = buildInvestorStageCoach(input({ stage: "onboard", approvalStatus: "submitted" }));
    expect(c.headline).toMatch(/review/i);
    expect(c.action?.href).toBe("/investor/opportunities");
  });

  it("verify: surfaces the score lift and points to verification", () => {
    const c = buildInvestorStageCoach(input({ stage: "verify", kycStatus: "not_started", kycMissingCount: 2 }));
    expect(c.action?.href).toBe("/investor/verification");
    expect(c.headline).toMatch(/2 more/);
    expect(c.scoreHint).toMatch(/Partner Score/);
  });

  it("verify: pending shows under-review without a score nudge", () => {
    const c = buildInvestorStageCoach(input({ stage: "verify", kycStatus: "pending" }));
    expect(c.headline).toMatch(/review/i);
    expect(c.scoreHint).toBeNull();
  });

  it("access: nudges a first move when not engaged", () => {
    const c = buildInvestorStageCoach(input({ stage: "access", hasEngaged: false }));
    expect(c.headline).toMatch(/first move/i);
    expect(c.action?.href).toBe("/investor/opportunities");
  });

  it("manage: points to the portfolio", () => {
    const c = buildInvestorStageCoach(input({ stage: "manage" }));
    expect(c.action?.href).toBe("/investor/portfolio");
  });
});
