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
    kycVerified: true,
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
      inputs({ kycVerified: true, profileCompleteness: 1, amountPledgesMade: 0, pledgesWithinRange: 0 }),
    );
    expect(p.credibility).toBe(100); // 50(verified) + 30(profile) + 20(neutral consistency)
  });

  it("makes verified KYC the dominant credibility signal over self-attestation", () => {
    const base = { profileCompleteness: 1, amountPledgesMade: 0, pledgesWithinRange: 0 };
    const verified = computePillars(inputs({ ...base, kycVerified: true, accredited: true }));
    const selfAttested = computePillars(inputs({ ...base, kycVerified: false, accredited: true }));
    const unverified = computePillars(inputs({ ...base, kycVerified: false, accredited: false }));
    expect(verified.credibility).toBe(100); // 50 + 30 + 20
    expect(selfAttested.credibility).toBe(57.5); // 7.5 + 30 + 20
    expect(unverified.credibility).toBe(50); // 0 + 30 + 20
    expect(verified.credibility - selfAttested.credibility).toBeGreaterThan(40);
  });

  it("lifts the overall score when an investor completes KYC verification", () => {
    const verified = computePartnerScore(inputs({ kycVerified: true }));
    const selfAttested = computePartnerScore(inputs({ kycVerified: false }));
    expect(verified.score).not.toBeNull();
    expect(selfAttested.score).not.toBeNull();
    // Credibility is 20% of the score; the ~42.5-point pillar lift ≈ +8–9 overall.
    expect((verified.score ?? 0) - (selfAttested.score ?? 0)).toBeGreaterThanOrEqual(7);
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
      kycVerified: false,
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
