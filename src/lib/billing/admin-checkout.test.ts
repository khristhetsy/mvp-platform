import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/lemonsqueezy", () => ({ createCheckoutUrl: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ stripeConfigured: vi.fn(), createStripeCheckoutUrl: vi.fn() }));

import { createStripeCheckoutUrl, stripeConfigured } from "@/lib/stripe";
import { createAdminCheckoutUrl, describeMove } from "./admin-checkout";

const mockStripe = vi.mocked(createStripeCheckoutUrl);
const mockConfigured = vi.mocked(stripeConfigured);

const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
const lemonBasic = {
  plan_type: "founder_basic",
  subscription_status: "active",
  ls_subscription_id: "ls_1",
  stripe_subscription_id: null,
  stripe_customer_id: null,
  cancel_at_period_end: false,
  grace_period_ends_at: null,
  current_period_end: future,
};
const base = { plan: "founder_basic" as const, email: "a@x.com", profileId: "p1", successUrl: "https://x/admin" };

beforeEach(() => {
  vi.resetAllMocks();
  mockConfigured.mockReturnValue(true);
  mockStripe.mockResolvedValue("https://checkout.stripe.test/s");
  vi.stubEnv("STRIPE_PRICE_BASIC", "price_basic_99");
  vi.stubEnv("STRIPE_PRICE_BASIC_LEGACY", "price_basic_49");
});

describe("describeMove", () => {
  it("is a move for a live Lemon Squeezy card subscription on the same plan", () => {
    const m = describeMove(lemonBasic, "founder_basic");
    expect(m.moving).toBe(true);
    expect(m.firstChargeDate).toBe(new Date(Math.floor(Date.parse(future) / 1000) * 1000).toISOString());
  });
  it("is a move for a Lemon Squeezy Premium whose variant is the card Premium variant", () => {
    vi.stubEnv("LEMONSQUEEZY_VARIANT_ID_PREMIUM", "555");
    const premium = { ...lemonBasic, plan_type: "founder_premium", ls_variant_id: "555" };
    expect(describeMove(premium, "founder_premium").moving).toBe(true);
    // Without the variant (the admin route used to omit it) a card Premium looked like a wire plan.
    expect(describeMove({ ...premium, ls_variant_id: undefined }, "founder_premium").moving).toBe(false);
  });
  it("is not a move for a guest, a Stripe subscriber or a different plan", () => {
    expect(describeMove(null, "founder_basic").moving).toBe(false);
    expect(describeMove({ ...lemonBasic, stripe_subscription_id: "sub_1" }, "founder_basic").moving).toBe(false);
    expect(describeMove(lemonBasic, "founder_professional").moving).toBe(false);
  });
});

describe("createAdminCheckoutUrl on Stripe", () => {
  it("keeps the old price, replaces Lemon Squeezy and starts charging on the renewal date", async () => {
    await createAdminCheckoutUrl({ ...base, subscription: lemonBasic });
    expect(mockStripe).toHaveBeenCalledWith(expect.objectContaining({
      priceId: "price_basic_49",
      replacesLsSubscriptionId: "ls_1",
      billingCycleAnchor: Math.floor(Date.parse(future) / 1000),
    }));
  });
  it("charges the current price with no anchor for someone new", async () => {
    await createAdminCheckoutUrl({ ...base, subscription: null });
    expect(mockStripe).toHaveBeenCalledWith(expect.objectContaining({ priceId: "price_basic_99", replacesLsSubscriptionId: null, billingCycleAnchor: null }));
  });
  it("never falls back to the current price when the legacy price is missing", async () => {
    vi.stubEnv("STRIPE_PRICE_BASIC_LEGACY", "");
    await expect(createAdminCheckoutUrl({ ...base, subscription: lemonBasic })).rejects.toThrow(/legacy/);
    expect(mockStripe).not.toHaveBeenCalled();
  });
});
