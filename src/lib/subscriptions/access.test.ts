import { describe, it, expect } from "vitest";
import { isTrialActive, isTrialExpired, isGracePeriodExpired, isSubscriptionActive } from "./access";
import type { SubscriptionRecord } from "./plans";

function sub(overrides: Partial<SubscriptionRecord>): SubscriptionRecord {
  return {
    id: "s1",
    profile_id: "p1",
    role: "founder",
    plan_type: "founder_professional",
    subscription_status: "active",
    trial_started_at: null,
    trial_ends_at: null,
    current_period_start: null,
    current_period_end: null,
    monthly_price_cents: 100000,
    currency: "USD",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    grace_period_ends_at: null,
    ls_customer_id: null,
    ls_subscription_id: null,
    ls_variant_id: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_price_id: null,
    ...overrides,
  } as SubscriptionRecord;
}

const NOW = new Date("2026-06-01T00:00:00.000Z");

describe("trial", () => {
  it("is active for a trialing plan whose end is in the future", () => {
    expect(isTrialActive(sub({ plan_type: "founder_trial", subscription_status: "trialing", trial_ends_at: "2026-06-05T00:00:00.000Z" }), NOW)).toBe(true);
  });

  it("is expired once the trial end has passed", () => {
    expect(isTrialExpired(sub({ plan_type: "founder_trial", subscription_status: "trialing", trial_ends_at: "2026-05-20T00:00:00.000Z" }), NOW)).toBe(true);
  });
});

describe("grace period", () => {
  it("is not expired when unset", () => {
    expect(isGracePeriodExpired(sub({ grace_period_ends_at: null }), NOW)).toBe(false);
  });

  it("is not expired while still in the future", () => {
    expect(isGracePeriodExpired(sub({ grace_period_ends_at: "2026-06-10T00:00:00.000Z" }), NOW)).toBe(false);
  });

  it("is expired once the window has passed", () => {
    expect(isGracePeriodExpired(sub({ grace_period_ends_at: "2026-05-25T00:00:00.000Z" }), NOW)).toBe(true);
  });
});

describe("isSubscriptionActive with grace period", () => {
  it("treats a past_due-but-in-grace subscription as active", () => {
    // The webhook keeps status "active" during the grace window.
    expect(isSubscriptionActive(sub({ subscription_status: "active", grace_period_ends_at: "2026-06-10T00:00:00.000Z" }), NOW)).toBe(true);
  });

  it("treats a subscription whose grace has elapsed as inactive, even though status still reads active", () => {
    // This is the leak the fix closes: a failed card must not mean permanent access.
    expect(isSubscriptionActive(sub({ subscription_status: "active", grace_period_ends_at: "2026-05-25T00:00:00.000Z" }), NOW)).toBe(false);
  });

  it("still recognises a healthy active subscription", () => {
    expect(isSubscriptionActive(sub({ subscription_status: "active", grace_period_ends_at: null }), NOW)).toBe(true);
  });

  it("keeps admin_internal always active", () => {
    expect(isSubscriptionActive(sub({ plan_type: "admin_internal", subscription_status: "canceled" }), NOW)).toBe(true);
  });
});
