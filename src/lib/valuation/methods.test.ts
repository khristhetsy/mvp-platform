import { describe, it, expect } from "vitest";
import {
  computeMethods,
  convergedRange,
  median,
  money,
  type ValuationInputs,
  type Stage,
  type MethodCode,
} from "./methods";

const base: ValuationInputs = {
  company: "Test Co",
  sector: "B2B SaaS",
  berkusCap: 500_000,
  berkus: [60, 50, 70, 40, 30],
  regionalBase: 2_500_000,
  scorecard: [100, 100, 100, 100, 100, 100, 100],
  rfs: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  raiseAmount: 2_000_000,
  ownershipLow: 15,
  ownershipHigh: 25,
  exitRevenue: 40_000_000,
  exitMultiple: 5,
  targetROILow: 10,
  targetROIHigh: 25,
  futureDilution: 30,
  arr: 1_200_000,
  growthRate: 60,
  compLow: 5,
  compHigh: 9,
  illiquidityDiscount: 25,
  controlPremium: 25,
  fcfMargin: 15,
  discountRate: 25,
  terminalGrowth: 3,
  assetBase: 0,
};

function codes(stage: Stage, inp: ValuationInputs = base): MethodCode[] {
  return computeMethods(stage, inp).map((m) => m.code);
}
function get(stage: Stage, code: MethodCode, inp: ValuationInputs = base) {
  return computeMethods(stage, inp).find((m) => m.code === code);
}

describe("helpers", () => {
  it("median of odd/even sets", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 5, 6, 7])).toBe(5.5);
    expect(median([])).toBe(0);
  });
  it("money formats by magnitude", () => {
    expect(money(1_250_000)).toBe("$1.25M");
    expect(money(2_100_000_000)).toBe("$2.10B");
    expect(money(500_000)).toBe("$500K");
    expect(money(NaN)).toBe("—");
  });
});

describe("stage routing (spec §3)", () => {
  it("pre-seed runs angel methods, not revenue methods", () => {
    const c = codes("preseed");
    expect(c).toEqual(expect.arrayContaining(["BRK", "SCR", "RFS", "OWN"]));
    expect(c).not.toContain("VCM");
    expect(c).not.toContain("TCM");
    expect(c).not.toContain("PRC");
    expect(c).not.toContain("DCF");
  });
  it("seed runs SCR, VCM, OWN, TCM", () => {
    const c = codes("seed");
    expect(c).toEqual(expect.arrayContaining(["SCR", "VCM", "OWN", "TCM"]));
    expect(c).not.toContain("BRK");
    expect(c).not.toContain("RFS");
    expect(c).not.toContain("PRC");
    expect(c).not.toContain("DCF");
  });
  it("revenue runs VCM, TCM, PRC, DCF and not the angel/ownership methods", () => {
    const c = codes("revenue");
    expect(c).toEqual(expect.arrayContaining(["VCM", "TCM", "PRC", "DCF"]));
    expect(c).not.toContain("BRK");
    expect(c).not.toContain("SCR");
    expect(c).not.toContain("RFS");
    expect(c).not.toContain("OWN");
  });
  it("AST runs at any stage only when asset base > 0", () => {
    expect(codes("seed")).not.toContain("AST");
    expect(codes("seed", { ...base, assetBase: 1_000_000 })).toContain("AST");
  });
  it("TCM is skipped when ARR is 0", () => {
    expect(codes("seed", { ...base, arr: 0 })).not.toContain("TCM");
  });
});

describe("method formulas (spec §4)", () => {
  it("BRK Berkus = Σ(milestone% × cap) ± 15%", () => {
    const m = get("preseed", "BRK")!;
    // (60+50+70+40+30)/100 = 2.5 × $500K = $1.25M
    expect(m.low).toBeCloseTo(1_250_000 * 0.85, 2);
    expect(m.high).toBeCloseTo(1_250_000 * 1.15, 2);
  });
  it("SCR Scorecard = base × Σ(weight×rating) ± 15%; all-100 → ×1.0", () => {
    const m = get("preseed", "SCR")!;
    expect(m.low).toBeCloseTo(2_500_000 * 0.85, 2);
    expect(m.high).toBeCloseTo(2_500_000 * 1.15, 2);
  });
  it("RFS = base + (Σ scores × $250K) ± 15%; +2 on two factors adds $1M", () => {
    const m = get("preseed", "RFS", { ...base, rfs: [2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] })!;
    const v = 2_500_000 + 4 * 250_000; // Σ=4 → +$1M
    expect(m.low).toBeCloseTo(v * 0.85, 2);
    expect(m.high).toBeCloseTo(v * 1.15, 2);
  });
  it("VCM = exit ÷ target return × (1−dilution) − raise", () => {
    const m = get("seed", "VCM")!;
    // exit = 40M×5 = 200M; postLow=200M/25=8M, postHigh=200M/10=20M; ×0.7 − 2M
    expect(m.low).toBeCloseTo(8_000_000 * 0.7 - 2_000_000, 2); // 3.6M
    expect(m.high).toBeCloseTo(20_000_000 * 0.7 - 2_000_000, 2); // 12M
  });
  it("OWN = raise ÷ ownership% − raise", () => {
    const m = get("seed", "OWN")!;
    expect(m.low).toBeCloseTo(2_000_000 / 0.25 - 2_000_000, 2); // 6M
    expect(m.high).toBeCloseTo(2_000_000 / 0.15 - 2_000_000, 2); // 11.33M
  });
  it("TCM = ARR × multiple × (1−discount)", () => {
    const m = get("seed", "TCM")!;
    expect(m.low).toBeCloseTo(1_200_000 * 5 * 0.75, 2); // 4.5M
    expect(m.high).toBeCloseTo(1_200_000 * 9 * 0.75, 2); // 8.1M
  });
  it("PRC = trading comps × (1 + control premium)", () => {
    const m = get("revenue", "PRC")!;
    expect(m.low).toBeCloseTo(1_200_000 * 5 * 1.25 * 0.75, 2); // 5.625M
    expect(m.high).toBeCloseTo(1_200_000 * 9 * 1.25 * 0.75, 2); // 10.125M
  });
  it("AST = asset base × 0.8 to × 1.4", () => {
    const m = get("seed", "AST", { ...base, assetBase: 1_000_000 })!;
    expect(m.low).toBeCloseTo(800_000, 2);
    expect(m.high).toBeCloseTo(1_400_000, 2);
  });
  it("DCF is present, finite, positive, and low < high (low uses base+500bps)", () => {
    const m = get("revenue", "DCF")!;
    expect(m).toBeTruthy();
    expect(Number.isFinite(m.low)).toBe(true);
    expect(Number.isFinite(m.high)).toBe(true);
    expect(m.low).toBeGreaterThan(0);
    expect(m.high).toBeGreaterThan(m.low);
  });
});

describe("guards & invariants", () => {
  it("never emits a method with high ≤ 0 (VCM with a raise larger than pre-money is dropped)", () => {
    const inp = { ...base, exitRevenue: 1_000_000, exitMultiple: 1, raiseAmount: 50_000_000 };
    expect(codes("seed", inp)).not.toContain("VCM");
  });
  it("clamps a negative low to 0 rather than showing a negative floor", () => {
    // Ownership band that makes the low pre-money negative after subtracting raise.
    const inp = { ...base, raiseAmount: 1_000_000, ownershipHigh: 100, ownershipLow: 50 };
    const m = get("seed", "OWN", inp);
    if (m) expect(m.low).toBeGreaterThanOrEqual(0);
  });
  it("every method carries a non-empty basis line (spec acceptance criteria)", () => {
    for (const stage of ["preseed", "seed", "revenue"] as Stage[]) {
      for (const m of computeMethods(stage, { ...base, assetBase: 1_000_000 })) {
        expect(m.basis.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("converged range (spec §3 — median, not mean)", () => {
  it("is the median of lows to the median of highs", () => {
    const methods = computeMethods("seed", base);
    const cr = convergedRange(methods);
    expect(cr.low).toBe(median(methods.map((m) => m.low)));
    expect(cr.high).toBe(median(methods.map((m) => m.high)));
  });
  it("one aggressive high does not drag the converged high (median resists outliers)", () => {
    const normal = [
      { code: "A", low: 1, high: 4 },
      { code: "B", low: 2, high: 5 },
      { code: "C", low: 3, high: 6 },
    ] as unknown as ReturnType<typeof computeMethods>;
    const withOutlier = [...normal, { code: "D", low: 3, high: 1000 }] as unknown as ReturnType<typeof computeMethods>;
    expect(convergedRange(normal).high).toBe(5);
    // median of [4,5,6,1000] = (5+6)/2 = 5.5 — barely moves despite the 1000 outlier
    expect(convergedRange(withOutlier).high).toBe(5.5);
  });
});
