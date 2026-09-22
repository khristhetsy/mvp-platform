/**
 * Steps worth what they say they are worth.
 */
import { describe, it, expect } from "vitest";
import { improvementSteps, moveFor, reachesGate, type FactorGap } from "@/lib/crr/improvement";

const gap = (key: FactorGap["key"], label: string, pts: number, max: number, dimension: string): FactorGap =>
  ({ key, label, pts, max, dimension });

const GAPS: FactorGap[] = [
  gap("revenue_cashflow", "Revenue & Cash Flow Trajectory", 4, 15, "Financial"),
  gap("customer_traction", "Customer Traction & LOIs", 6, 13, "Traction"),
  gap("founder_team", "Founder Integrity & Team Depth", 10, 11, "Team"),
  gap("governance_legal", "Governance & Legal Cleanliness", 1, 9, "Cap table"),
  gap("pitch_quality", "Pitch Deck & Business Plan Quality", 4, 4, "Narrative"),
];

describe("ranking what to do next", () => {
  const steps = improvementSteps(GAPS);

  it("puts the biggest gain first", () => {
    expect(steps[0].key).toBe("revenue_cashflow");
    expect(steps[0].upTo).toBe(11);
  });

  it("orders by points left, not by how low the factor scored", () => {
    // Governance is at 11% and revenue at 27%, but revenue leaves more points.
    expect(steps.map((s) => s.key)).toEqual([
      "revenue_cashflow", "governance_legal", "customer_traction", "founder_team",
    ]);
  });

  it("leaves out a factor with nothing left", () => {
    expect(steps.some((s) => s.key === "pitch_quality")).toBe(false);
  });

  it("gives every step something to actually do", () => {
    expect(steps[0].action).toBe("Upload financial statements");
    expect(steps[0].href).toBe("/founder/readiness/data-room");
  });

  it("explains the first one by its weight at this stage", () => {
    expect(steps[0].why).toContain("largest single gain");
    expect(steps[1].why).toContain("Worth up to");
  });

  it("reorders for a different stage, because the weights differ", () => {
    // At Pre-seed the team factor carries far more and revenue far less.
    const preSeed = [
      gap("revenue_cashflow", "Revenue", 1, 4, "Financial"),
      gap("founder_team", "Team", 4, 20, "Team"),
    ];
    expect(improvementSteps(preSeed)[0].key).toBe("founder_team");
  });

  it("takes only as many as asked", () => {
    expect(improvementSteps(GAPS, 2)).toHaveLength(2);
    expect(improvementSteps(GAPS, 0)).toEqual([]);
  });

  it("copes with a company that has nothing scored", () => {
    expect(improvementSteps([])).toEqual([]);
  });
});

describe("whether the list can reach the gate", () => {
  it("adds up what is on the table", () => {
    // 11 + 8 + 7 + 1 = 27.
    expect(reachesGate(improvementSteps(GAPS), 14)).toEqual({ enough: true, available: 27, shortfall: 0 });
  });

  it("says plainly when it cannot", () => {
    const thin = improvementSteps([gap("pitch_quality", "Pitch", 1, 4, "Narrative")]);
    expect(reachesGate(thin, 14)).toEqual({ enough: false, available: 3, shortfall: 11 });
  });

  it("treats an empty list as reaching nothing", () => {
    expect(reachesGate([], 5)).toEqual({ enough: false, available: 0, shortfall: 5 });
  });

  it("is already there when nothing is owed", () => {
    expect(reachesGate([], 0).enough).toBe(true);
  });
});

describe("the move behind a factor", () => {
  it("names one for every factor the engine scores", () => {
    const keys = [
      "revenue_cashflow", "customer_traction", "founder_team", "market_evidence", "unit_economics",
      "governance_legal", "ip_moat", "burn_runway", "exit_strategy", "pitch_quality",
      "deal_structure", "industry_alignment", "impact_esg",
    ] as const;
    for (const k of keys) {
      expect(moveFor(k).action.length).toBeGreaterThan(0);
      expect(moveFor(k).href.startsWith("/founder/")).toBe(true);
    }
  });
});
