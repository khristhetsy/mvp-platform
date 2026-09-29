/**
 * Who may meet whom, and what that is worth.
 */
import { describe, it, expect } from "vitest";
import {
  DEFAULT_PAIR_TYPES, medianScore, pairTypeOf, sanitizeRules, scoreBands,
} from "@/lib/icfo-events/pair-types";

describe("which pairing two people fall under", () => {
  it("matches an investor to a founder", () => {
    expect(pairTypeOf("investor", "founder", DEFAULT_PAIR_TYPES)?.key).toBe("investor_founder");
  });

  it("does not care which way round they are given", () => {
    expect(pairTypeOf("founder", "investor", DEFAULT_PAIR_TYPES)?.key).toBe("investor_founder");
  });

  it("gives two investors the peer invitation, not the founder one", () => {
    const t = pairTypeOf("investor", "investor", DEFAULT_PAIR_TYPES);
    expect(t?.key).toBe("investor_investor");
    expect(t?.template).toBe("peer_invitation");
  });

  it("refuses a pairing nobody enabled", () => {
    expect(pairTypeOf("founder", "founder", DEFAULT_PAIR_TYPES)).toBeNull();
    expect(pairTypeOf("investor", "founder", [])).toBeNull();
  });

  it("matches a sponsor to anyone when that rule is on", () => {
    expect(pairTypeOf("sponsor", "service", ["sponsor_any"])?.key).toBe("sponsor_any");
    expect(pairTypeOf("founder", "sponsor", ["sponsor_any"])?.key).toBe("sponsor_any");
  });

  it("keeps presenters separate from registrations", () => {
    expect(pairTypeOf("presenter", "investor", ["presenter_investor"])?.key).toBe("presenter_investor");
    expect(pairTypeOf("presenter", "founder", ["presenter_investor"])).toBeNull();
  });
});

describe("stored rules", () => {
  it("defaults when nothing has been chosen", () => {
    expect(sanitizeRules(null)).toEqual(DEFAULT_PAIR_TYPES);
    expect(sanitizeRules(undefined)).toEqual(DEFAULT_PAIR_TYPES);
  });

  it("drops a key it does not know, rather than widening the matching", () => {
    expect(sanitizeRules(["investor_founder", "everyone_with_everyone"])).toEqual(["investor_founder"]);
  });

  it("keeps an explicit empty choice empty — matching nothing is a decision", () => {
    expect(sanitizeRules([])).toEqual([]);
    expect(sanitizeRules(["nonsense"])).toEqual([]);
  });

  it("de-duplicates", () => {
    expect(sanitizeRules(["investor_founder", "investor_founder"])).toEqual(["investor_founder"]);
  });
});

describe("the score distribution", () => {
  const scores = [12, 10, 10, 8, 4, 4, 4, 3];

  it("counts each score, strongest first", () => {
    const bands = scoreBands(scores);
    expect(bands[0]).toEqual({ score: 12, label: "6 shared sectors", count: 1 });
    expect(bands.find((b) => b.score === 4)?.count).toBe(3);
  });

  it("reads an odd score as carrying the cross-role bonus", () => {
    expect(scoreBands([3])[0].label).toBe("role only");
    expect(scoreBands([5])[0].label).toBe("1 shared sector + roles");
  });

  it("reads an even score as shared sectors alone", () => {
    expect(scoreBands([4])[0].label).toBe("2 shared sectors");
  });

  it("copes with no matches", () => {
    expect(scoreBands([])).toEqual([]);
    expect(medianScore([])).toBeNull();
  });

  it("finds the middle", () => {
    expect(medianScore([3, 4, 12])).toBe(4);
    expect(medianScore([4, 8])).toBe(6);
  });
});
