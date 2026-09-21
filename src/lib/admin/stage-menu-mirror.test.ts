import { describe, expect, it } from "vitest";
import { getStageMirror } from "@/lib/admin/stage-menu-mirror";
import type { FounderJourneyState, JourneyStage, StageConditions } from "@/lib/founder-journey/types";

const STAGES: JourneyStage[] = ["initialize", "qualify", "deploy", "optimize"];

function journey(stage: JourneyStage, over: Partial<StageConditions> = {}): FounderJourneyState {
  return {
    stage,
    stageIndex: STAGES.indexOf(stage),
    approvalStatus: null,
    approvalFeedback: null,
    pendingApproval: false,
    canRequestApproval: false,
    conditions: {
      onboardingComplete: true,
      readinessScore: 78,
      readinessQualified: true,
      crrScore: 48,
      crrQualified: false,
      requiredDocsUploaded: true,
      hasDealRoom: false,
      hasInvestorInterest: false,
      ...over,
    },
  };
}

const item = (m: ReturnType<typeof getStageMirror>, label: string) =>
  m.items.find((i) => i.label === label);

/** The rule: a low CRR holds what goes out under the iCapOS name, nothing else. */
describe("Marketing menu — the CRR gate", () => {
  it("shows the CRR row as blocking when the engine gate is not met", () => {
    const m = getStageMirror(journey("deploy"), "deploy");
    expect(item(m, "Capital Readiness Rating")?.status).toBe("attention");
  });

  it("holds Automated outreach — it sends from iCapOS infrastructure", () => {
    const m = getStageMirror(journey("deploy"), "deploy");
    expect(item(m, "Automated outreach")?.status).toBe("attention");
  });

  it("leaves matches browsable — it is the introduction request that is held", () => {
    const m = getStageMirror(journey("deploy"), "deploy");
    expect(item(m, "Investor matches")?.status).toBe("partial");
    expect(item(m, "Matching Center")?.status).toBe("partial");
  });

  it("does not touch the rows the founder owns outright", () => {
    const m = getStageMirror(journey("deploy"), "deploy");
    expect(item(m, "Present at event")?.status).toBe("todo");
    expect(item(m, "Marketplace")?.status).toBe("todo");
  });

  it("counts CRR and outreach as blocking, but never the browse-only rows", () => {
    const m = getStageMirror(journey("deploy"), "deploy");
    const blocking = m.items.filter((i) => i.status === "attention" || i.status === "missing");
    expect(blocking.map((i) => i.label).sort()).toEqual([
      "Automated outreach",
      "Capital Readiness Rating",
      "Investor CRM",
    ]);
  });

  it("counts browse-only rows as measured — they have a wired signal", () => {
    const m = getStageMirror(journey("deploy"), "deploy");
    // CRR, matches, Matching Center, outreach, Investor CRM = 5 of 7.
    expect(m.measuredCount).toBe(5);
    expect(m.total).toBe(7);
  });

  it("clears every CRR-gated row once the engine unlocks outreach", () => {
    const m = getStageMirror(journey("deploy", { crrQualified: true }), "deploy");
    for (const label of ["Capital Readiness Rating", "Automated outreach", "Investor matches", "Matching Center"]) {
      expect(item(m, label)?.status, label).toBe("done");
    }
  });
});

describe("Preparation menu — the CRR row reads the CRR", () => {
  it("is blocking at a high Preparation score but a low CRR", () => {
    // The exact case that was wrong before: 78% of documents present, CRR 48.
    const m = getStageMirror(journey("qualify"), "qualify");
    expect(item(m, "Capital Readiness Rating")?.status).toBe("attention");
  });

  it("is met when the CRR clears, regardless of the document count", () => {
    const m = getStageMirror(journey("qualify", { crrQualified: true, readinessQualified: false }), "qualify");
    expect(item(m, "Capital Readiness Rating")?.status).toBe("done");
  });
});

describe("stage advancement is never gated by CRR", () => {
  it("still reaches Marketing with the gate unmet", () => {
    const m = getStageMirror(journey("deploy"), "deploy");
    expect(m.reached).toBe(true);
  });
});
