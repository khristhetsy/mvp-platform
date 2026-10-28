import { beforeEach, describe, expect, it, vi } from "vitest";

// Billing belongs to the Owner. These pin who is turned away, including staff who run as
// the Owner while acting on a founder's behalf.
const state = vi.hoisted(() => ({
  profile: { id: "u1", role: "founder" } as { id: string; role: string } | null,
  member: { role: "owner" } as { role: string } | null,
  memberError: null as { message: string } | null,
  company: { id: "c1" } as { id: string } | null,
  acting: false,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq"]) b[m] = () => b;
      b.maybeSingle = async () =>
        table === "profiles"
          ? { data: state.profile, error: null }
          : { data: state.member, error: state.memberError };
      return b;
    },
  }),
}));
vi.mock("@/lib/organizations/active-company", () => ({ getActiveCompanyForUser: async () => ({ company: state.company }) }));
vi.mock("@/lib/admin/acting-central", () => ({ isActingAsFounder: async () => state.acting }));

import { billingOwnerOnlyResponse, canManageBilling } from "@/lib/billing/billing-access";

beforeEach(() => {
  state.profile = { id: "u1", role: "founder" };
  state.member = { role: "owner" };
  state.memberError = null;
  state.company = { id: "c1" };
  state.acting = false;
});

describe("canManageBilling", () => {
  it("allows the Owner", async () => {
    expect(await canManageBilling("u1")).toBe(true);
  });

  it("turns away Admin, Member and Managed by iCFO", async () => {
    for (const role of ["admin", "member", "managed_icfo"]) {
      state.member = { role };
      expect(await canManageBilling("u1")).toBe(false);
    }
  });

  it("allows a founder with no membership row (they created the company)", async () => {
    state.member = null;
    expect(await canManageBilling("u1")).toBe(true);
  });

  it("turns away staff acting as the Owner", async () => {
    state.acting = true;
    expect(await canManageBilling("u1")).toBe(false);
  });

  it("does not block staff using their own billing tools", async () => {
    state.profile = { id: "s1", role: "admin" };
    state.acting = true;
    expect(await canManageBilling("s1")).toBe(true);
  });

  it("fails closed when the role cannot be read or the profile is missing", async () => {
    state.memberError = { message: "boom" };
    expect(await canManageBilling("u1")).toBe(false);
    state.memberError = null;
    state.profile = null;
    expect(await canManageBilling("u1")).toBe(false);
  });
});

describe("billingOwnerOnlyResponse", () => {
  it("is a 403 for non owners and null for the Owner", async () => {
    expect(await billingOwnerOnlyResponse("u1")).toBeNull();
    state.member = { role: "member" };
    const res = await billingOwnerOnlyResponse("u1");
    expect(res?.status).toBe(403);
  });
});
