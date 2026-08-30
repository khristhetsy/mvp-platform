import { describe, it, expect } from "vitest";
import { principalIdentityHash } from "@/lib/formd/principal-identity";
import { dealEventConfidence, isDisplayableDeal } from "@/lib/formd/deal-event";
import { SCORE_PROFILES, scoreWithProfile, activityBand, bandShowsRank, type ScoreSignals } from "@/lib/formd/score-profiles";

describe("principalIdentityHash (§6)", () => {
  const p = { firstName: "Jane", lastName: "Investor", street1: "1 Sand Hill Rd", postalCode: "94025", firmId: "firm-1" };

  it("is deterministic for the same key + input", () => {
    expect(principalIdentityHash(p, "k1")).toBe(principalIdentityHash(p, "k1"));
  });

  it("rotating the key changes the hash but not the identity (acceptance test 6)", () => {
    expect(principalIdentityHash(p, "k1")).not.toBe(principalIdentityHash(p, "k2"));
  });

  it("two same-named people at different addresses stay separate", () => {
    const a = principalIdentityHash(p, "k1");
    const b = principalIdentityHash({ ...p, street1: "2 Market St", postalCode: "94105" }, "k1");
    expect(a).not.toBe(b);
  });

  it("address-less fallback is firm-scoped", () => {
    const noStreet = { firstName: "Jane", lastName: "Investor", firmId: "firm-1" };
    const sameFirm = principalIdentityHash(noStreet, "k1");
    const otherFirm = principalIdentityHash({ ...noStreet, firmId: "firm-2" }, "k1");
    expect(sameFirm).not.toBe(otherFirm);
  });
});

describe("dealEventConfidence (§7)", () => {
  const base = { namedInRecipients: false, identityHashMatch: false, nameMatch: false, isDirector: false, issuerPostDatesFundFirstFiling: false };

  it("names in RECIPIENTS score 0.95", () => {
    expect(dealEventConfidence({ ...base, namedInRecipients: true })).toBe(0.95);
  });
  it("hash + director + date ordering score 0.75", () => {
    expect(dealEventConfidence({ ...base, identityHashMatch: true, isDirector: true, issuerPostDatesFundFirstFiling: true })).toBe(0.75);
  });
  it("name match + director score 0.55 and is not displayable (acceptance test 7)", () => {
    const c = dealEventConfidence({ ...base, nameMatch: true, isDirector: true });
    expect(c).toBe(0.55);
    expect(isDisplayableDeal(c)).toBe(false);
  });
  it("0.75 is the display threshold", () => {
    expect(isDisplayableDeal(0.75)).toBe(true);
  });
  it("weak signals fall below the 0.55 floor", () => {
    expect(dealEventConfidence({ ...base, nameMatch: true })).toBe(0);
  });
});

describe("score profiles (§8)", () => {
  const signals = (recencyDays: number): ScoreSignals => ({ recencyDays, volume: 0.5, fit: 0.5, type: 0.5, position: 0.5, reach: 0.5 });

  it("issuer and investor profiles rank recency oppositely on identical input (acceptance test 15)", () => {
    const recent = signals(30);
    const old = signals(600);
    const issuerRanksOldHigher =
      scoreWithProfile(old, SCORE_PROFILES.issuer) > scoreWithProfile(recent, SCORE_PROFILES.issuer);
    const investorRanksRecentHigher =
      scoreWithProfile(recent, SCORE_PROFILES.investor) > scoreWithProfile(old, SCORE_PROFILES.investor);
    expect(issuerRanksOldHigher).toBe(true);
    expect(investorRanksRecentHigher).toBe(true);
  });

  it("registry band shows no rank (acceptance test 10)", () => {
    expect(activityBand(0)).toBe("registry");
    expect(bandShowsRank("registry")).toBe(false);
    expect(activityBand(1)).toBe("single");
    expect(activityBand(2)).toBe("observed");
    expect(bandShowsRank("observed")).toBe(true);
  });
});
