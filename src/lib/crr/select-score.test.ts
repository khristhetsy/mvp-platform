import { describe, it, expect } from "vitest";
import { normalizeFundingStage, founderFacingScore, investorFacingScore } from "./select-score";

describe("normalizeFundingStage", () => {
  it("maps common labels to the four canonical stages", () => {
    expect(normalizeFundingStage("Pre-Seed")).toBe("pre-seed");
    expect(normalizeFundingStage("angel")).toBe("pre-seed");
    expect(normalizeFundingStage("Seed")).toBe("seed");
    expect(normalizeFundingStage("Series A")).toBe("series-a");
    expect(normalizeFundingStage("series_b")).toBe("later");
    expect(normalizeFundingStage("Growth")).toBe("later");
    expect(normalizeFundingStage(null)).toBe("seed");
    expect(normalizeFundingStage("")).toBe("seed");
  });
});

describe("founderFacingScore", () => {
  it("uses the stage-matched profile column when present", () => {
    const row = { total_score: 50, effective_score: 55, score_angel: 80, score_seed_institutional: 60 };
    expect(founderFacingScore(row, "pre-seed")).toBe(80); // angel
    expect(founderFacingScore(row, "seed")).toBe(60); // seed_institutional
  });
  it("falls back to effective/total before the columns exist", () => {
    expect(founderFacingScore({ total_score: 50, effective_score: 55 }, "seed")).toBe(55);
    expect(founderFacingScore({ total_score: 50 }, "seed")).toBe(50);
  });
  it("lets an admin override win", () => {
    expect(
      founderFacingScore({ total_score: 50, score_seed_institutional: 60, override_score: 90 }, "seed"),
    ).toBe(90);
  });
  it("returns null for a missing row", () => {
    expect(founderFacingScore(null, "seed")).toBeNull();
  });
});

describe("investorFacingScore", () => {
  it("uses the canonical Series A column when present", () => {
    const row = { total_score: 50, score_seriesa_institutional: 72, score_angel: 90 };
    expect(investorFacingScore(row)).toBe(72);
  });
  it("falls back to effective/total pre-migration", () => {
    expect(investorFacingScore({ total_score: 44, effective_score: 48 })).toBe(48);
  });
  it("lets an admin override win", () => {
    expect(investorFacingScore({ score_seriesa_institutional: 72, override_score: 30 })).toBe(30);
  });
});
