import { describe, expect, it } from "vitest";
import {
  freeReportLimitReached,
  isRestrictedFreeFounder,
  masksInvestorInterest,
  type FounderSubscriptionLike,
} from "@/lib/founder-plan/tier";

const sub = (plan_type: string, extra: Partial<NonNullable<FounderSubscriptionLike>> = {}) =>
  ({ plan_type, is_grandfathered: false, subscription_status: "active", ...extra }) as NonNullable<FounderSubscriptionLike>;

describe("one free report", () => {
  it("blocks a second report for a new Free founder", () => {
    expect(freeReportLimitReached(sub("founder_free", { subscription_status: "free" }), 1)).toBe(true);
  });

  it("lets a new Free founder run the first report", () => {
    expect(freeReportLimitReached(sub("founder_free"), 0)).toBe(false);
  });

  it("leaves grandfathered Free founders unchanged", () => {
    expect(freeReportLimitReached(sub("founder_free", { is_grandfathered: true }), 3)).toBe(false);
    // Fail open: a missing flag is not an explicit false.
    expect(isRestrictedFreeFounder(sub("founder_free", { is_grandfathered: null }))).toBe(false);
  });

  it("leaves paid founders unchanged", () => {
    expect(freeReportLimitReached(sub("founder_basic"), 5)).toBe(false);
    expect(freeReportLimitReached(sub("founder_professional"), 5)).toBe(false);
  });

  it("does not restrict a founder with no subscription row", () => {
    expect(freeReportLimitReached(null, 2)).toBe(false);
  });
});

describe("masking interested investors", () => {
  it("masks Free and legacy trial founders", () => {
    expect(masksInvestorInterest(sub("founder_free"))).toBe(true);
    expect(masksInvestorInterest(sub("founder_free", { is_grandfathered: true }))).toBe(true);
    expect(masksInvestorInterest(sub("founder_trial"))).toBe(true);
  });

  it("shows names on Basic and up", () => {
    for (const plan of ["founder_basic", "founder_professional", "founder_premium", "founder_managed_ir"]) {
      expect(masksInvestorInterest(sub(plan))).toBe(false);
    }
  });

  it("masks a paid plan that has not been paid yet, and a missing row", () => {
    expect(masksInvestorInterest(sub("founder_basic", { subscription_status: "pending_payment" }))).toBe(true);
    expect(masksInvestorInterest(null)).toBe(true);
  });
});
