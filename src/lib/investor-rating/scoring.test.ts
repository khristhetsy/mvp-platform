import { describe, it, expect } from "vitest";
import { computePartnerScore, computePillars, tierFromScore } from "./scoring";
import type { PartnerScoreInputs } from "./types";

function inputs(over: Partial<PartnerScoreInputs> = {}): PartnerScoreInputs {
  return {
    sampleSize: 5,
    interestsExpressed: 10,
    dealRoomsOpened: 8,
    pledgesMade: 4,
    pledgesHonored: 3,
    ghostedCount: 1,
    founderThreads: 10,
    repliedThreads: 9,
    medianResponseHours: 18,
    daysSinceLastActive: 5,
    accredited: true,
    profileCompleteness: 1,
    amountPledgesMade: 4,
    pledgesWithinRange: 4,
    backedReadinessAvg: 75,
    closedDeals: 2,
    tenureMonths: 8,
    ...over,
  };
}

describe("tierFromScore", () => {
  it("maps score bands to tiers", () => {
    expect(tierFromScore(85)).toBe("premier");
    expect(tierFromScore(80)).toBe("premier");
    expect(tierFromScore(70)).toBe("established");
    expect(tierFromScore(50)).toBe("active");
    expect(tierFromScore(30)).toBe("emerging");
  });
});

describe("computePillars", () => {
  it("gives 100 follow-through for full conversion + honored pledges + no ghosting", () => {
    const p = computePillars(
      inputs({ interestsExpressed: 5, dealRoomsOpened: 5, pledgesMade: 2, pledgesHonored: 2, ghostedCount: 0 }),
    );
    expect(p.followThrough).toBe(100);
  });

  it("caps the ghost penalty at 30 points", () => {
    // conversion 1, honor 1, but ghostRate 0.5 -> penalty capped at 0.3 -> 100 - 30 = 70
    const p = computePillars(
      inputs({ interestsExpressed: 10, dealRoomsOpened: 10, pledgesMade: 2, pledgesHonored: 2, ghostedCount: 5 }),
    );
    expect(p.followThrough).toBe(70);
  });

  it("treats no-pledges as neutral consistency (not a penalty)", () => {
    const p = computePillars(
      inputs({ accredited: true, profileCompleteness: 1, amountPledgesMade: 0, pledgesWithinRange: 0 }),
    );
    expect(p.credibility).toBe(100); // 40 + 30 + 30(neutral)
  });

  it("uses neutral 60 for portfolio readiness when unknown", () => {
    const p = computePillars(inputs({ backedReadinessAvg: null }));
    expect(p.portfolioReadiness).toBe(60);
  });

  it("decays responsiveness for dormant investors", () => {
    const recent = computePillars(inputs({ daysSinceLastActive: 5 }));
    const dormant = computePillars(inputs({ daysSinceLastActive: 200 }));
    expect(dormant.responsiveness).toBeLessThan(recent.responsiveness);
  });
});

describe("computePartnerScore", () => {
  it("returns 'new' (no composite) below the cold-start sample threshold", () => {
    const result = computePartnerScore(inputs({ sampleSize: 2 }));
    expect(result.status).toBe("new");
    expect(result.tier).toBe("new");
    expect(result.score).toBeNull();
    // facts are still surfaced for a new investor
    expect(result.facts.replyRate).toBeCloseTo(0.9, 5);
  });

  it("computes a weighted composite for an engaged investor", () => {
    const result = computePartnerScore(inputs());
    expect(result.status).toBe("rated");
    expect(result.score).toBe(83);
    expect(result.tier).toBe("premier");
  });

  it("never produces NaN or out-of-range values for an all-zero investor", () => {
    const result = computePartnerScore({
      sampleSize: 0,
      interestsExpressed: 0,
      dealRoomsOpened: 0,
      pledgesMade: 0,
      pledgesHonored: 0,
      ghostedCount: 0,
      founderThreads: 0,
      repliedThreads: 0,
      medianResponseHours: null,
      daysSinceLastActive: null,
      accredited: false,
      profileCompleteness: 0,
      amountPledgesMade: 0,
      pledgesWithinRange: 0,
      backedReadinessAvg: null,
      closedDeals: 0,
      tenureMonths: 0,
    });
    expect(result.status).toBe("new");
    for (const v of Object.values(result.pillars)) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});
