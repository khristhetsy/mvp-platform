import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({}) }));

import { hasPaidSubscription } from "./investor-outreach";

function fakeDb(row: Record<string, unknown> | null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: row, error: null }),
  };
  return { from: () => chain } as never;
}

describe("hasPaidSubscription", () => {
  it("allows an active paid Lemon Squeezy subscription", async () => {
    expect(await hasPaidSubscription(fakeDb({ subscription_status: "active", monthly_price_cents: 4900, ls_subscription_id: "123" }), "f")).toBe(true);
  });
  it("allows an active paid Stripe subscription", async () => {
    expect(await hasPaidSubscription(fakeDb({ subscription_status: "active", monthly_price_cents: 19900, stripe_subscription_id: "sub_1" }), "f")).toBe(true);
  });
  it("blocks an active row with no payment behind it", async () => {
    expect(await hasPaidSubscription(fakeDb({ subscription_status: "active", monthly_price_cents: 19900 }), "f")).toBe(false);
  });
  it("blocks free, pending, expired and internal", async () => {
    for (const s of ["free", "pending_payment", "expired", "canceled", "internal"]) {
      expect(await hasPaidSubscription(fakeDb({ subscription_status: s, monthly_price_cents: 4900, ls_subscription_id: "1" }), "f")).toBe(false);
    }
  });
  it("blocks a $0 plan and a missing row", async () => {
    expect(await hasPaidSubscription(fakeDb({ subscription_status: "active", monthly_price_cents: 0, ls_subscription_id: "1" }), "f")).toBe(false);
    expect(await hasPaidSubscription(fakeDb(null), "f")).toBe(false);
  });
});
