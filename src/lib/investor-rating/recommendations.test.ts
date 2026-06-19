import { describe, it, expect } from "vitest";
import { buildPartnerRecommendations } from "./recommendations";
import type { PartnerScore, PartnerPillars, PartnerFacts } from "./types";

function makeScore(
  pillars: Partial<PartnerPillars> = {},
  facts: Partial<PartnerFacts> = {},
  status: PartnerScore["status"] = "rated",
): PartnerScore {
  return {
    status,
    tier: "active",
    score: status === "new" ? null : 55,
    sampleSize: status === "new" ? 1 : 5,
    pillars: {
      followThrough: 80,
      responsiveness: 80,
      credibility: 80,
      portfolioReadiness: 60,
      trackRecord: 80,
      ...pillars,
    },
    facts: {
      conversionRate: 0.8,
      pledgeHonorRate: 0.8,
      ghostRate: 0.05,
      replyRate: 0.9,
      medianResponseHours: 20,
      accredited: true,
      closedDeals: 2,
      backedReadinessAvg: 75,
      daysSinceLastActive: 5,
      ...facts,
    },
  };
}

describe("buildPartnerRecommendations", () => {
  it("guides a new investor toward engaging founders and completing their profile", () => {
    const recs = buildPartnerRecommendations(makeScore({}, {}, "new"));
    expect(recs.map((r) => r.pillar)).toContain("onboarding");
    expect(recs.map((r) => r.pillar)).toContain("credibility");
  });

  it("returns nothing when every actionable pillar is healthy", () => {
    const recs = buildPartnerRecommendations(makeScore());
    expect(recs).toHaveLength(0);
  });

  it("flags follow-through with ghost-specific guidance when ghosting is high", () => {
    const recs = buildPartnerRecommendations(
      makeScore({ followThrough: 40 }, { ghostRate: 0.4 }),
    );
    const ft = recs.find((r) => r.pillar === "followThrough");
    expect(ft).toBeDefined();
    expect(ft?.detail.toLowerCase()).toContain("haven't followed up");
  });

  it("flags responsiveness with reply-specific guidance when reply rate is low", () => {
    const recs = buildPartnerRecommendations(
      makeScore({ responsiveness: 35 }, { replyRate: 0.3 }),
    );
    const resp = recs.find((r) => r.pillar === "responsiveness");
    expect(resp?.detail.toLowerCase()).toContain("waiting on a reply");
  });

  it("recommends verification when an investor is not accredited", () => {
    const recs = buildPartnerRecommendations(
      makeScore({ credibility: 30 }, { accredited: false }),
    );
    const cred = recs.find((r) => r.pillar === "credibility");
    expect(cred?.detail.toLowerCase()).toContain("verification");
  });

  it("never recommends on the descriptive pillars (portfolio / track record)", () => {
    const recs = buildPartnerRecommendations(
      makeScore({ portfolioReadiness: 10, trackRecord: 10 }),
    );
    expect(recs.map((r) => r.pillar)).not.toContain("portfolioReadiness");
    expect(recs.map((r) => r.pillar)).not.toContain("trackRecord");
  });

  it("orders recommendations by impact (weight × gap)", () => {
    // follow-through (35% weight) at 40 outranks credibility (20%) at 40.
    const recs = buildPartnerRecommendations(
      makeScore({ followThrough: 40, credibility: 40 }),
    );
    expect(recs[0].pillar).toBe("followThrough");
  });
});
