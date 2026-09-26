import { describe, expect, it } from "vitest";
import { checkFits, matchableFromAnswers, pairScore, parseMoneyBand, stageFits } from "@/lib/icfo-events/matching-rule";

describe("parseMoneyBand", () => {
  it("reads the bands the registration forms use", () => {
    expect(parseMoneyBand("$100k–$500k")).toEqual({ min: 100_000, max: 500_000 });
    expect(parseMoneyBand("$1M–$3M")).toEqual({ min: 1_000_000, max: 3_000_000 });
    expect(parseMoneyBand("$500k - $2M")).toEqual({ min: 500_000, max: 2_000_000 });
    expect(parseMoneyBand("$2M+")).toEqual({ min: 2_000_000, max: null });
    expect(parseMoneyBand("Over $10m")).toEqual({ min: 10_000_000, max: null });
    expect(parseMoneyBand("whatever")).toBeNull();
    expect(parseMoneyBand(null)).toBeNull();
  });
});

describe("stageFits and checkFits", () => {
  it("matches funding stages, with Series B+ covering Series B and Growth", () => {
    expect(stageFits(["Seed", "Series A"], ["Seed"])).toBe(true);
    expect(stageFits(["Series B+"], ["Growth"])).toBe(true);
    expect(stageFits(["Pre-seed"], ["Series A"])).toBe(false);
    expect(stageFits([], ["Seed"])).toBe(false);
  });
  it("fits when the smallest check is within the round", () => {
    expect(checkFits({ min: 100_000, max: 500_000 }, { min: 1_000_000, max: 3_000_000 })).toBe(true);
    expect(checkFits({ min: 5_000_000, max: null }, { min: 1_000_000, max: 3_000_000 })).toBe(false);
    expect(checkFits(null, { min: 1, max: 2 })).toBe(false);
  });
});

describe("pairScore with stage and check", () => {
  const investor = matchableFromAnswers("investor", { sectors: ["FinTech"], stages: ["Seed"], checkSize: "$100k–$500k" });
  const founder = matchableFromAnswers("founder", { sector: "FinTech", stage: "Seed", roundSize: "$1M–$3M" });

  it("adds both fits on top of sector and the complementary bonus", () => {
    expect(pairScore(investor, founder)).toBe(2 + 3 + 2 + 2);
    expect(pairScore(founder, investor)).toBe(9);
  });

  it("scores exactly as before when stage and check are missing", () => {
    expect(pairScore({ role: "investor", sectors: ["FinTech"] }, { role: "founder", sectors: ["FinTech"] })).toBe(5);
  });

  it("never applies to two investors", () => {
    const other = matchableFromAnswers("investor", { sectors: ["FinTech"], stages: ["Seed"], checkSize: "$100k–$500k" });
    expect(pairScore(investor, other)).toBe(2);
  });
});
