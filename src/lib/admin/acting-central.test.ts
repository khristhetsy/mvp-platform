import { beforeEach, describe, expect, it, vi } from "vitest";

// The central switch decides whether a request runs as the founder. These pin the cases
// where it must NOT, and the one where it must.
const state = vi.hoisted(() => ({
  cookie: "act-cookie-1" as string | undefined,
  zone: "founder" as string | null,
  referer: null as string | null,
  noRequest: false,
  ctx: { founderId: "founder-1", staffId: "staff-1" } as { founderId: string; staffId: string } | null,
  getActingContext: vi.fn(),
  sessions: 0,
}));

vi.mock("next/headers", () => ({
  cookies: async () => {
    if (state.noRequest) throw new Error("no request");
    return {
      get: (n: string) => (n === "icapos_act_as" && state.cookie ? { value: state.cookie } : undefined),
      getAll: () => [{ name: "sb-abc-auth-token", value: "session-value" }],
    };
  },
  headers: async () => ({ get: (n: string) => (n === "x-icapos-zone" ? state.zone : n === "referer" ? state.referer : null) }),
}));
vi.mock("@/lib/admin/act-on-behalf", () => ({
  ACT_COOKIE: "icapos_act_as",
  getActingContext: (...a: unknown[]) => state.getActingContext(...a),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: { email: "founder@example.com" } } }),
        generateLink: async () => ({ data: { properties: { hashed_token: "hash" } }, error: null }),
      },
    },
  }),
}));
vi.mock("@/lib/supabase/env", () => ({ getSupabaseBrowserEnv: () => ({ url: "https://x.supabase.co", anonKey: "anon" }) }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      verifyOtp: async () => {
        state.sessions += 1;
        return { data: { session: { access_token: "founder-jwt", user: { id: "founder-1" }, expires_in: 3600 } }, error: null };
      },
    },
  }),
}));
vi.mock("@/lib/supabase/token-client", () => ({ createTokenClient: (token: string) => ({ asFounder: token }) }));

async function load() {
  vi.resetModules();
  return import("@/lib/admin/acting-central");
}

beforeEach(() => {
  process.env.ACT_AS_FOUNDER_CENTRAL = "1";
  state.cookie = `act-cookie-${Math.random()}`;
  state.zone = "founder";
  state.referer = null;
  state.noRequest = false;
  state.ctx = { founderId: "founder-1", staffId: "staff-1" };
  state.sessions = 0;
  state.getActingContext = vi.fn(async () => state.ctx);
});

describe("resolveCentralActingClient", () => {
  it("runs as the founder for a valid acting session on a founder screen", async () => {
    const { resolveCentralActingClient } = await load();
    expect(await resolveCentralActingClient()).toEqual({ asFounder: "founder-jwt" });
  });

  it("does nothing when the switch is off", async () => {
    delete process.env.ACT_AS_FOUNDER_CENTRAL;
    const { resolveCentralActingClient } = await load();
    expect(await resolveCentralActingClient()).toBeNull();
    expect(state.getActingContext).not.toHaveBeenCalled();
  });

  it("does nothing without the acting cookie", async () => {
    state.cookie = undefined;
    const { resolveCentralActingClient } = await load();
    expect(await resolveCentralActingClient()).toBeNull();
    expect(state.getActingContext).not.toHaveBeenCalled();
  });

  it("keeps the staff identity on admin and investor screens", async () => {
    const { resolveCentralActingClient } = await load();
    state.zone = "admin";
    expect(await resolveCentralActingClient()).toBeNull();
    state.zone = "investor";
    expect(await resolveCentralActingClient()).toBeNull();
  });

  it("applies on routes outside the proxy matcher (no zone)", async () => {
    state.zone = null;
    const { resolveCentralActingClient } = await load();
    expect(await resolveCentralActingClient()).toEqual({ asFounder: "founder-jwt" });
  });

  it("keeps calls made from admin pages on the staff identity (shared routes carry no zone)", async () => {
    state.zone = null;
    state.referer = "https://icapos.com/admin/sales/contacts";
    const { resolveCentralActingClient } = await load();
    expect(await resolveCentralActingClient()).toBeNull();
  });

  it("runs calls made from founder pages as the founder (shared routes carry no zone)", async () => {
    state.zone = null;
    state.referer = "https://icapos.com/founder/dashboard";
    const { resolveCentralActingClient } = await load();
    expect(await resolveCentralActingClient()).toEqual({ asFounder: "founder-jwt" });
  });

  it("trusts the zone header over the Referer", async () => {
    state.zone = "founder";
    state.referer = "https://icapos.com/admin/x";
    const { resolveCentralActingClient } = await load();
    expect(await resolveCentralActingClient()).toEqual({ asFounder: "founder-jwt" });
  });

  it("does nothing when the acting session is not valid", async () => {
    state.ctx = null;
    const { resolveCentralActingClient } = await load();
    expect(await resolveCentralActingClient()).toBeNull();
  });

  it("does nothing outside a request (cron, scheduled sends)", async () => {
    state.noRequest = true;
    const { resolveCentralActingClient } = await load();
    expect(await resolveCentralActingClient()).toBeNull();
  });

  it("reuses a verified decision instead of checking on every call", async () => {
    const { resolveCentralActingClient } = await load();
    await resolveCentralActingClient();
    await resolveCentralActingClient();
    await resolveCentralActingClient();
    expect(state.getActingContext).toHaveBeenCalledTimes(1);
    expect(state.sessions).toBe(1);
  });
});

describe("isActingAsFounder, actingStaffId and actingBlock", () => {
  it("name the staff member while a session applies", async () => {
    const { actingStaffId, isActingAsFounder } = await load();
    expect(await actingStaffId()).toBe("staff-1");
    expect(await isActingAsFounder()).toBe(true);
  });

  it("are false on admin screens, without a session, and when the switch is off", async () => {
    const { isActingAsFounder } = await load();
    state.zone = "admin";
    expect(await isActingAsFounder()).toBe(false);
    state.zone = "founder";
    state.ctx = null;
    expect(await isActingAsFounder()).toBe(false);
    state.ctx = { founderId: "founder-1", staffId: "staff-1" };
    delete process.env.ACT_AS_FOUNDER_CENTRAL;
    expect(await isActingAsFounder()).toBe(false);
  });

  it("actingBlock refuses with a 403 only while acting", async () => {
    const { actingBlock } = await load();
    const blocked = await actingBlock();
    expect(blocked?.status).toBe(403);
    state.ctx = null;
    expect(await actingBlock()).toBeNull();
  });
});
