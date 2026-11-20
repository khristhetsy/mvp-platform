import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  own: null as null | { id: string; role: string },
  scope: null as null | { profile: { id: string }; supabase: unknown; company: { id: string }; actingStaffId: string },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/auth", () => ({
  requireRole: async () => {
    if (!state.own) throw new Error("NEXT_REDIRECT");
    return state.own;
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => ({ kind: "session" }) }));
vi.mock("@/lib/admin/act-on-behalf", () => ({ resolveActingFounderScope: async () => state.scope }));

import { resolveSupportRequester } from "./requester";

describe("resolveSupportRequester", () => {
  beforeEach(() => {
    state.own = null;
    state.scope = null;
  });

  it("uses the signed in founder and ignores any acting scope", async () => {
    state.own = { id: "founder-1", role: "founder" };
    state.scope = { profile: { id: "other" }, supabase: {}, company: { id: "c" }, actingStaffId: "staff-1" };
    const r = await resolveSupportRequester();
    expect(r?.profile.id).toBe("founder-1");
    expect(r?.actingStaffId).toBeNull();
  });

  it("falls back to the founder staff are acting as", async () => {
    state.scope = { profile: { id: "founder-2" }, supabase: { kind: "service" }, company: { id: "co-2" }, actingStaffId: "staff-1" };
    const r = await resolveSupportRequester();
    expect(r?.profile.id).toBe("founder-2");
    expect(r?.actingCompany?.id).toBe("co-2");
    expect(r?.actingStaffId).toBe("staff-1");
  });

  it("returns null when nobody qualifies", async () => {
    expect(await resolveSupportRequester()).toBeNull();
  });
});
