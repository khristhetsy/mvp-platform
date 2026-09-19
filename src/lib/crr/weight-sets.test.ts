import { describe, expect, it } from "vitest";
import { PROFILES, rollupToDimensions } from "@/lib/crr/profiles";
import type { FactorKey } from "@/lib/ai/readiness-scoring";
import {
  BASE_FACTOR_MAX, CODE_DEFAULT_SET, FACTOR_KEYS, apportionFactors, diffSets,
  dimensionShares, factorsFromStored, impactOf, nextVersionName, rollupWith, scoreWith,
  summarizeDiff, totalWith, validateSet, type StoredFactor, type WeightSet,
} from "@/lib/crr/weight-sets";

/** Half marks on every factor, scored against the engine's own maxima. */
function halfMarks(): Record<FactorKey, StoredFactor> {
  return Object.fromEntries(
    Object.entries(BASE_FACTOR_MAX).map(([k, max]) => [k, { pts: max / 2, max }]),
  ) as Record<FactorKey, StoredFactor>;
}
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
const clone = (s: WeightSet): WeightSet => JSON.parse(JSON.stringify(s));

describe("validateSet", () => {
  it("accepts the code defaults", () => {
    expect(validateSet(CODE_DEFAULT_SET)).toEqual([]);
  });

  it("rejects a stage whose factor points don't total 100", () => {
    const set = clone(CODE_DEFAULT_SET);
    set.factors.angel.burn_runway += 5;
    expect(validateSet(set).some((e) => e.includes("Pre-seed") && e.includes("105"))).toBe(true);
  });

  it("checks every stage independently", () => {
    const set = clone(CODE_DEFAULT_SET);
    set.factors.growth_institutional.burn_runway += 1;
    const errors = validateSet(set);
    expect(errors.some((e) => e.includes("Growth") && e.includes("101"))).toBe(true);
    expect(errors.some((e) => e.includes("Pre-seed"))).toBe(false);
  });

  it("rejects bands that don't descend", () => {
    const set = clone(CODE_DEFAULT_SET);
    set.bands = { strong: 50, solid: 60, developing: 40 };
    expect(validateSet(set).some((e) => e.includes("descend"))).toBe(true);
  });

  it("rejects fractional points", () => {
    const set = clone(CODE_DEFAULT_SET);
    set.factors.angel.founder_team -= 0.5;
    set.factors.angel.pitch_quality += 0.5;
    expect(validateSet(set).some((e) => e.includes("whole number"))).toBe(true);
  });
});

describe("rollupWith", () => {
  it("matches the original rollup when the maxima are unchanged", () => {
    const factors = halfMarks();
    expect(rollupWith(factors, BASE_FACTOR_MAX)).toEqual(rollupToDimensions(factors));
  });

  it("moves a dimension when its factor gains weight", () => {
    const factors = halfMarks();
    // Traction is carried by customer_traction + market_evidence; make the former perfect.
    factors.customer_traction = { pts: 13, max: 13 };
    const base = rollupWith(factors, BASE_FACTOR_MAX);
    const heavier = { ...BASE_FACTOR_MAX, customer_traction: 20, burn_runway: 1 };
    expect(rollupWith(factors, heavier).traction).toBeGreaterThan(base.traction);
  });

  it("ignores factors with no stored score", () => {
    const dims = rollupWith({ founder_team: { pts: 11, max: 11 } }, BASE_FACTOR_MAX);
    expect(dims.team).toBe(100);
    expect(dims.financial).toBe(0);
  });
});

describe("totalWith and scoreWith", () => {
  it("half marks everywhere is 50 out of 100, at every stage", () => {
    expect(totalWith(halfMarks(), BASE_FACTOR_MAX)).toBe(50);
    for (const p of ["angel", "seed_institutional", "seriesA_institutional", "growth_institutional"] as const) {
      expect(totalWith(halfMarks(), CODE_DEFAULT_SET.factors[p])).toBe(50);
    }
  });

  it("weights the dimensions", () => {
    const dims = { narrative: 100, team: 0, financial: 0, traction: 0, capTable: 0 };
    expect(scoreWith(dims, CODE_DEFAULT_SET.profiles.angel)).toBe(30);
    expect(scoreWith(dims, CODE_DEFAULT_SET.profiles.seriesA_institutional)).toBe(10);
  });
});

describe("diffSets", () => {
  it("is empty for identical sets and names what moved otherwise", () => {
    expect(diffSets(CODE_DEFAULT_SET, clone(CODE_DEFAULT_SET))).toEqual([]);
    const next = clone(CODE_DEFAULT_SET);
    next.factors.seriesA_institutional.founder_team -= 5;
    next.factors.seriesA_institutional.customer_traction += 5;
    const rows = diffSets(CODE_DEFAULT_SET, next);
    // Two factor rows, plus the two dimension shares they move.
    expect(rows.filter((r) => r.section.includes("factor points"))).toHaveLength(2);
    expect(summarizeDiff(rows)).toContain("Series A");
    expect(rows.find((r) => r.section.includes("dimension share") && r.setting === "Traction")?.delta).toBe(5);
  });
});

describe("impactOf", () => {
  const company = (id: string, before: number, beforeTotal = before) => ({
    companyId: id, company: `Co ${id}`, factors: halfMarks(),
    before, beforeTotal, hasOverride: false, profile: "seriesA_institutional" as const,
  });

  it("reports no movement when the weights are unchanged", () => {
    const snap = impactOf([company("a", 50)], CODE_DEFAULT_SET, CODE_DEFAULT_SET);
    expect(snap.rows[0].after).toBe(50);
    expect(snap.rows[0].delta).toBe(0);
    expect(snap.bandChanges).toBe(0);
  });

  it("counts gate crossings against the company's own stage score", () => {
    const perfect = Object.fromEntries(
      Object.entries(BASE_FACTOR_MAX).map(([k, max]) => [k, { pts: max, max }]),
    ) as Record<FactorKey, StoredFactor>;
    const snap = impactOf(
      [{ companyId: "a", company: "Co", factors: perfect, before: 40, beforeTotal: 40, hasOverride: false, profile: "seriesA_institutional" }],
      CODE_DEFAULT_SET, CODE_DEFAULT_SET,
    );
    expect(snap.gateUnlocks).toBe(1);
    expect(snap.rows[0].after).toBe(100);
  });

  it("averages before and after", () => {
    const snap = impactOf([company("a", 40), company("b", 60)], CODE_DEFAULT_SET, CODE_DEFAULT_SET);
    expect(snap.avgBefore).toBe(50);
    expect(snap.companies).toBe(2);
  });
});

describe("nextVersionName", () => {
  it("increments and skips names already taken", () => {
    expect(nextVersionName("crr-profiles-v1", ["crr-profiles-v1"])).toBe("crr-profiles-v2");
    expect(nextVersionName("crr-profiles-v1", ["crr-profiles-v1", "crr-profiles-v2"])).toBe("crr-profiles-v3");
    expect(nextVersionName("weights", ["weights"])).toBe("weights-v2");
  });
});

describe("apportionFactors", () => {
  it("makes each dimension land on its weight exactly, and the set on 100", () => {
    for (const p of ["angel", "seed_institutional", "seriesA_institutional", "growth_institutional"] as const) {
      const points = apportionFactors(PROFILES[p]);
      expect(sum(points)).toBe(100);
      expect(dimensionShares(points)).toEqual(PROFILES[p]);
    }
  });

  it("keeps whole numbers — largest remainder, never a fraction", () => {
    const points = apportionFactors(PROFILES.angel);
    expect(FACTOR_KEYS.every((k) => Number.isInteger(points[k]))).toBe(true);
  });

  it("splits a dimension in proportion to the engine's own maxima", () => {
    // Financial is Revenue 15 · Unit 10 · Burn 8 · Deal 3 of 36 — Revenue leads.
    const points = apportionFactors(PROFILES.growth_institutional);
    expect(points.revenue_cashflow).toBeGreaterThan(points.unit_economics);
    expect(points.unit_economics).toBeGreaterThan(points.deal_structure);
  });

  it("gives a zero-weight dimension zero points", () => {
    const points = apportionFactors({ narrative: 0, team: 40, financial: 30, traction: 20, capTable: 10 });
    expect(points.pitch_quality).toBe(0);
    expect(sum(points)).toBe(100);
  });
});

describe("factorsFromStored", () => {
  it("passes a per-stage row straight through", () => {
    const out = factorsFromStored(CODE_DEFAULT_SET.factors, CODE_DEFAULT_SET.profiles);
    expect(out).toEqual(CODE_DEFAULT_SET.factors);
  });

  it("apportions an old flat row forward using the weights saved beside it", () => {
    const out = factorsFromStored(BASE_FACTOR_MAX, PROFILES);
    expect(sum(out.angel)).toBe(100);
    expect(dimensionShares(out.angel)).toEqual(PROFILES.angel);
    expect(dimensionShares(out.growth_institutional)).toEqual(PROFILES.growth_institutional);
  });

  it("falls back to the row's own shape when no weights were saved", () => {
    const out = factorsFromStored(BASE_FACTOR_MAX, null);
    expect(sum(out.angel)).toBe(100);
    expect(out.angel).toEqual(BASE_FACTOR_MAX);
  });
});
