import { describe, it, expect } from "vitest";
import { detectRiskyPhrases, hasRiskyPhrases, FUNDRAISING_RISKY_PHRASES } from "./risk-phrases";

describe("detectRiskyPhrases", () => {
  it("flags a guaranteed-return claim", () => {
    expect(detectRiskyPhrases("We offer a guaranteed return of 20%")).toContain("guaranteed return");
  });

  it("flags an SEC-approval claim", () => {
    expect(hasRiskyPhrases("This is an SEC approved investment")).toBe(true);
  });

  it("flags insider-information language", () => {
    expect(hasRiskyPhrases("Act on this insider information now")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(hasRiskyPhrases("RISK-FREE and GUARANTEED FUNDING")).toBe(true);
  });

  it("returns every matching phrase, not just the first", () => {
    const hits = detectRiskyPhrases("guaranteed return with assured profit and no-risk opportunity");
    expect(hits.length).toBeGreaterThanOrEqual(3);
  });

  it("leaves ordinary fundraising copy alone", () => {
    expect(hasRiskyPhrases("Seed round for a SaaS company, targeting profitability in 18 months")).toBe(false);
    expect(detectRiskyPhrases("Common equity under Regulation CF")).toHaveLength(0);
  });

  it("accepts a custom pattern list", () => {
    expect(detectRiskyPhrases("moon soon", ["moon"])).toEqual(["moon"]);
  });

  it("keeps the exported phrase list non-empty (guards an accidental deletion)", () => {
    expect(FUNDRAISING_RISKY_PHRASES.length).toBeGreaterThan(0);
  });
});

describe("known limitation — substring matching", () => {
  // Documents current behaviour so a future hardening is a deliberate change.
  // Unlike the marketplace tombstone lint (which normalises), this internal
  // scanner is a literal substring match: spacing/hyphen variants slip past.
  it("does NOT currently catch a spaced variant of a hyphenated phrase", () => {
    expect(hasRiskyPhrases("this is risk free")).toBe(false); // "risk-free" is the listed form
  });
});
