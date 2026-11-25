import crypto from "crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readJsonResponse } from "@/test/mock-supabase";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/monitoring/operational-events", () => ({
  recordOperationalEvent: vi.fn(),
  reportServerFailure: vi.fn(),
}));
vi.mock("@/lib/analytics/funnel", () => ({ recordFunnelEvent: vi.fn() }));
vi.mock("@/lib/notifications/new-customer-alerts", () => ({ alertStaffNewCustomer: vi.fn() }));
vi.mock("@/lib/organizations/convert-to-paid", () => ({ activateConvertedOrg: vi.fn() }));
vi.mock("@/lib/billing/past-due-alerts", () => ({ notifyPastDue: vi.fn() }));

import { POST } from "./route";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { recordOperationalEvent } from "@/lib/monitoring/operational-events";
import { alertStaffNewCustomer } from "@/lib/notifications/new-customer-alerts";

const mockAdmin = vi.mocked(createServiceRoleClient);
const mockEvent = vi.mocked(recordOperationalEvent);
const mockAlert = vi.mocked(alertStaffNewCustomer);

const SECRET = "whsec_test";

type Row = Record<string, unknown>;

/** A subscriptions table that records every write, so "no row created" is checkable. */
function db(rows: Row[]) {
  const writes = {
    insert: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    lookups: [] as Array<[string, unknown]>,
  };
  const client = {
    from: (table: string) => ({
      select: () => ({
        eq: (column: string, value: unknown) => ({
          maybeSingle: async () => {
            writes.lookups.push([column, value]);
            return { data: rows.find((r) => r[column] === value) ?? null, error: null };
          },
        }),
      }),
      insert: async (values: unknown) => {
        writes.insert(table, values);
        return { error: null };
      },
      upsert: async (values: unknown) => {
        writes.upsert(table, values);
        return { error: null };
      },
      update: (patch: Row) => ({
        eq: async (column: string, value: unknown) => {
          writes.update(table, patch, column, value);
          return { error: null };
        },
      }),
    }),
  };
  return { client, writes };
}

function payload(eventName: string, id: string, attributes: Row = {}, customData?: Row) {
  return JSON.stringify({
    meta: { event_name: eventName, custom_data: customData },
    data: {
      id,
      type: "subscriptions",
      attributes: {
        status: "active",
        variant_id: 111,
        variant_name: "Basic",
        product_name: "iCapOS Basic",
        customer_id: 77,
        user_email: "founder@example.com",
        renews_at: "2026-12-25T00:00:00.000Z",
        ends_at: null,
        trial_ends_at: null,
        ...attributes,
      },
    },
  });
}

function sign(body: string, secret = SECRET) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function request(body: string, signature: string) {
  return new NextRequest("http://test/api/billing/webhook", {
    method: "POST",
    body,
    headers: { "X-Signature": signature },
  });
}

const existingRow = {
  id: "sub-row-1",
  profile_id: "profile-1",
  ls_subscription_id: "ls_existing",
  pending_plan_type: null,
  plan_type: "founder_basic",
  subscription_status: "active",
  grace_period_ends_at: null,
  cancel_at_period_end: false,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("LEMONSQUEEZY_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("LEMONSQUEEZY_VARIANT_ID_BASIC", "111");
  vi.stubEnv("LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL", "222");
});

describe("Lemon Squeezy webhook: new subscriptions are ignored", () => {
  it("ignores subscription_created for a new id, writes no row and logs the event", async () => {
    const { client, writes } = db([existingRow]);
    mockAdmin.mockReturnValue(client as never);
    const body = payload("subscription_created", "ls_new", {}, { profile_id: "profile-9" });

    const res = await POST(request(body, sign(body)));

    expect(res.status).toBe(200);
    expect(await readJsonResponse(res)).toEqual({ received: true, ignored: "new subscription" });
    expect(writes.insert).not.toHaveBeenCalled();
    expect(writes.upsert).not.toHaveBeenCalled();
    expect(writes.update).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockEvent).toHaveBeenCalledTimes(1);
    expect(mockEvent.mock.calls[0][1]).toMatchObject({
      action: "billing.lemon.ignored_new_subscription",
      metadata: { ls_subscription_id: "ls_new", event_name: "subscription_created" },
    });
  });

  it("ignores an update event for an id that is not in subscriptions, even with a profile id", async () => {
    const { client, writes } = db([existingRow]);
    mockAdmin.mockReturnValue(client as never);
    // profile-1 has a row, but under a different Lemon Squeezy id: it must not be touched.
    const body = payload("subscription_updated", "ls_unknown", {}, { profile_id: "profile-1" });

    const res = await POST(request(body, sign(body)));

    expect(res.status).toBe(200);
    expect(await readJsonResponse(res)).toEqual({ received: true, ignored: "new subscription" });
    expect(writes.lookups).toEqual([["ls_subscription_id", "ls_unknown"]]);
    expect(writes.insert).not.toHaveBeenCalled();
    expect(writes.upsert).not.toHaveBeenCalled();
    expect(writes.update).not.toHaveBeenCalled();
    expect(mockEvent.mock.calls[0][1]).toMatchObject({
      action: "billing.lemon.ignored_new_subscription",
      metadata: { ls_subscription_id: "ls_unknown", event_name: "subscription_updated" },
    });
  });

  it("ignores a paid signup (guest) payment and an order_created event", async () => {
    const { client, writes } = db([existingRow]);
    mockAdmin.mockReturnValue(client as never);

    const guest = payload("subscription_created", "ls_guest", {}, { signup_id: "signup-1" });
    expect((await POST(request(guest, sign(guest)))).status).toBe(200);
    // An order id that collides with a stored subscription id is still not a subscription.
    const order = payload("order_created", "ls_existing", {}, { profile_id: "profile-1" });
    expect((await POST(request(order, sign(order)))).status).toBe(200);

    expect(writes.insert).not.toHaveBeenCalled();
    expect(writes.upsert).not.toHaveBeenCalled();
    expect(writes.update).not.toHaveBeenCalled();
    expect(mockEvent).toHaveBeenCalledTimes(2);
  });
});

describe("Lemon Squeezy webhook: existing subscriptions update as before", () => {
  it("updates the row that holds the Lemon Squeezy id", async () => {
    const { client, writes } = db([existingRow]);
    mockAdmin.mockReturnValue(client as never);
    const body = payload("subscription_updated", "ls_existing", { variant_id: 222, renews_at: "2027-01-25T00:00:00.000Z" });

    const res = await POST(request(body, sign(body)));

    expect(res.status).toBe(200);
    expect(await readJsonResponse(res)).toEqual({ received: true, updated: "sub-row-1" });
    expect(writes.update).toHaveBeenCalledTimes(1);
    const [table, patch, column, value] = writes.update.mock.calls[0];
    expect(table).toBe("subscriptions");
    expect([column, value]).toEqual(["id", "sub-row-1"]);
    expect(patch).toMatchObject({
      ls_subscription_id: "ls_existing",
      ls_customer_id: "77",
      ls_variant_id: "222",
      plan_type: "founder_professional",
      subscription_status: "active",
      current_period_end: "2027-01-25T00:00:00.000Z",
      grace_period_ends_at: null,
      cancel_at_period_end: false,
    });
    expect(writes.insert).not.toHaveBeenCalled();
    expect(writes.upsert).not.toHaveBeenCalled();
    expect(mockEvent).not.toHaveBeenCalled();
  });

  it("cancels an existing subscription on subscription_expired", async () => {
    const { client, writes } = db([existingRow]);
    mockAdmin.mockReturnValue(client as never);
    const body = payload("subscription_expired", "ls_existing", { status: "expired", renews_at: null, ends_at: "2026-11-20T00:00:00.000Z" });

    const res = await POST(request(body, sign(body)));

    expect(res.status).toBe(200);
    expect(writes.update.mock.calls[0][1]).toMatchObject({ subscription_status: "canceled", plan_type: "founder_basic" });
  });
});

describe("Lemon Squeezy webhook: signature", () => {
  it("rejects a bad signature before reading anything", async () => {
    const { client, writes } = db([existingRow]);
    mockAdmin.mockReturnValue(client as never);
    const body = payload("subscription_updated", "ls_existing");

    for (const signature of [sign(body, "wrong_secret"), "not-a-signature", ""]) {
      const res = await POST(request(body, signature));
      expect(res.status).toBe(401);
      expect(await readJsonResponse(res)).toEqual({ error: "Invalid signature" });
    }
    expect(mockAdmin).not.toHaveBeenCalled();
    expect(writes.lookups).toEqual([]);
    expect(writes.update).not.toHaveBeenCalled();
    expect(mockEvent).not.toHaveBeenCalled();
  });

  it("rejects every request when the webhook secret is not set", async () => {
    vi.stubEnv("LEMONSQUEEZY_WEBHOOK_SECRET", "");
    const body = payload("subscription_updated", "ls_existing");
    const res = await POST(request(body, sign(body, "")));
    expect(res.status).toBe(401);
  });
});
