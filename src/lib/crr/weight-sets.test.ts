import { describe, expect, it } from "vitest";
import { rollupToDimensions } from "@/lib/crr/profiles";
import type { FactorKey } from "@/lib/ai/readiness-scoring";
import {
  CODE_DEFAULT_SET, diffSets, impactOf, nextVersionName, rollupWith, scoreWith,
  summarizeDiff, totalWith, validateSet, type StoredFactor, type WeightSet,
} from "@/lib/crr/weight-sets";

/** Half marks on every factor, scored against the code maxima. */
function halfMarks(): Record<FactorKey, StoredFactor> {
  return Object.fromEntries(
    Object.entries(CODE_DEFAULT_SET.factors).map(([k, max]) => [k, { pts: max / 2, max }]),
  ) as Record<FactorKey, StoredFactor>;
}
const clone = (s: WeightSet): WeightSet => JSON.parse(JSON.stringify(s));

describe("validateSet", () => {
  it("accepts the code defaults", () => {
    expect(validateSet(CODE_DEFAULT_SET)).toEqual([]);
  });

  it("rejects a profile that doesn't total 100", () => {
    const set = clone(CODE_DEFAULT_SET);
    set.profiles.angel.team += 5;
    expect(validateSet(set).some((e) => e.includes("Angel") && e.includes("105"))).toBe(true);
  });

  it("rejects factor points that don't total 100", () => {
    const set = clone(CODE_DEFAULT_SET);
    set.factors.burn_runway += 1;
    expect(validateSet(set).some((e) => e.includes("Factor points total 101"))).toBe(true);
  });

  it("rejects bands that don't descend", () => {
    const set = clone(CODE_DEFAULT_SET);
    set.bands = { strong: 50, solid: 60, developing: 40 };
    expect(validateSet(set).some((e) => e.includes("descend"))).toBe(true);
  });

  it("rejects fractional weights", () => {
    const set = clone(CODE_DEFAULT_SET);
    set.profiles.angel.team = 29.5;
    set.profiles.angel.narrative = 30.5;
    expect(validateSet(set).some((e) => e.includes("whole number"))).toBe(true);
  });
});

describe("rollupWith", () => {
  it("matches the original rollup when the maxima are unchanged", () => {
    const factors = halfMarks();
    expect(rollupWith(factors, CODE_DEFAULT_SET.factors)).toEqual(rollupToDimensions(factors));
  });

  it("moves a dimension when its factor gains weight", () => {
    const factors = halfMarks();
    // Traction is carried by customer_traction + market_evidence; make the former perfect.
    factors.customer_traction = { pts: 13, max: 13 };
    const base = rollupWith(factors, CODE_DEFAULT_SET.factors);
    const heavier = clone(CODE_DEFAULT_SET);
    heavier.factors.customer_traction = 20;
    heavier.factors.burn_runway = 1;
    expect(rollupWith(factors, heavier.factors).traction).toBeGreaterThan(base.traction);
  });

  it("ignores factors with no stored score", () => {
    const dims = rollupWith({ founder_team: { pts: 11, max: 11 } }, CODE_DEFAULT_SET.factors);
    expect(dims.team).toBe(100);
    expect(dims.financial).toBe(0);
  });
});

describe("totalWith and scoreWith", () => {
  it("half marks everywhere is 50 out of 100", () => {
    expect(totalWith(halfMarks(), CODE_DEFAULT_SET.factors)).toBe(50);
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
    next.profiles.seriesA_institutional.team = 10;
    next.profiles.seriesA_institutional.traction = 35;
    const rows = diffSets(CODE_DEFAULT_SET, next);
    expect(rows).toHaveLength(2);
    expect(summarizeDiff(rows)).toContain("Team 15→10");
    expect(rows.find((r) => r.setting === "Traction")?.delta).toBe(5);
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

  it("counts gate crossings off the total, not the profile score", () => {
    const heavier = clone(CODE_DEFAULT_SET);
    // Perfect marks: total goes to 100, so a company below 65 crosses the gate.
    const perfect = Object.fromEntries(
      Object.entries(CODE_DEFAULT_SET.factors).map(([k, max]) => [k, { pts: max, max }]),
    ) as Record<FactorKey, StoredFactor>;
    const snap = impactOf(
      [{ companyId: "a", company: "Co", factors: perfect, before: 40, beforeTotal: 40, hasOverride: false, profile: "seriesA_institutional" }],
      heavier, CODE_DEFAULT_SET,
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
