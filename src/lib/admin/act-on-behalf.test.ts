import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The acting session is the security gate for running as a founder, so every way it can
// fail is pinned here: bad cookie, wrong person, lost permission, deactivated staff.
const state = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  realUser: "staff-1" as string | null,
  hasPermission: false,
  planActive: true,
  rows: {} as Record<string, unknown>,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "icapos_act_as" && state.cookie ? { value: state.cookie } : undefined), set: () => undefined, delete: () => undefined }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createCookieSupabaseClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.realUser ? { id: state.realUser } : null } }) } }),
}));
vi.mock("@/lib/rbac/effective-permissions", () => ({ canUser: async () => state.hasPermission }));
vi.mock("@/lib/team/managed-icfo", () => ({ ownerHasManagedIcfoPlan: async () => state.planActive }));
vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit", "in"]) b[m] = () => b;
      b.maybeSingle = async () => ({ data: state.rows[table] ?? null, error: null });
      return b;
    },
  }),
}));

const SECRET = "test-secret";
const b64url = (s: string) => Buffer.from(s).toString("base64url");
function token(payload: { f: string; s: string; t: number }, secret = SECRET) {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${crypto.createHmac("sha256", secret).update(body).digest("base64url")}`;
}

async function load() {
  vi.resetModules();
  return import("@/lib/admin/act-on-behalf");
}

beforeEach(() => {
  process.env.TOKEN_ENCRYPTION_SECRET = SECRET;
  delete process.env.CRON_SECRET;
  state.cookie = token({ f: "founder-1", s: "staff-1", t: Date.now() });
  state.realUser = "staff-1";
  state.hasPermission = true;
  state.planActive = true;
  state.rows = {
    profiles: { role: "admin", is_active: true },
    companies: { id: "company-1" },
    company_members: { role: "managed_icfo" },
  };
});

describe("getActingContext", () => {
  it("returns the context for a valid session held by a permitted staff member", async () => {
    const { getActingContext } = await load();
    expect(await getActingContext()).toEqual({ founderId: "founder-1", staffId: "staff-1" });
  });

  it("is off without a signing secret", async () => {
    delete process.env.TOKEN_ENCRYPTION_SECRET;
    const { getActingContext } = await load();
    expect(await getActingContext()).toBeNull();
  });

  it("needs the cookie", async () => {
    state.cookie = undefined;
    const { getActingContext } = await load();
    expect(await getActingContext()).toBeNull();
  });

  it("rejects a tampered or wrongly signed cookie", async () => {
    state.cookie = token({ f: "founder-1", s: "staff-1", t: Date.now() }, "another-secret");
    const { getActingContext } = await load();
    expect(await getActingContext()).toBeNull();
  });

  it("rejects an expired session", async () => {
    state.cookie = token({ f: "founder-1", s: "staff-1", t: Date.now() - 3 * 60 * 60 * 1000 });
    const { getActingContext } = await load();
    expect(await getActingContext()).toBeNull();
  });

  it("rejects a cookie that belongs to someone else", async () => {
    state.realUser = "staff-2";
    const { getActingContext } = await load();
    expect(await getActingContext()).toBeNull();
  });

  it("rejects when nobody is signed in", async () => {
    state.realUser = null;
    const { getActingContext } = await load();
    expect(await getActingContext()).toBeNull();
  });

  it("stops at once when the permission is lost and there is no managed access", async () => {
    state.hasPermission = false;
    state.rows = { profiles: { role: "admin", is_active: true }, companies: { id: "company-1" }, company_members: null };
    const { getActingContext } = await load();
    expect(await getActingContext()).toBeNull();
  });
});

describe("Managed by iCFO access without the permission", () => {
  beforeEach(() => {
    state.hasPermission = false;
  });

  it("allows an active staff member who is Managed by iCFO on a Premium account", async () => {
    const { getActingContext } = await load();
    expect(await getActingContext()).toEqual({ founderId: "founder-1", staffId: "staff-1" });
  });

  it("is refused when the Owner is no longer on an active Premium plan", async () => {
    state.planActive = false;
    const { getActingContext } = await load();
    expect(await getActingContext()).toBeNull();
  });

  it("is refused for a deactivated staff member", async () => {
    state.rows.profiles = { role: "admin", is_active: false };
    const { getActingContext } = await load();
    expect(await getActingContext()).toBeNull();
  });

  it("is refused when the profile is not staff", async () => {
    state.rows.profiles = { role: "founder", is_active: true };
    const { getActingContext } = await load();
    expect(await getActingContext()).toBeNull();
  });

  it("is refused for any other company role", async () => {
    state.rows.company_members = { role: "admin" };
    const { getActingContext } = await load();
    expect(await getActingContext()).toBeNull();
  });

  it("is refused when the staff member is not on the company at all", async () => {
    state.rows.company_members = null;
    const { getActingContext } = await load();
    expect(await getActingContext()).toBeNull();
  });
});
