import { describe, expect, it } from "vitest";
import { OUTREACH_GATE } from "@/lib/crr/weight-sets";
import { OUTREACH_THRESHOLD, investableCrrFrom } from "@/lib/crr/investable-score";
import type { Crr } from "@/lib/crr/crr-for";
import type { FounderJourneyState } from "@/lib/founder-journey/types";

/**
 * Guards the bug this change fixed: the founder pages gated outreach at 70
 * while the engine wrote outreach_unlocked at 65, so a page could tell a founder
 * they were unlocked while the thing that actually gates outreach disagreed.
 */
describe("the outreach gate", () => {
  it("is one number — the engine's", () => {
    expect(OUTREACH_THRESHOLD).toBe(OUTREACH_GATE);
  });
});

const crr = (over: Partial<Crr>): Crr => ({
  score: 34, isOverridden: false, band: "Early", profile: "seed_institutional",
  profileLabel: "Seed", outreachUnlocked: false, gate: OUTREACH_GATE, pointsToGate: 31,
  dimensions: [], dims: null, factorScores: {}, scoredAt: null, version: null,
  history: [], documentCount: 0, ...over,
});

const state = (readiness: number | null): FounderJourneyState =>
  ({ conditions: { readinessScore: readiness } } as unknown as FounderJourneyState);

describe("investableCrrFrom", () => {
  it("returns the engine score, not a composite of readiness and profile", () => {
    // The old formula would have produced 0.6×78 + 0.3×0 + … ≈ 47 here.
    expect(investableCrrFrom(crr({ score: 34 }), state(78), null).crr).toBe(34);
  });

  it("keeps readiness as a supporting figure rather than the score", () => {
    const out = investableCrrFrom(crr({ score: 34 }), state(78), null);
    expect(out.readiness).toBe(78);
    expect(out.crr).not.toBe(out.readiness);
  });

  it("takes outreach readiness from the engine flag, never from its own threshold", () => {
    expect(investableCrrFrom(crr({ score: 90, outreachUnlocked: false }), state(0), null).outreachReady).toBe(false);
    expect(investableCrrFrom(crr({ score: 12, outreachUnlocked: true }), state(0), null).outreachReady).toBe(true);
  });

  it("shows 0 rather than crashing when a company has never been scored", () => {
    expect(investableCrrFrom(crr({ score: null }), state(null), null).crr).toBe(0);
  });
});
