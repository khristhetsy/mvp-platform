import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const calls = { getUser: 0, profiles: 0 };
let profileRow: Record<string, unknown> | null = null;
const user = { id: "u1", email: "u1@example.com" };

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async (jwt?: string) => {
        calls.getUser += 1;
        return jwt === "good" || jwt === "other-good"
          ? { data: { user }, error: null }
          : { data: { user: null }, error: { message: "invalid" } };
      },
    },
    from: (table: string) => {
      if (table === "profiles") calls.profiles += 1;
      return { select: () => ({ eq: () => ({ single: async () => ({ data: profileRow, error: null }) }) }) };
    },
  }),
}));

import { withBearerFounder, withBearerRole } from "./_bearer";
import { withBearerInvestor } from "./_bearer-investor";
import { asMember, MOBILE_TIMEOUT_MS } from "./_proxy";

function req(token?: string) {
  return new Request("https://icapos.test/api/mobile/x", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  calls.getUser = 0;
  calls.profiles = 0;
  profileRow = { id: "u1", role: "founder" };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("mobile bearer sign in", () => {
  it("verifies the token and loads the profile once, even when the handler asks again", async () => {
    const r = await withBearerFounder(req("good"), async ({ client }) => {
      const again = await client.auth.getUser();
      return again.data.user?.id;
    });
    expect(r).toEqual({ ok: true, value: "u1" });
    expect(calls).toEqual({ getUser: 1, profiles: 1 });
  });

  it("still sends a getUser for a different token to Supabase", async () => {
    await withBearerFounder(req("good"), async ({ client }) => {
      await client.auth.getUser("other-good");
    });
    expect(calls.getUser).toBe(2);
  });

  it("serves an investor on a shared route with one verification, not two", async () => {
    profileRow = { id: "u1", role: "investor" };
    const r = await withBearerRole(req("good"), ["founder", "investor"], async ({ profile }) => profile.role);
    expect(r).toEqual({ ok: true, value: "investor" });
    expect(calls).toEqual({ getUser: 1, profiles: 1 });
  });

  it("keeps the two sides apart", async () => {
    profileRow = { id: "u1", role: "investor" };
    expect(await withBearerFounder(req("good"), async () => 1)).toEqual({ ok: false, status: 403 });
    profileRow = { id: "u1", role: "founder" };
    expect(await withBearerInvestor(req("good"), async () => 1)).toEqual({ ok: false, status: 403 });
    profileRow = { id: "u1", role: "admin" };
    expect(await withBearerRole(req("good"), ["founder", "investor"], async () => 1)).toEqual({ ok: false, status: 403 });
  });

  it("answers 403 when there is no profile, 401 for a missing or bad token", async () => {
    profileRow = null;
    expect(await withBearerFounder(req("good"), async () => 1)).toEqual({ ok: false, status: 403 });
    expect(await withBearerFounder(req(), async () => 1)).toEqual({ ok: false, status: 401 });
    expect(await withBearerFounder(req("bad"), async () => 1)).toEqual({ ok: false, status: 401 });
  });

  it("answers 504 when a handler runs past the timeout", async () => {
    vi.useFakeTimers();
    const pending = asMember(req("good"), () => new Promise<Response>(() => {}));
    await vi.advanceTimersByTimeAsync(MOBILE_TIMEOUT_MS + 10);
    const res = await pending;
    expect(res.status).toBe(504);
  });

  it("passes a normal response through", async () => {
    const res = await asMember(req("good"), async () => Response.json({ ok: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
