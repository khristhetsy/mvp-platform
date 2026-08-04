import { describe, it, expect } from "vitest";
import {
  PROFILES,
  CRR_DIMENSIONS,
  FACTOR_TO_DIMENSION,
  stageToProfile,
  rollupToDimensions,
  scoreForProfile,
  bandForProfile,
} from "./profiles";
import { READINESS_FACTORS, type FactorKey } from "@/lib/ai/readiness-scoring";

/** Build a full 13-factor scorecard; `fill` returns the pts for each factor. */
function factors(fill: (key: FactorKey, max: number) => number) {
  return Object.fromEntries(
    READINESS_FACTORS.map((f) => [f.key, { pts: fill(f.key, f.max), max: f.max }]),
  ) as Record<FactorKey, { pts: number; max: number }>;
}

describe("CRR profiles", () => {
  it("every profile's weights sum to 100", () => {
    for (const w of Object.values(PROFILES)) {
      expect(Object.values(w).reduce((a, b) => a + b, 0)).toBe(100);
    }
  });

  it("routes each founder stage to the right profile", () => {
    expect(stageToProfile("pre-seed")).toBe("angel");
    expect(stageToProfile("seed")).toBe("seed_institutional");
    expect(stageToProfile("series-a")).toBe("seriesA_institutional");
    expect(stageToProfile("later")).toBe("growth_institutional");
  });

  it("rolls a perfect scorecard to 100 on every dimension and profile", () => {
    const dims = rollupToDimensions(factors((_key, max) => max));
    for (const d of CRR_DIMENSIONS) expect(dims[d]).toBe(100);
    for (const p of Object.keys(PROFILES) as (keyof typeof PROFILES)[]) {
      expect(scoreForProfile(dims, p)).toBe(100);
    }
  });

  it("normalizes a dimension independent of how many factors it holds", () => {
    const tractionKeys = READINESS_FACTORS.filter(
      (f) => FACTOR_TO_DIMENSION[f.key] === "traction",
    ).map((f) => f.key as FactorKey);
    const dims = rollupToDimensions(
      factors((key, max) => (tractionKeys.includes(key) ? 0 : max)),
    );
    expect(dims.traction).toBe(0);
    expect(dims.team).toBe(100);
  });

  it("applies the institutional traction floor as a ceiling only", () => {
    // Strong overall score, but thin traction.
    expect(bandForProfile(90, "seed_institutional", 15)).toBe("Developing"); // capped down
    expect(bandForProfile(90, "seed_institutional", 25)).toBe("Strong"); // above the floor
    expect(bandForProfile(90, "angel", 0)).toBe("Strong"); // angel has no floor
    expect(bandForProfile(30, "seed_institutional", 0)).toBe("Early"); // never raised up
  });
});
