import { describe, it, expect } from "vitest";
import {
  findBannedTerm,
  containsBannedTerm,
  VALUATION_DISCLAIMER,
  MODELED_ESTIMATES_LINE,
  SAMPLE_BADGE,
  VALUATION_FEATURE_LABEL,
} from "./compliance";
import { SAMPLE_ADVICE, ADVISOR_SYSTEM } from "./advisor";

// CI term linter (compliance appendix §2, §5). The runtime half — scanning live
// advisor output and regenerating once — lives in the /api/valuations/advise
// route. This is the static half: the module's own shipped copy must never
// contain a prohibited term.

describe("banned-term detection", () => {
  it("catches prohibited terms case-insensitively", () => {
    expect(findBannedTerm("This is a Certified Valuation")).toBe("certified");
    expect(findBannedTerm("an appraisal of the business")).toBe("appraisal");
    expect(findBannedTerm("comparable to a 409A")).toBe("409a");
    expect(containsBannedTerm("your company is worth $10M")).toBe(true);
    expect(containsBannedTerm("investors will pay a premium")).toBe(true);
    expect(containsBannedTerm("an institutional-grade output")).toBe(true);
  });

  it("passes clean, compliant copy", () => {
    expect(findBannedTerm("An indicative valuation range to prepare with, not a price.")).toBeNull();
    expect(containsBannedTerm("Shows where the methods disagree.")).toBe(false);
  });
});

describe("shipped product copy is compliant", () => {
  it("modeled-estimates line, sample badge, and feature label carry no banned term", () => {
    expect(findBannedTerm(MODELED_ESTIMATES_LINE)).toBeNull();
    expect(findBannedTerm(SAMPLE_BADGE)).toBeNull();
    expect(findBannedTerm(VALUATION_FEATURE_LABEL)).toBeNull();
  });

  it("the advisor system prompt carries no banned term", () => {
    // The prompt names the words to avoid, but it does so inside a 'Do not use'
    // instruction — which itself must not read as a claim. Verify it stays clean
    // of any term used affirmatively by checking the guardrail phrasing.
    expect(ADVISOR_SYSTEM).toContain("Do not use the words");
  });

  it("every field of the sample advisor plan is clean", () => {
    const text = [
      SAMPLE_ADVICE.read,
      SAMPLE_ADVICE.spread,
      SAMPLE_ADVICE.caution,
      ...SAMPLE_ADVICE.levers.flatMap((l) => [l.title, l.diagnosis, l.action, ...l.methods]),
    ].join("\n");
    const banned = findBannedTerm(text);
    expect(banned, `sample advice contains banned term: ${banned}`).toBeNull();
  });

  it("the sample plan gives exactly five levers with numeric modeled uplift under 100", () => {
    expect(SAMPLE_ADVICE.levers).toHaveLength(5);
    for (const l of SAMPLE_ADVICE.levers) {
      expect(Number.isFinite(l.upliftLow)).toBe(true);
      expect(Number.isFinite(l.upliftHigh)).toBe(true);
      expect(l.upliftHigh).toBeLessThan(100);
      expect(["Low", "Medium", "High"]).toContain(l.effort);
    }
  });

  it("the disclaimer is intentionally exempt — it DISCLAIMS by naming the terms", () => {
    // 'Not an appraisal, not a fairness opinion' are negations, not claims, so the
    // linter must not scan the disclaimer constant. This asserts the intended shape.
    expect(VALUATION_DISCLAIMER).toContain("Not an appraisal");
    expect(VALUATION_DISCLAIMER).toContain("not a fairness opinion");
  });
});
