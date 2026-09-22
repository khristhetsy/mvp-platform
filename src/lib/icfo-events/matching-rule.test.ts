/**
 * The rule both the board and the public page count with.
 */
import { describe, it, expect } from "vitest";
import { countMatches, pairScore, sectorsOf, sharedSectors, type Matchable } from "@/lib/icfo-events/matching-rule";

const inv = (...sectors: string[]): Matchable => ({ role: "investor", sectors });
const fnd = (...sectors: string[]): Matchable => ({ role: "founder", sectors });

describe("reading the sectors off a registration", () => {
  it("takes the investor's list, as slugs", () => {
    expect(sectorsOf({ sectors: ["fintech", "healthtech"] })).toEqual(["fintech", "healthtech"]);
  });

  it("takes the founder's single answer", () => {
    expect(sectorsOf({ sector: "healthtech" })).toEqual(["healthtech"]);
  });

  it("accepts either shape from either side — the form has changed over time", () => {
    expect(sectorsOf({ sectors: "fintech", sector: ["healthtech"] })).toEqual(["fintech", "healthtech"]);
  });

  it("trims and de-duplicates", () => {
    expect(sectorsOf({ sectors: [" fintech ", "fintech"], sector: "fintech" })).toEqual(["fintech"]);
  });

  it("returns nothing for a registration that declared nothing", () => {
    expect(sectorsOf({})).toEqual([]);
    expect(sectorsOf({ sectors: [], sector: "  " })).toEqual([]);
  });

  // The bug this rule was written to end: staff registered a guest through a
  // form that stored labels, the public form stored slugs, and the two never
  // shared a sector.
  it("resolves a label stored by the old form to the same slug", () => {
    expect(sectorsOf({ sectors: ["FinTech", "SaaS / B2B Software"] })).toEqual(["fintech", "saas"]);
  });

  it("de-duplicates across the two spellings", () => {
    expect(sectorsOf({ sectors: ["FinTech", "fintech"] })).toEqual(["fintech"]);
  });

  it("ignores the separators a label carries", () => {
    expect(sectorsOf({ sector: "AI / ML" })).toEqual(["ai-ml"]);
    expect(sectorsOf({ sector: "E-commerce" })).toEqual(["ecommerce"]);
  });

  it("keeps a value that is no sector at all, so two who typed it still meet", () => {
    expect(sectorsOf({ sectors: ["Agtech"] })).toEqual(["agtech"]);
  });

  it("matches a staff-registered guest with a self-registered one", () => {
    const staffEntered = sectorsOf({ sectors: ["FinTech", "HealthTech"] });
    const selfRegistered = sectorsOf({ sector: "fintech" });
    expect(sharedSectors(
      { role: "investor", sectors: staffEntered },
      { role: "founder", sectors: selfRegistered },
    )).toEqual(["fintech"]);
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
