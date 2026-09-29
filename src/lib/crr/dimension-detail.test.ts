import { describe, expect, it } from "vitest";
import type { FactorKey } from "@/lib/ai/readiness-scoring";
import { BASE_FACTOR_MAX, CODE_DEFAULT_SET, totalWith, type StoredFactor } from "@/lib/crr/weight-sets";
import {
  allGaps, dimensionCards, dimensionDetail, factorsIn, rankedGaps,
} from "@/lib/crr/dimension-detail";

/** Every factor at half marks against the engine's own maxima. */
function halfMarks(): Record<FactorKey, StoredFactor> {
  return Object.fromEntries(
    Object.entries(BASE_FACTOR_MAX).map(([k, max]) => [k, { pts: max / 2, max }]),
  ) as Record<FactorKey, StoredFactor>;
}
const full = (): Record<FactorKey, StoredFactor> =>
  Object.fromEntries(
    Object.entries(BASE_FACTOR_MAX).map(([k, max]) => [k, { pts: max, max }]),
  ) as Record<FactorKey, StoredFactor>;

describe("factorsIn", () => {
  it("knows which factors make up each dimension", () => {
    expect(factorsIn("traction").sort()).toEqual(["customer_traction", "market_evidence"]);
    expect(factorsIn("narrative")).toEqual(["pitch_quality"]);
    expect(factorsIn("capTable")).toHaveLength(5);
  });
});

describe("dimensionCards", () => {
  it("returns the five dimensions with the stage profile's weights", () => {
    const cards = dimensionCards(halfMarks(), CODE_DEFAULT_SET, "angel");
    expect(cards.map((c) => c.key)).toEqual(["narrative", "team", "financial", "traction", "capTable"]);
    // The weight IS the points the stage allocates, apportioned from the code profiles.
    expect(cards.find((c) => c.key === "narrative")?.weight).toBe(30); // pre-seed leans on narrative
    expect(cards.find((c) => c.key === "traction")?.weight).toBe(15);
  });

  it("weights the same company differently at a later stage", () => {
    const pre = dimensionCards(halfMarks(), CODE_DEFAULT_SET, "angel");
    const a = dimensionCards(halfMarks(), CODE_DEFAULT_SET, "seriesA_institutional");
    expect(a.find((c) => c.key === "traction")!.weight).toBeGreaterThan(pre.find((c) => c.key === "traction")!.weight);
    expect(a.find((c) => c.key === "narrative")!.weight).toBeLessThan(pre.find((c) => c.key === "narrative")!.weight);
  });

  it("contributes + headroom is the whole weight", () => {
    for (const c of dimensionCards(halfMarks(), CODE_DEFAULT_SET, "seed_institutional")) {
      expect(c.contributes + c.headroom).toBeCloseTo(c.weight, 1);
    }
  });

  it("gives a perfect company its whole weight and no headroom", () => {
    for (const c of dimensionCards(full(), CODE_DEFAULT_SET, "seed_institutional")) {
      expect(c.score).toBe(100);
      expect(c.headroom).toBe(0);
      expect(c.contributes).toBeCloseTo(c.weight, 1);
    }
  });

  it("the contributions add up to the stage score", () => {
    const factors = halfMarks();
    const total = dimensionCards(factors, CODE_DEFAULT_SET, "angel").reduce((s, c) => s + c.contributes, 0);
    expect(Math.round(total)).toBe(totalWith(factors, CODE_DEFAULT_SET.factors.angel));
  });
});

describe("dimensionDetail", () => {
  it("lists the factors inside and they sum to the dimension's points", () => {
    const d = dimensionDetail("traction", halfMarks(), CODE_DEFAULT_SET, "seed_institutional");
    expect(d.factors.map((f) => f.key).sort()).toEqual(["customer_traction", "market_evidence"]);
    // Seed allocates 25 points to Traction, so its two factors share exactly that.
    expect(d.ptsMax).toBe(25);
    expect(d.pts).toBeCloseTo(12.5, 1);
    expect(d.score).toBe(50);
  });

  it("says what the score would be if the dimension reached the target", () => {
    const d = dimensionDetail("traction", halfMarks(), CODE_DEFAULT_SET, "seed_institutional", 60);
    // Traction 50 → 60 is +10 points of dimension, weighted 25 → +2.5, rounded.
    expect(d.gainAtTarget).toBe(d.scoreAtTarget - d.scoreNow);
    expect(d.gainAtTarget).toBeGreaterThan(0);
    expect(d.scoreAtTarget).toBeGreaterThan(d.scoreNow);
  });

  it("never reports a loss when the dimension is already past the target", () => {
    const d = dimensionDetail("narrative", full(), CODE_DEFAULT_SET, "angel", 60);
    expect(d.score).toBe(100);
    expect(d.gainAtTarget).toBe(0);
  });

  it("treats a factor with no stored score as zero rather than dropping it", () => {
    const d = dimensionDetail("traction", { customer_traction: { pts: 13, max: 13 } }, CODE_DEFAULT_SET, "seed_institutional");
    expect(d.factors).toHaveLength(2);
    expect(d.factors.find((f) => f.key === "market_evidence")?.pts).toBe(0);
  });
});

describe("rankedGaps", () => {
  it("puts the factor losing the most weighted points first", () => {
    const factors = halfMarks();
    factors.customer_traction = { pts: 1, max: 13 };
    factors.market_evidence = { pts: 9, max: 10 };
    const gaps = rankedGaps("traction", factors, CODE_DEFAULT_SET, "seriesA_institutional");
    expect(gaps[0].key).toBe("customer_traction");
    expect(gaps[0].lost).toBeGreaterThan(gaps[1].lost);
  });

  it("measures the loss in profile points, so the same gap costs more at a stage that cares", () => {
    const factors = halfMarks();
    factors.customer_traction = { pts: 0, max: 13 };
    const atA = rankedGaps("traction", factors, CODE_DEFAULT_SET, "seriesA_institutional")[0].lost;
    const atPreSeed = rankedGaps("traction", factors, CODE_DEFAULT_SET, "angel")[0].lost;
    expect(atA).toBeGreaterThan(atPreSeed);
  });

  it("reports nothing lost when the dimension is perfect", () => {
    expect(rankedGaps("traction", full(), CODE_DEFAULT_SET, "angel").every((g) => g.lost === 0)).toBe(true);
  });
});

describe("allGaps", () => {
  it("ranks across every dimension and covers all 13 factors", () => {
    const gaps = allGaps(halfMarks(), CODE_DEFAULT_SET, "seed_institutional");
    expect(gaps).toHaveLength(13);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i - 1].lost).toBeGreaterThanOrEqual(gaps[i].lost);
  });

  it("the total lost plus the score is 100", () => {
    const factors = halfMarks();
    const lost = allGaps(factors, CODE_DEFAULT_SET, "angel").reduce((s, g) => s + g.lost, 0);
    expect(Math.round(lost + totalWith(factors, CODE_DEFAULT_SET.factors.angel))).toBe(100);
  });
});
