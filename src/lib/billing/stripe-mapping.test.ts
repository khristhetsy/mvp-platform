import { describe, expect, it } from "vitest";
import {
  keepsLegacyPrice,
  managedPaymentsFor,
  mapStripeStatus,
  planFromStripePrice,
  stripePriceId,
  type PriceHolder,
} from "./stripe-mapping";

const env = {
  STRIPE_PRICE_BASIC: "price_basic_99",
  STRIPE_PRICE_BASIC_LEGACY: "price_basic_49",
  STRIPE_PRICE_PROFESSIONAL: "price_pro_199",
  STRIPE_PRICE_PREMIUM: "price_premium_1500",
  STRIPE_PRICE_PREMIUM_LEGACY: "price_premium_1000",
};

const now = new Date("2026-11-20T12:00:00Z");
const day = 86_400_000;

const active = (over: Partial<PriceHolder> = {}): PriceHolder => ({
  plan_type: "founder_basic",
  subscription_status: "active",
  ls_subscription_id: "ls_1",
  cancel_at_period_end: false,
  grace_period_ends_at: null,
  ...over,
});

describe("stripePriceId / planFromStripePrice", () => {
  it("resolves current and legacy price ids", () => {
    expect(stripePriceId("founder_basic", "current", env)).toBe("price_basic_99");
    expect(stripePriceId("founder_basic", "legacy", env)).toBe("price_basic_49");
    expect(planFromStripePrice("price_premium_1000", env)).toEqual({ plan: "founder_premium", tier: "legacy" });
    expect(planFromStripePrice("price_pro_199", env)).toEqual({ plan: "founder_professional", tier: "current" });
  });

  it("has no legacy tier for Professional and returns null for unknown or empty prices", () => {
    expect(stripePriceId("founder_professional", "legacy", env)).toBeNull();
    expect(planFromStripePrice("price_unknown", env)).toBeNull();
    expect(planFromStripePrice(null, env)).toBeNull();
  });

  it("returns null for an unset or blank price instead of an empty string", () => {
    expect(stripePriceId("founder_basic", "current", { STRIPE_PRICE_BASIC: "  " })).toBeNull();
    expect(stripePriceId("founder_premium", "current", {})).toBeNull();
  });
});

describe("keepsLegacyPrice", () => {
  it("keeps the old price for a continuous active subscriber on the same plan", () => {
    expect(keepsLegacyPrice(active(), "founder_basic", now)).toBe(true);
    expect(keepsLegacyPrice(active({ plan_type: "founder_premium" }), "founder_premium", now)).toBe(true);
  });

  it("charges the current price to anyone who never paid", () => {
    expect(keepsLegacyPrice(null, "founder_basic", now)).toBe(false);
    expect(keepsLegacyPrice(active({ plan_type: "founder_free", subscription_status: "free", ls_subscription_id: null }), "founder_basic", now)).toBe(false);
  });

  it("charges the current price to someone who cancelled and returns", () => {
    expect(keepsLegacyPrice(active({ subscription_status: "canceled" }), "founder_basic", now)).toBe(false);
    expect(keepsLegacyPrice(active({ cancel_at_period_end: true }), "founder_basic", now)).toBe(false);
  });

  it("charges the current price when upgrading to a different plan", () => {
    expect(keepsLegacyPrice(active({ plan_type: "founder_basic" }), "founder_premium", now)).toBe(false);
  });

  it("never gives Professional a legacy price", () => {
    expect(keepsLegacyPrice(active({ plan_type: "founder_professional" }), "founder_professional", now)).toBe(false);
  });

  it("keeps the old price inside the failed payment grace period, loses it after", () => {
    const inGrace = active({ grace_period_ends_at: new Date(now.getTime() + 2 * day).toISOString() });
    const lapsed = active({ grace_period_ends_at: new Date(now.getTime() - day).toISOString() });
    expect(keepsLegacyPrice(inGrace, "founder_basic", now)).toBe(true);
    expect(keepsLegacyPrice(lapsed, "founder_basic", now)).toBe(false);
  });

  it("does not cover a wire Premium, which has no Lemon Squeezy subscription", () => {
    expect(keepsLegacyPrice(active({ plan_type: "founder_premium", ls_subscription_id: null }), "founder_premium", now)).toBe(false);
  });
});

describe("mapStripeStatus", () => {
  const periodEnd = new Date(now.getTime() + 10 * day).toISOString();

  it("maps active and trialing", () => {
    expect(mapStripeStatus("active", { cancelAtPeriodEnd: false, periodEnd, now }).status).toBe("active");
    expect(mapStripeStatus("trialing", { cancelAtPeriodEnd: false, periodEnd, now }).status).toBe("trialing");
  });

  it("keeps access to the period end when a cancellation is pending", () => {
    const m = mapStripeStatus("active", { cancelAtPeriodEnd: true, periodEnd, now });
    expect(m).toMatchObject({ status: "active", cancelAtPeriodEnd: true, gracePeriodEndsAt: periodEnd });
  });

  it("gives past_due a 5 day grace window", () => {
    const m = mapStripeStatus("past_due", { cancelAtPeriodEnd: false, periodEnd, now });
    expect(m.status).toBe("active");
    expect(m.gracePeriodEndsAt).toBe(new Date(now.getTime() + 5 * day).toISOString());
  });

  it("cancels on canceled, unpaid, paused and incomplete_expired", () => {
    for (const s of ["canceled", "unpaid", "paused", "incomplete_expired"]) {
      expect(mapStripeStatus(s, { cancelAtPeriodEnd: false, periodEnd, now }).status).toBe("canceled");
    }
  });

  it("treats incomplete as pending payment and reports an unknown status", () => {
    expect(mapStripeStatus("incomplete", { cancelAtPeriodEnd: false, periodEnd, now }).status).toBe("pending_payment");
    expect(mapStripeStatus("something_new", { cancelAtPeriodEnd: false, periodEnd, now }).unknown).toBe(true);
  });
});

describe("managedPaymentsFor", () => {
  it("is on for Basic and Professional and off for Premium by default", () => {
    expect(managedPaymentsFor("founder_basic", {})).toBe(true);
    expect(managedPaymentsFor("founder_professional", {})).toBe(true);
    expect(managedPaymentsFor("founder_premium", {})).toBe(false);
  });

  it("can be overridden per plan, or turned off", () => {
    expect(managedPaymentsFor("founder_premium", { STRIPE_MANAGED_PAYMENTS_PLANS: "founder_basic,founder_premium" })).toBe(true);
    expect(managedPaymentsFor("founder_professional", { STRIPE_MANAGED_PAYMENTS_PLANS: "founder_basic" })).toBe(false);
    expect(managedPaymentsFor("founder_basic", { STRIPE_MANAGED_PAYMENTS_PLANS: "none" })).toBe(false);
  });
});
