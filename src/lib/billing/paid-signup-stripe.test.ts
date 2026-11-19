import { beforeEach, describe, expect, it, vi } from "vitest";

const updates: Array<Record<string, unknown>> = [];
let currentRow: Record<string, unknown> | null = null;

vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: currentRow }) }) }),
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));

const sendEmail = vi.fn(async () => true);
vi.mock("@/lib/email/send-email", () => ({ sendEmail: (...args: unknown[]) => sendEmail(...(args as [])) }));
vi.mock("@/lib/activity/email-templates", () => ({ absoluteUrl: (p: string) => `https://icapos.com${p}` }));
vi.mock("@/lib/billing/paid-signup-email", () => ({
  renderPaidSignupEmail: () => ({ subject: "s", html: "h", text: "t" }),
}));
vi.mock("@/lib/analytics/funnel", () => ({ recordFunnelEvent: vi.fn() }));
vi.mock("@/lib/notifications/new-customer-alerts", () => ({ alertStaffNewCustomer: vi.fn() }));
vi.mock("@/lib/notifications/guest-payment-alert", () => ({ alertStaffGuestPayment: vi.fn() }));
vi.mock("@/lib/notifications/founder-welcome-letter", () => ({ sendFounderWelcomeLetter: vi.fn() }));
vi.mock("@/lib/sales/automation", () => ({ fireCrmAutomation: vi.fn() }));

import { recordGuestPayment } from "./paid-signup";

const baseRow = {
  id: "signup-1",
  email: "new@founder.com",
  plan_type: "founder_basic",
  full_name: "New Founder",
  status: "checkout_started",
};

const stripeInput = {
  signupId: "signup-1",
  stripe: { subscriptionId: "sub_123", customerId: "cus_123", priceId: "price_basic" },
  userEmail: "",
  plan: "founder_basic" as const,
  status: "active",
  currentPeriodEnd: "2026-12-20T00:00:00.000Z",
  graceEndsAt: null,
  cancelAtPeriodEnd: false,
};

beforeEach(() => {
  updates.length = 0;
  sendEmail.mockClear();
  currentRow = { ...baseRow };
});

describe("recordGuestPayment with a Stripe payment", () => {
  it("saves the Stripe ids and leaves the Lemon Squeezy ids alone", async () => {
    const result = await recordGuestPayment(stripeInput);
    expect(result).toEqual({ found: true });
    const patch = updates[0];
    expect(patch.stripe_subscription_id).toBe("sub_123");
    expect(patch.stripe_customer_id).toBe("cus_123");
    expect(patch.stripe_price_id).toBe("price_basic");
    expect("ls_subscription_id" in patch).toBe(false);
    expect("ls_customer_id" in patch).toBe(false);
  });

  it("marks the signup paid and emails the login link the first time it reads active", async () => {
    await recordGuestPayment(stripeInput);
    const patch = updates[0];
    expect(patch.status).toBe("paid");
    expect(patch.paid_email).toBe("new@founder.com");
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("does not email twice when a later event arrives for a paid signup", async () => {
    currentRow = { ...baseRow, status: "paid" };
    await recordGuestPayment(stripeInput);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(updates[0].status).toBeUndefined();
  });

  it("does not mark the signup paid while the status is not active", async () => {
    await recordGuestPayment({ ...stripeInput, status: "past_due" });
    expect(updates[0].status).toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("ignores a signup that is already claimed", async () => {
    currentRow = { ...baseRow, status: "claimed" };
    const result = await recordGuestPayment(stripeInput);
    expect(result).toEqual({ found: true });
    expect(updates).toHaveLength(0);
  });

  it("reports an unknown signup so the webhook can ignore it", async () => {
    currentRow = null;
    expect(await recordGuestPayment(stripeInput)).toEqual({ found: false });
  });
});

describe("recordGuestPayment with a Lemon Squeezy payment (unchanged)", () => {
  it("still saves the Lemon Squeezy ids", async () => {
    await recordGuestPayment({
      signupId: "signup-1",
      lsSubscriptionId: "ls_1",
      lsCustomerId: "9",
      lsVariantId: "7",
      userEmail: "new@founder.com",
      plan: "founder_basic",
      status: "active",
      currentPeriodEnd: null,
      graceEndsAt: null,
      cancelAtPeriodEnd: false,
    });
    const patch = updates[0];
    expect(patch.ls_subscription_id).toBe("ls_1");
    expect("stripe_subscription_id" in patch).toBe(false);
  });
});
