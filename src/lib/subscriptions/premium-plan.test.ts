import { afterEach, describe, expect, it, vi } from "vitest";
import { founderEntitlements } from "@/lib/subscriptions/entitlements";
import { PRICED_PLANS, CODE_DEFAULT_PRICING, pricingFromRow } from "@/lib/subscriptions/pricing-catalog";
import { parseRequestedPlan, PLAN_PRICES } from "@/lib/subscriptions/plans";
import { variantToPlan } from "@/lib/billing/webhook-mapping";

describe("Premium founder plan", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("has Professional's distribution limits", () => {
    expect(founderEntitlements("founder_premium")).toEqual(founderEntitlements("founder_professional"));
  });

  it("is priced at $1,000 and appears on the admin Pricing page", () => {
    expect(PLAN_PRICES.founder_premium).toBe(100000);
    expect(PRICED_PLANS).toContain("founder_premium");
    expect(CODE_DEFAULT_PRICING.plans.founder_premium.cents).toBe(100000);
  });

  it("fills in for a saved price version made before Premium existed", () => {
    const catalog = pricingFromRow({
      id: "x", version: "pricing-v1", plans: { founder_basic: { cents: 4900 } }, add_company_cents: 80000,
      reason: null, existing_policy: "grandfather", effective_at: "", is_active: true, created_by: null, created_at: "",
    });
    expect(catalog.plans.founder_premium.cents).toBe(100000);
  });

  it("can be requested at sign up", () => {
    expect(parseRequestedPlan("founder_premium")).toBe("founder_premium");
  });

  it("maps the Lemon Squeezy Premium variant to the plan", () => {
    vi.stubEnv("LEMONSQUEEZY_VARIANT_ID_PREMIUM", "999");
    expect(variantToPlan(999)).toEqual({ plan: "founder_premium", source: "variant_id" });
    expect(variantToPlan(1, "Founder Premium", "iCapOS")).toEqual({ plan: "founder_premium", source: "name" });
  });
});
