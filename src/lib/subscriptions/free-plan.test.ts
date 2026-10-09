import { describe, expect, it } from "vitest";
import {
  FOUNDER_FREE_FEATURES,
  SIGNUP_FOUNDER_PLANS,
  isAutoGrantSignupPlan,
  parseRequestedPlan,
  planLabelFor,
  type SubscriptionRecord,
} from "@/lib/subscriptions/plans";
import { canAccessFeature, isSubscriptionActive } from "@/lib/subscriptions/access";

/**
 * Free is back (approved Oct 8, 2026) for due diligence and the CRR only. These
 * tests pin the narrow scope so Free can never quietly grow back into the full
 * toolset it used to grant.
 */
function sub(overrides: Partial<SubscriptionRecord>): SubscriptionRecord {
  return {
    id: "s1",
    profile_id: "p1",
    role: "founder",
    plan_type: "founder_free",
    subscription_status: "free",
    trial_started_at: null,
    trial_ends_at: null,
    current_period_start: null,
    current_period_end: null,
    monthly_price_cents: 0,
    currency: "USD",
    created_at: "2026-10-09T00:00:00Z",
    updated_at: "2026-10-09T00:00:00Z",
    grace_period_ends_at: null,
    is_grandfathered: false,
    ls_customer_id: null,
    ls_subscription_id: null,
    ls_variant_id: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_price_id: null,
    ...overrides,
  };
}

describe("the Free founder plan (due diligence only)", () => {
  it("is offered first on the signup form, with the paid rungs after it", () => {
    const types = SIGNUP_FOUNDER_PLANS.map((p) => p.planType);
    expect(types[0]).toBe("founder_free");
    expect(types).toContain("founder_basic");
    expect(types).toContain("founder_professional");
  });

  it("can be requested through the URL", () => {
    expect(parseRequestedPlan("founder_free")).toBe("founder_free");
    expect(parseRequestedPlan("founder_basic")).toBe("founder_basic");
  });

  it("is granted with no checkout, while paid plans never are", () => {
    expect(isAutoGrantSignupPlan("founder", "founder_free")).toBe(true);
    expect(isAutoGrantSignupPlan("founder", "founder_basic")).toBe(false);
    expect(isAutoGrantSignupPlan("investor", "investor_free")).toBe(true);
  });

  it("grants due diligence and the CRR, nothing else", () => {
    const free = sub({});
    expect(isSubscriptionActive(free)).toBe(true);
    for (const f of FOUNDER_FREE_FEATURES) expect(canAccessFeature(free, f).allowed).toBe(true);
    for (const f of ["investor_access", "capital_raise", "elearning", "analytics", "premium_tools"] as const) {
      const r = canAccessFeature(free, f);
      expect(r.allowed).toBe(false);
      expect(r.reason).toMatch(/Upgrade to Basic/);
    }
  });

  it("keeps every tool for grandfathered Free accounts", () => {
    const old = sub({ is_grandfathered: true });
    expect(canAccessFeature(old, "premium_tools").allowed).toBe(true);
    expect(canAccessFeature(old, "capital_raise").allowed).toBe(true);
  });
});

describe("planLabelFor", () => {
  it("says grandfathered only when the account actually is", () => {
    expect(planLabelFor("founder_free", true)).toBe("Free (grandfathered)");
    expect(planLabelFor("founder_free", false)).toBe("Free");
    expect(planLabelFor("founder_free")).toBe("Free");
  });

  it("leaves other plans untouched", () => {
    expect(planLabelFor("founder_basic")).toBe("Basic");
    expect(planLabelFor("investor_free")).toBe("Investor Free");
  });
});
