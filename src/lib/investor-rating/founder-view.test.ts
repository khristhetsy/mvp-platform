import { describe, it, expect } from "vitest";
import { founderFacingPartnerView } from "./founder-view";
import type { PartnerScore, PartnerFacts } from "./types";

function makeScore(facts: Partial<PartnerFacts> = {}, tier: PartnerScore["tier"] = "established"): PartnerScore {
  return {
    status: "rated",
    tier,
    score: 71,
    sampleSize: 6,
    pillars: {
      followThrough: 60,
      responsiveness: 85,
      credibility: 80,
      portfolioReadiness: 70,
      trackRecord: 75,
    },
    facts: {
      conversionRate: 0.8,
      pledgeHonorRate: 0.8,
      ghostRate: 0.05,
      replyRate: 0.9,
      medianResponseHours: 18,
      accredited: true,
      closedDeals: 3,
      backedReadinessAvg: 75,
      daysSinceLastActive: 4,
      ...facts,
    },
  };
}

describe("founderFacingPartnerView (security boundary)", () => {
  it("exposes tier + safe facts only — never the score, pillars, or coaching", () => {
    const view = founderFacingPartnerView(makeScore());
    const keys = Object.keys(view);
    expect(keys).toEqual(["tier", "tierLabel", "facts"]);
    // the raw number and pillar breakdown must not leak through
    expect(JSON.stringify(view)).not.toContain("pillars");
    expect((view as Record<string, unknown>).score).toBeUndefined();
    const factKeys = Object.keys(view.facts);
    expect(factKeys).not.toContain("conversionRate");
    expect(factKeys).not.toContain("replyRate");
  });

  it("translates response time into a soft human phrase", () => {
    expect(founderFacingPartnerView(makeScore({ medianResponseHours: 10 })).facts.repliesWithin).toBe("~1 day");
    expect(founderFacingPartnerView(makeScore({ medianResponseHours: 100 })).facts.repliesWithin).toBe("~1 week");
    expect(founderFacingPartnerView(makeScore({ medianResponseHours: null })).facts.repliesWithin).toBeNull();
  });

  it("flags recent activity within 14 days and reliable follow-through at >=70%", () => {
    const recent = founderFacingPartnerView(makeScore({ daysSinceLastActive: 3, pledgeHonorRate: 0.9 }));
    expect(recent.facts.activeRecently).toBe(true);
    expect(recent.facts.reliableFollowThrough).toBe(true);

    const stale = founderFacingPartnerView(makeScore({ daysSinceLastActive: 60, pledgeHonorRate: 0.4 }));
    expect(stale.facts.activeRecently).toBe(false);
    expect(stale.facts.reliableFollowThrough).toBe(false);
  });

  it("passes the tier and its label through", () => {
    const view = founderFacingPartnerView(makeScore({}, "premier"));
    expect(view.tier).toBe("premier");
    expect(view.tierLabel).toBe("Premier");
  });
});
