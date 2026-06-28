import { describe, it, expect } from "vitest";
import {
  deriveInvestorStageKey,
  buildInvestorStageView,
  investorStageIndex,
  type InvestorStageInput,
} from "./stages";

function input(over: Partial<InvestorStageInput> = {}): InvestorStageInput {
  return { approvalStatus: "approved", kycStatus: "verified", hasCommitment: false, ...over };
}

describe("deriveInvestorStageKey", () => {
  it("is onboard until the profile is approved", () => {
    expect(deriveInvestorStageKey(input({ approvalStatus: "submitted" }))).toBe("onboard");
    expect(deriveInvestorStageKey(input({ approvalStatus: "draft", kycStatus: "verified" }))).toBe("onboard");
  });

  it("is verify when approved but KYC not verified", () => {
    expect(deriveInvestorStageKey(input({ kycStatus: "not_started" }))).toBe("verify");
    expect(deriveInvestorStageKey(input({ kycStatus: "pending" }))).toBe("verify");
  });

  it("is access when approved + verified but no commitment", () => {
    expect(deriveInvestorStageKey(input({ hasCommitment: false }))).toBe("access");
  });

  it("is manage once a commitment exists", () => {
    expect(deriveInvestorStageKey(input({ hasCommitment: true }))).toBe("manage");
  });
});

describe("buildInvestorStageView", () => {
  it("marks earlier stages complete, current current, later locked", () => {
    const view = buildInvestorStageView(input({ hasCommitment: false })); // access
    expect(view.current.key).toBe("access");
    const byKey = Object.fromEntries(view.stages.map((s) => [s.key, s.status]));
    expect(byKey.onboard).toBe("complete");
    expect(byKey.verify).toBe("complete");
    expect(byKey.access).toBe("current");
    expect(byKey.manage).toBe("locked");
  });

  it("reports terminal stage as 100%", () => {
    expect(buildInvestorStageView(input({ hasCommitment: true })).percent).toBe(100);
    expect(buildInvestorStageView(input({ approvalStatus: "draft" })).percent).toBe(0);
  });

  it("keeps stage order stable", () => {
    expect(investorStageIndex("onboard")).toBe(0);
    expect(investorStageIndex("manage")).toBe(3);
  });
});
