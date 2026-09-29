import { describe, expect, it } from "vitest";
import { GATE_DEFS } from "@/lib/notifications/stage-gate-reminders";
import type { StageConditions } from "@/lib/founder-journey/types";

function conditions(over: Partial<StageConditions> = {}): StageConditions {
  return {
    onboardingComplete: true,
    readinessScore: 78,
    readinessQualified: true,
    crrScore: 32,
    crrQualified: false,
    requiredDocsUploaded: true,
    hasDealRoom: false,
    hasInvestorInterest: false,
    ...over,
  };
}

const gate = (key: string) => {
  const g = GATE_DEFS.find((d) => d.key === key);
  if (!g) throw new Error(`no gate ${key}`);
  return g;
};

/**
 * `shouldAdvanceDeployToOptimize` reads `hasDealRoom || hasInvestorInterest`.
 * The reminders used to treat them as independent, so a founder with a deal room
 * still got chased to log an investor interest that would change nothing.
 */
describe("deal room and investor interest are alternatives", () => {
  it("chases both when the founder has neither", () => {
    const c = conditions();
    expect(gate("dealroom").met(c)).toBe(false);
    expect(gate("interest").met(c)).toBe(false);
  });

  it("stops chasing the interest once a deal room exists", () => {
    const c = conditions({ hasDealRoom: true });
    expect(gate("dealroom").met(c)).toBe(true);
    expect(gate("interest").met(c)).toBe(true);
  });

  it("stops chasing the deal room once an interest is logged", () => {
    const c = conditions({ hasInvestorInterest: true });
    expect(gate("dealroom").met(c)).toBe(true);
    expect(gate("interest").met(c)).toBe(true);
  });
});

describe("gate copy names the stage, not the internal key", () => {
  it("never leaks deploy/optimize to the founder", () => {
    for (const g of GATE_DEFS) {
      const copy = `${g.label} ${g.detail} ${g.ask} ${g.steps.join(" ")}`;
      expect(copy, g.key).not.toMatch(/\bdeploy\b/i);
      expect(copy, g.key).not.toMatch(/\boptimize\b/i);
      expect(copy, g.key).not.toMatch(/\bqualify\b/i);
      expect(copy, g.key).not.toMatch(/\binitialize\b/i);
    }
  });
});
