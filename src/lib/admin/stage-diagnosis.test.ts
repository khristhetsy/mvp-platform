import { describe, expect, it } from "vitest";
import { classifyStage, type ItemDiagnosis } from "@/lib/admin/stage-diagnosis";
import type { Crr } from "@/lib/crr/crr-for";
import type { FounderJourneyState, JourneyStage } from "@/lib/founder-journey/types";

const journey = (stage: JourneyStage, over: Partial<FounderJourneyState> = {}): FounderJourneyState =>
  ({
    stage,
    stageIndex: ["initialize", "qualify", "deploy", "optimize"].indexOf(stage),
    approvalStatus: null,
    approvalFeedback: null,
    pendingApproval: false,
    canRequestApproval: false,
    conditions: {
      onboardingComplete: true,
      readinessScore: 34,
      readinessQualified: false,
      requiredDocsUploaded: false,
      hasDealRoom: false,
      hasInvestorInterest: false,
    },
    ...over,
  }) as FounderJourneyState;

const crr = (score: number | null, gate = 65): Crr =>
  ({
    score,
    isOverridden: false,
    factorGaps: [],
    band: "Early",
    profile: "seed_institutional",
    profileLabel: "Seed",
    outreachUnlocked: score !== null && score >= gate,
    gate,
    pointsToGate: score === null ? gate : Math.max(0, gate - score),
    dimensions: [],
    dims: null,
    factorScores: {},
    scoredAt: null,
    version: null,
    history: [],
    documentCount: 0,
  }) as Crr;

const item = (problem: string, measured = true): ItemDiagnosis => ({
  headline: "h",
  measured,
  problem: [problem],
  missing: [],
  fixes: [],
  source: "test",
});

describe("classifyStage", () => {
  it("reports blocking when a measured item has a real problem", () => {
    const out = classifyStage({ "/a": item("Scores 34/100, 31 short.") }, journey("qualify"), "qualify", crr(34));
    expect(out.situation).toBe("blocking");
    // The banner carries the number, not just the item name — the whole point.
    expect(out.summary).toContain("34/100");
  });

  it("reports cleared when nothing measured is blocking", () => {
    const out = classifyStage(
      { "/a": item("This gate is satisfied.") },
      journey("qualify"),
      "qualify",
      crr(80),
    );
    expect(out.situation).toBe("cleared");
  });

  it("does not let an unmeasured item count as blocking", () => {
    // An item with no wired signal must never manufacture a blocker.
    const out = classifyStage({ "/a": item("Nothing reads this item's state.", false) }, journey("qualify"), "qualify", crr(80));
    expect(out.situation).toBe("cleared");
  });

  it("calls the next stage locked-near and names the exact gap", () => {
    const out = classifyStage({}, journey("qualify"), "deploy", crr(34));
    expect(out.situation).toBe("locked-near");
    expect(out.summary).toContain("65");
    expect(out.summary).toContain("31");
  });

  it("calls a stage two or more gates out locked-far", () => {
    const out = classifyStage({}, journey("qualify"), "optimize", crr(34));
    expect(out.situation).toBe("locked-far");
    expect(out.summary).toContain("2 gates back");
  });

  it("flags a cleared stage that is waiting on staff approval", () => {
    const out = classifyStage({}, journey("qualify", { pendingApproval: true }), "qualify", crr(80));
    expect(out.situation).toBe("cleared");
    expect(out.summary).toMatch(/awaiting your stage approval/i);
  });

  it("survives a company that has never been scored", () => {
    const out = classifyStage({}, journey("qualify"), "deploy", crr(null));
    expect(out.situation).toBe("locked-near");
    expect(out.summary).toBeTruthy();
  });
});
