import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A new founder's chosen plan is saved on their auth user at signup. Several
 * screens create the subscription row without being handed that plan, so the
 * creator itself must read it, otherwise the row defaults to Basic awaiting
 * payment and the founder who asked for Free is sent to checkout.
 */
const state = vi.hoisted(() => ({
  existing: null as Record<string, unknown> | null,
  metadata: {} as Record<string, unknown>,
  getUserError: null as { message: string } | null,
  getUserThrows: false,
  upserted: null as Record<string, unknown> | null,
  getUserById: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({
    auth: {
      admin: {
        getUserById: async (id: string) => {
          state.getUserById(id);
          if (state.getUserThrows) throw new Error("auth down");
          if (state.getUserError) return { data: { user: null }, error: state.getUserError };
          return { data: { user: { id, user_metadata: state.metadata } }, error: null };
        },
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: state.existing, error: null }) }),
      }),
      upsert: (row: Record<string, unknown>) => {
        state.upserted = row;
        return {
          select: () => ({
            maybeSingle: async () => ({ data: { id: "s1", ...row }, error: null }),
          }),
        };
      },
    }),
  }),
}));

import { ensureSubscriptionForProfile } from "@/lib/subscriptions/get-subscription";

describe("ensureSubscriptionForProfile: the plan chosen at signup", () => {
  beforeEach(() => {
    state.existing = null;
    state.metadata = {};
    state.getUserError = null;
    state.getUserThrows = false;
    state.upserted = null;
    state.getUserById.mockClear();
  });

  it("gives Free to a founder who asked for it, even when the caller passes no plan", async () => {
    state.metadata = { requested_plan: "founder_free" };
    await ensureSubscriptionForProfile({ profileId: "p1", role: "founder" });
    expect(state.upserted).toMatchObject({
      plan_type: "founder_free",
      subscription_status: "free",
      monthly_price_cents: 0,
    });
  });

  it("keeps the paid plan a founder asked for, still awaiting payment", async () => {
    state.metadata = { requested_plan: "founder_professional" };
    await ensureSubscriptionForProfile({ profileId: "p1", role: "founder" });
    expect(state.upserted).toMatchObject({
      plan_type: "founder_professional",
      subscription_status: "pending_payment",
    });
  });

  it("lets a plan passed by the caller win over the saved one", async () => {
    state.metadata = { requested_plan: "founder_free" };
    await ensureSubscriptionForProfile({ profileId: "p1", role: "founder", requestedPlan: "founder_professional" });
    expect(state.upserted).toMatchObject({ plan_type: "founder_professional" });
    expect(state.getUserById).not.toHaveBeenCalled();
  });

  it("falls back to Basic awaiting payment when no plan was saved (Google signups)", async () => {
    await ensureSubscriptionForProfile({ profileId: "p1", role: "founder" });
    expect(state.upserted).toMatchObject({ plan_type: "founder_basic", subscription_status: "pending_payment" });
  });

  it("ignores a saved value that is not a known signup plan", async () => {
    state.metadata = { requested_plan: "admin_internal" };
    await ensureSubscriptionForProfile({ profileId: "p1", role: "founder" });
    expect(state.upserted).toMatchObject({ plan_type: "founder_basic" });
  });

  it("still creates the default row when the auth lookup errors or throws", async () => {
    state.getUserError = { message: "timeout" };
    await ensureSubscriptionForProfile({ profileId: "p1", role: "founder" });
    expect(state.upserted).toMatchObject({ plan_type: "founder_basic" });

    state.upserted = null;
    state.getUserError = null;
    state.getUserThrows = true;
    await ensureSubscriptionForProfile({ profileId: "p2", role: "founder" });
    expect(state.upserted).toMatchObject({ plan_type: "founder_basic" });
  });

  it("does not look the plan up for investors, and never touches an existing row", async () => {
    await ensureSubscriptionForProfile({ profileId: "p3", role: "investor" });
    expect(state.upserted).toMatchObject({ plan_type: "investor_free" });
    expect(state.getUserById).not.toHaveBeenCalled();

    state.upserted = null;
    state.existing = {
      id: "s9",
      profile_id: "p4",
      plan_type: "founder_basic",
      subscription_status: "active",
    };
    state.metadata = { requested_plan: "founder_free" };
    const result = await ensureSubscriptionForProfile({ profileId: "p4", role: "founder" });
    expect(result.plan_type).toBe("founder_basic");
    expect(state.upserted).toBeNull();
  });
});
