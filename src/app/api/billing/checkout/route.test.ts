import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readJsonResponse } from "@/test/mock-supabase";

vi.mock("@/lib/supabase/auth", () => ({ requireUserProfile: vi.fn() }));
vi.mock("@/lib/billing/billing-access", () => ({ billingOwnerOnlyResponse: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/analytics/funnel", () => ({ recordFunnelEvent: vi.fn() }));
vi.mock("@/lib/billing/premium-agreement", () => ({ findCurrentAcceptance: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ stripeConfigured: vi.fn(), createStripeCheckoutUrl: vi.fn() }));

import { POST } from "./route";
import { requireUserProfile } from "@/lib/supabase/auth";
import { billingOwnerOnlyResponse } from "@/lib/billing/billing-access";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createStripeCheckoutUrl, stripeConfigured } from "@/lib/stripe";

const mockProfile = vi.mocked(requireUserProfile);
const mockBlocked = vi.mocked(billingOwnerOnlyResponse);
const mockAdmin = vi.mocked(createServiceRoleClient);
const mockStripe = vi.mocked(createStripeCheckoutUrl);
const mockConfigured = vi.mocked(stripeConfigured);

function db(row: Record<string, unknown> | null = null) {
  return {
    from: () => ({
      insert: async () => ({ error: null }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
    }),
  };
}

function request(planType: string) {
  return new NextRequest("http://test/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ planType, refundPolicyAcceptedAt: "2026-11-25T00:00:00.000Z", refundPolicyVersion: "v1" }),
  });
}

let log: ReturnType<typeof vi.spyOn>;
let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  // Everything that used to send a founder to Lemon Squeezy is set, so a fallback would show.
  vi.stubEnv("LEMONSQUEEZY_API_KEY", "ls_key");
  vi.stubEnv("LEMONSQUEEZY_VARIANT_ID_BASIC", "111");
  vi.stubEnv("LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL", "222");
  vi.stubEnv("LEMONSQUEEZY_CHECKOUT_URL_BASIC", "https://example.lemonsqueezy.com/checkout/buy/basic");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
  vi.stubEnv("STRIPE_PRICE_BASIC", "price_basic_99");
  vi.stubEnv("STRIPE_PRICE_PROFESSIONAL", "");
  mockConfigured.mockReturnValue(true);
  mockStripe.mockResolvedValue("https://checkout.stripe.test/s");
  mockProfile.mockResolvedValue({ id: "p1", email: "a@x.com" } as never);
  mockBlocked.mockResolvedValue(null as never);
  mockAdmin.mockReturnValue(db() as never);
  log = vi.spyOn(console, "error").mockImplementation(() => {});
  fetchSpy = vi.spyOn(globalThis, "fetch");
});

describe("POST /api/billing/checkout", () => {
  it("fails closed when Stripe is not configured, and never falls back to Lemon Squeezy", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    mockConfigured.mockReturnValue(false);
    const res = await POST(request("founder_basic"));
    const body = await readJsonResponse<{ error: string; url?: string }>(res);
    expect(res.status).toBe(503);
    expect(body.error).toContain("Online checkout is not available");
    expect(body.url).toBeUndefined();
    expect(mockStripe).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Stripe is not configured"));
  });

  it("fails closed when the plan has no Stripe price", async () => {
    const res = await POST(request("founder_professional"));
    const body = await readJsonResponse<{ error: string; url?: string }>(res);
    expect(res.status).toBe(503);
    expect(body.url).toBeUndefined();
    expect(mockStripe).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Stripe current price for founder_professional is not configured"));
  });

  it("returns a Stripe checkout link at the current price for a new subscriber", async () => {
    const res = await POST(request("founder_basic"));
    const body = await readJsonResponse<{ url: string }>(res);
    expect(res.status).toBe(200);
    expect(body.url).toBe("https://checkout.stripe.test/s");
    expect(mockStripe).toHaveBeenCalledWith(expect.objectContaining({ priceId: "price_basic_99", profileId: "p1", replacesLsSubscriptionId: null }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
