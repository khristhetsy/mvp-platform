import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readJsonResponse } from "@/test/mock-supabase";

vi.mock("@/lib/ai-site/ratelimit", () => ({ checkFormRateLimit: vi.fn() }));
vi.mock("@/lib/billing/paid-signup", () => ({ createPaidSignup: vi.fn(), emailHasAccount: vi.fn() }));
vi.mock("@/lib/analytics/funnel", () => ({ recordFunnelEvent: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ stripeConfigured: vi.fn(), createStripeCheckoutUrl: vi.fn() }));

import { POST } from "./route";
import { checkFormRateLimit } from "@/lib/ai-site/ratelimit";
import { createPaidSignup, emailHasAccount } from "@/lib/billing/paid-signup";
import { createStripeCheckoutUrl, stripeConfigured } from "@/lib/stripe";

const mockLimit = vi.mocked(checkFormRateLimit);
const mockSignup = vi.mocked(createPaidSignup);
const mockHasAccount = vi.mocked(emailHasAccount);
const mockStripe = vi.mocked(createStripeCheckoutUrl);
const mockConfigured = vi.mocked(stripeConfigured);

function request(planType: string) {
  return new NextRequest("http://test/api/billing/guest-checkout", {
    method: "POST",
    body: JSON.stringify({ email: "new@x.com", planType, refundPolicyAcceptedAt: "2026-11-25T00:00:00.000Z" }),
  });
}

let log: ReturnType<typeof vi.spyOn>;
let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("LEMONSQUEEZY_API_KEY", "ls_key");
  vi.stubEnv("LEMONSQUEEZY_VARIANT_ID_BASIC", "111");
  vi.stubEnv("LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL", "222");
  vi.stubEnv("LEMONSQUEEZY_CHECKOUT_URL_BASIC", "https://example.lemonsqueezy.com/checkout/buy/basic");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
  vi.stubEnv("STRIPE_PRICE_BASIC", "price_basic_99");
  vi.stubEnv("STRIPE_PRICE_PROFESSIONAL", "");
  mockConfigured.mockReturnValue(true);
  mockStripe.mockResolvedValue("https://checkout.stripe.test/guest");
  mockLimit.mockResolvedValue({ ok: true } as never);
  mockHasAccount.mockResolvedValue(false);
  mockSignup.mockResolvedValue("11111111-1111-4111-8111-111111111111" as never);
  log = vi.spyOn(console, "error").mockImplementation(() => {});
  fetchSpy = vi.spyOn(globalThis, "fetch");
});

describe("POST /api/billing/guest-checkout", () => {
  it("fails closed when Stripe is not configured, saving nothing and never using Lemon Squeezy", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    mockConfigured.mockReturnValue(false);
    const res = await POST(request("founder_basic"));
    const body = await readJsonResponse<{ error: string; url?: string }>(res);
    expect(res.status).toBe(503);
    expect(body.url).toBeUndefined();
    expect(mockSignup).not.toHaveBeenCalled();
    expect(mockStripe).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Stripe is not configured"));
  });

  it("fails closed, saving no paid signup, when the plan has no Stripe price", async () => {
    const res = await POST(request("founder_professional"));
    const body = await readJsonResponse<{ error: string; url?: string }>(res);
    expect(res.status).toBe(503);
    expect(body.url).toBeUndefined();
    expect(mockSignup).not.toHaveBeenCalled();
    expect(mockStripe).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Stripe current price for founder_professional is not configured"));
  });

  it("returns a Stripe checkout link that carries the paid signup id", async () => {
    const res = await POST(request("founder_basic"));
    const body = await readJsonResponse<{ url: string }>(res);
    expect(res.status).toBe(200);
    expect(body.url).toBe("https://checkout.stripe.test/guest");
    expect(mockStripe).toHaveBeenCalledWith(expect.objectContaining({ priceId: "price_basic_99", profileId: null, signupId: "11111111-1111-4111-8111-111111111111" }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
