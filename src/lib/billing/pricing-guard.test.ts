import { describe, expect, it } from "vitest";
import { cardCheckoutReady, isPaymentsEnabled, premiumCheckoutReady } from "./pricing-guard";

const STRIPE = { STRIPE_SECRET_KEY: "sk_test_x" };
// Everything Lemon Squeezy that used to switch checkout on.
const LEMON = {
  LEMONSQUEEZY_API_KEY: "ls_key",
  LEMONSQUEEZY_VARIANT_ID_BASIC: "111",
  LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL: "222",
  LEMONSQUEEZY_CHECKOUT_URL_BASIC: "https://example.lemonsqueezy.com/checkout/buy/basic",
  LEMONSQUEEZY_CHECKOUT_URL_PROFESSIONAL: "https://example.lemonsqueezy.com/checkout/buy/pro",
};

describe("isPaymentsEnabled", () => {
  it("is off with nothing configured", () => {
    expect(isPaymentsEnabled({})).toBe(false);
  });

  it("is never switched on by Lemon Squeezy settings", () => {
    expect(isPaymentsEnabled(LEMON)).toBe(false);
    expect(isPaymentsEnabled({ ...LEMON, STRIPE_PRICE_BASIC: "price_basic_99" })).toBe(false);
  });

  it("is off when Stripe has a key but no Basic or Professional price", () => {
    expect(isPaymentsEnabled(STRIPE)).toBe(false);
    expect(isPaymentsEnabled({ ...STRIPE, STRIPE_PRICE_BASIC: "  " })).toBe(false);
    expect(isPaymentsEnabled({ ...STRIPE, STRIPE_PRICE_PREMIUM: "price_premium_1500" })).toBe(false);
    // A legacy price alone is not a price a new customer can buy.
    expect(isPaymentsEnabled({ ...STRIPE, STRIPE_PRICE_BASIC_LEGACY: "price_basic_49" })).toBe(false);
  });

  it("is on when Stripe is configured and Basic or Professional has a price", () => {
    expect(isPaymentsEnabled({ ...STRIPE, STRIPE_PRICE_BASIC: "price_basic_99" })).toBe(true);
    expect(isPaymentsEnabled({ ...STRIPE, STRIPE_PRICE_PROFESSIONAL: "price_professional_199" })).toBe(true);
  });
});

describe("cardCheckoutReady", () => {
  it("is per plan: Stripe configured and that plan's current price set", () => {
    const env = { ...STRIPE, STRIPE_PRICE_BASIC: "price_basic_99" };
    expect(cardCheckoutReady("founder_basic", env)).toBe(true);
    expect(cardCheckoutReady("founder_professional", env)).toBe(false);
    expect(cardCheckoutReady("founder_basic", { STRIPE_PRICE_BASIC: "price_basic_99" })).toBe(false);
  });
});

describe("premiumCheckoutReady", () => {
  it("is always true: Premium is paid by bank wire", () => {
    expect(premiumCheckoutReady()).toBe(true);
  });
});
