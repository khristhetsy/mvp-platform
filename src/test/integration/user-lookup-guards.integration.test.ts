import { describe, it, expect, afterAll } from "vitest";
import { closePool, getPool } from "./db";

// The user-id lookup functions must not answer for another user's id unless the
// caller is staff, the service role, or a direct database connection. This
// exercises the shared guard against a real database by faking the JWT claims
// that PostgREST sets, inside a transaction that is always rolled back.

afterAll(async () => {
  await closePool();
});

const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

const GUARDED = [
  "is_super_admin_user",
  "internal_user_has_permission",
  "internal_user_role_slug",
  "internal_user_role_rank",
  "can_admin_departments",
  "is_internal_user",
] as const;

type Caller = { role: "authenticated" | "service_role"; sub?: string } | null;

async function canInspect(caller: Caller, target: string): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    if (caller) {
      const claims = JSON.stringify({ role: caller.role, ...(caller.sub ? { sub: caller.sub } : {}) });
      await client.query("select set_config('request.jwt.claims', $1, true)", [claims]);
      await client.query(`set local role ${caller.role}`);
    }
    const { rows } = await client.query<{ ok: boolean }>("select public.can_inspect_user($1) as ok", [target]);
    return rows[0].ok;
  } finally {
    await client.query("rollback");
    client.release();
  }
}

describe("can_inspect_user", () => {
  it("lets a signed-in user inspect their own id", async () => {
    expect(await canInspect({ role: "authenticated", sub: ME }, ME)).toBe(true);
  });

  it("refuses a signed-in non-staff user asking about someone else", async () => {
    expect(await canInspect({ role: "authenticated", sub: ME }, OTHER)).toBe(false);
  });

  it("lets the service role inspect any id", async () => {
    expect(await canInspect({ role: "service_role" }, OTHER)).toBe(true);
  });

  it("lets a direct database connection (no JWT) inspect any id", async () => {
    expect(await canInspect(null, OTHER)).toBe(true);
  });
});

describe("guard is wired into every lookup function", () => {
  for (const fn of GUARDED) {
    it(`${fn} calls can_inspect_user`, async () => {
      const { rows } = await getPool().query<{ def: string }>(
        `select pg_get_functiondef(p.oid) as def
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = $1`,
        [fn],
      );
      expect(rows.length).toBe(1);
      expect(rows[0].def).toContain("can_inspect_user");
    });
  }
});
