import { afterEach, describe, expect, it, vi } from "vitest";
import { activateConvertedOrg, isConvertPlan, loadConversions, tierForPlan, variantIdForPlan } from "./convert-to-paid";

// A tiny stand-in for the Supabase query builder: every chain method returns the same
// object, and awaiting it yields the result registered for the table and operation.
function fakeAdmin(results: {
  companies?: { data?: unknown; error?: unknown };
  orgSelect?: { data?: unknown; error?: unknown };
  orgUpdate?: { error?: unknown };
}) {
  const updates: unknown[] = [];
  const chain = (result: unknown) => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "not"]) c[m] = () => c;
    c.then = (resolve: (v: unknown) => void) => resolve(result);
    return c;
  };
  return {
    updates,
    client: {
      from: (table: string) => {
        if (table === "companies") return chain(results.companies ?? { data: [] });
        return {
          select: () => chain(results.orgSelect ?? { data: [] }),
          update: (payload: unknown) => {
            updates.push(payload);
            return chain(results.orgUpdate ?? { error: null });
          },
        };
      },
    },
  };
}

afterEach(() => vi.unstubAllEnvs());

describe("convert plan helpers", () => {
  it("accepts only Basic and Professional", () => {
    expect(isConvertPlan("founder_basic")).toBe(true);
    expect(isConvertPlan("founder_professional")).toBe(true);
    expect(isConvertPlan("founder_premium")).toBe(false);
    expect(isConvertPlan(null)).toBe(false);
  });

  it("maps a plan to its organization tier", () => {
    expect(tierForPlan("founder_basic")).toBe("basic");
    expect(tierForPlan("founder_professional")).toBe("professional");
    expect(tierForPlan("founder_premium")).toBeNull();
  });

  it("reads the Lemon Squeezy variant for each plan from the environment", () => {
    vi.stubEnv("LEMONSQUEEZY_VARIANT_ID_BASIC", "111");
    vi.stubEnv("LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL", "222");
    expect(variantIdForPlan("founder_basic")).toBe("111");
    expect(variantIdForPlan("founder_professional")).toBe("222");
  });
});

describe("activateConvertedOrg", () => {
  it("makes a pending demo a normal paying account and clears the pending fields", async () => {
    const { client, updates } = fakeAdmin({
      companies: { data: [{ org_id: "o1" }] },
      orgSelect: { data: [{ id: "o1", conversion_plan: "founder_basic" }] },
    });
    await expect(activateConvertedOrg(client, "f1")).resolves.toBe(true);
    expect(updates).toEqual([
      {
        billing_status: "active",
        purpose: null,
        email_dispatch_enabled: true,
        tier: "basic",
        conversion_plan: null,
        conversion_name: null,
        conversion_email: null,
        conversion_sent_at: null,
      },
    ]);
  });

  it("does nothing for a founder with no company linked to an account", async () => {
    const { client, updates } = fakeAdmin({ companies: { data: [{ org_id: null }] } });
    await expect(activateConvertedOrg(client, "f1")).resolves.toBe(false);
    expect(updates).toHaveLength(0);
  });

  it("does nothing when no account is pending", async () => {
    const { client, updates } = fakeAdmin({ companies: { data: [{ org_id: "o1" }] }, orgSelect: { data: [] } });
    await expect(activateConvertedOrg(client, "f1")).resolves.toBe(false);
    expect(updates).toHaveLength(0);
  });

  it("never throws, so it can not fail the billing webhook", async () => {
    const broken = { from: () => { throw new Error("boom"); } };
    await expect(activateConvertedOrg(broken, "f1")).resolves.toBe(false);
  });
});

describe("loadConversions", () => {
  it("returns pending conversions keyed by account", async () => {
    const { client } = fakeAdmin({
      orgSelect: { data: [{ id: "o1", conversion_plan: "founder_professional", conversion_name: "Chris", conversion_email: "c@x.com", conversion_sent_at: "2026-11-19T10:00:00Z" }] },
    });
    await expect(loadConversions(client)).resolves.toEqual({
      o1: { plan: "founder_professional", name: "Chris", email: "c@x.com", sentAt: "2026-11-19T10:00:00Z" },
    });
  });

  it("returns nothing when the migration has not been applied", async () => {
    const { client } = fakeAdmin({ orgSelect: { error: { message: "column does not exist" } } });
    await expect(loadConversions(client)).resolves.toEqual({});
  });
});
