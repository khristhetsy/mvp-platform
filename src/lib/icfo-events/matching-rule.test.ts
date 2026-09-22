/**
 * The rule both the board and the public page count with.
 */
import { describe, it, expect } from "vitest";
import { countMatches, pairScore, sectorsOf, sharedSectors, type Matchable } from "@/lib/icfo-events/matching-rule";

const inv = (...sectors: string[]): Matchable => ({ role: "investor", sectors });
const fnd = (...sectors: string[]): Matchable => ({ role: "founder", sectors });

describe("reading the sectors off a registration", () => {
  it("takes the investor's list", () => {
    expect(sectorsOf({ sectors: ["FinTech", "HealthTech"] })).toEqual(["FinTech", "HealthTech"]);
  });

  it("takes the founder's single answer", () => {
    expect(sectorsOf({ sector: "HealthTech" })).toEqual(["HealthTech"]);
  });

  it("accepts either shape from either side — the form has changed over time", () => {
    expect(sectorsOf({ sectors: "FinTech", sector: ["HealthTech"] })).toEqual(["FinTech", "HealthTech"]);
  });

  it("trims and de-duplicates", () => {
    expect(sectorsOf({ sectors: [" FinTech ", "FinTech"], sector: "FinTech" })).toEqual(["FinTech"]);
  });

  it("returns nothing for a registration that declared nothing", () => {
    expect(sectorsOf({})).toEqual([]);
    expect(sectorsOf({ sectors: [], sector: "  " })).toEqual([]);
  });
});

describe("what counts as a match", () => {
  it("pairs an investor with a founder even when they share nothing", () => {
    // The room is the point: they are still worth introducing.
    expect(pairScore(inv(), fnd())).toBeGreaterThan(0);
  });

  it("does not pair two investors who share nothing", () => {
    expect(pairScore(inv("FinTech"), inv("EdTech"))).toBe(0);
  });

  it("pairs two investors who do share a sector", () => {
    expect(pairScore(inv("FinTech"), inv("FinTech"))).toBeGreaterThan(0);
  });

  it("scores a shared sector above a bare role difference", () => {
    const crossOnly = pairScore(inv(), fnd());
    const crossAndShared = pairScore(inv("FinTech", "AI / ML"), fnd("FinTech", "AI / ML"));
    expect(crossAndShared).toBeGreaterThan(crossOnly);
  });

  it("is the same whichever way round it is asked", () => {
    const a = inv("FinTech");
    const b = fnd("FinTech", "EdTech");
    expect(pairScore(a, b)).toBe(pairScore(b, a));
  });

  it("names what they share", () => {
    expect(sharedSectors(inv("FinTech", "EdTech"), fnd("EdTech", "SaaS / B2B Software"))).toEqual(["EdTech"]);
  });
});

describe("counting a room", () => {
  it("counts every pair that matches, once", () => {
    // Two investors in FinTech and one founder: inv-inv, inv-fnd, inv-fnd.
    expect(countMatches([inv("FinTech"), inv("FinTech"), fnd("EdTech")])).toBe(3);
  });

  it("leaves out the pairs that don't", () => {
    // The two investors share nothing, so only the two cross pairs count.
    expect(countMatches([inv("FinTech"), inv("EdTech"), fnd()])).toBe(2);
  });

  it("counts nobody as no matches", () => {
    expect(countMatches([])).toBe(0);
    expect(countMatches([inv("FinTech")])).toBe(0);
  });

  it("handles a full room without complaint", () => {
    const room = Array.from({ length: 106 }, (_, i) =>
      i % 2 ? inv("FinTech") : fnd("FinTech"),
    );
    // Everyone shares FinTech, so every pair matches: n(n-1)/2.
    expect(countMatches(room)).toBe((106 * 105) / 2);
  });
});
