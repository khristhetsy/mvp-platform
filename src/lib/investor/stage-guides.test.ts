import { describe, expect, it } from "vitest";
import {
  buildInvestorGuideView,
  getInvestorStageGuide,
  INVESTOR_STAGE_SLUGS,
  type InvestorGuideSignals,
} from "./stage-guides";

const base: InvestorGuideSignals = {
  profileComplete: true,
  approved: true,
  kycVerified: false,
  kycDocsComplete: false,
  watchlistCount: 0,
  interestCount: 0,
  introCount: 0,
  hasCommitment: false,
};

const view = (slug: string, stage: "onboard" | "verify" | "access" | "manage", s = base) =>
  buildInvestorGuideView(getInvestorStageGuide(slug)!, s, stage);

describe("investor stage guides", () => {
  it("has a guide for every slug and rejects unknown slugs", () => {
    for (const slug of INVESTOR_STAGE_SLUGS) expect(getInvestorStageGuide(slug)).not.toBeNull();
    expect(getInvestorStageGuide("nope")).toBeNull();
  });

  it("marks earlier stages complete, the current stage current, later stages locked", () => {
    expect(view("onboarding", "verify").stageStatus).toBe("complete");
    expect(view("verification", "verify").stageStatus).toBe("current");
    expect(view("access", "verify").stageStatus).toBe("locked");
  });

  it("points the current step at the first unfinished tracked step", () => {
    const v = view("verification", "verify");
    expect(v.steps.map((s) => s.state)).toEqual(["current", "open"]);
    expect(v.gate?.cleared).toBe(false);
  });

  it("locks every step in a locked stage and reports 100% for a complete one", () => {
    expect(view("access", "onboard").steps.every((s) => s.state === "locked")).toBe(true);
    expect(view("onboarding", "access").percent).toBe(100);
    expect(view("onboarding", "access").gate?.cleared).toBe(true);
  });

  it("unlocks Stage 4 only on an SPV commitment", () => {
    const open = view("access", "access");
    expect(open.gate?.items[0].met).toBe(false);
    const done = view("access", "access", { ...base, hasCommitment: true });
    expect(done.gate?.items[0].met).toBe(true);
  });

  it("shows watchlist count as step detail", () => {
    const v = view("access", "access", { ...base, watchlistCount: 2 });
    expect(v.steps[1].state).toBe("done");
    expect(v.steps[1].detail).toBe("2 saved");
  });

  it("has no gate on the final stage", () => {
    expect(view("manage", "manage").gate).toBeNull();
  });
});
