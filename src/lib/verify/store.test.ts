import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = { id: string; name: string | null; email: string | null; phone: string | null; company: string | null; company_domain: string | null; email_status: string | null; email_source: string | null; suppressed: boolean | null };
let rows: Row[] = [];
let unsubs: string[] = [];
const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];

function builder(table: string) {
  const q = {
    _in: [] as string[],
    _head: false,
    select: (_c?: string, o?: { head?: boolean }) => { q._head = Boolean(o?.head); return q; },
    eq: () => q, not: () => q, neq: () => q, order: () => q, limit: () => q,
    in: (_k: string, v: string[]) => { q._in = v; return q; },
    update: (patch: Record<string, unknown>) => ({ eq: async (_k: string, id: string) => { updates.push({ id, patch }); return { error: null }; } }),
    then: (r: (v: unknown) => void) => {
      if (table === "marketing_unsubscribes") return r({ data: unsubs.filter((e) => q._in.includes(e)).map((email) => ({ email })), error: null });
      if (q._head) return r({ count: 0, error: null });
      return r({ data: rows, error: null });
    },
  };
  return q;
}
vi.mock("@/lib/supabase/admin", () => ({ serviceRoleClientUntyped: () => ({ from: (t: string) => builder(t) }) }));
vi.mock("node:dns/promises", () => ({ resolveMx: vi.fn(async () => [{ exchange: "mx", priority: 1 }]) }));
const siteSpy = vi.fn();
vi.mock("@/lib/append/site", () => ({ scrapeSiteContacts: siteSpy }));

import { verifyByIds } from "./store";

const base = (o: Partial<Row>): Row => ({ id: "x", name: "Jane Doe", email: null, phone: null, company: "Acme", company_domain: "acme.com", email_status: "unverified", email_source: null, suppressed: false, ...o });

beforeEach(() => { rows = []; unsubs = []; updates.length = 0; siteSpy.mockClear(); });

describe("bulk verify (D4, D5, D6)", () => {
  it("never writes an email or phone, and never scrapes", async () => {
    rows = [base({ id: "a", email: "jane@acme.com" }), base({ id: "b", email: null })];
    const r = await verifyByIds(["a", "b"]);
    expect(siteSpy).not.toHaveBeenCalled();
    for (const u of updates) { expect(u.patch).not.toHaveProperty("email"); expect(u.patch).not.toHaveProperty("phone"); }
    expect(r).toMatchObject({ verified: 1, valid: 1, missingEmail: 1, appended: 0 });
  });

  it("keeps the source label; an unlabelled address becomes given", async () => {
    rows = [base({ id: "a", email: "jane@acme.com", email_source: "site" }), base({ id: "b", email: "bob@acme.com" })];
    await verifyByIds(["a", "b"]);
    expect(updates.find((u) => u.id === "a")!.patch.email_source).toBe("site");
    expect(updates.find((u) => u.id === "b")!.patch.email_source).toBe("given");
  });

  it("a pattern guess stays risky even when the domain accepts mail", async () => {
    rows = [base({ id: "g", email: "jane.doe@acme.com", email_source: "profile", email_status: "risky" })];
    await verifyByIds(["g"]);
    expect(updates[0].patch).toMatchObject({ email_status: "risky", email_source: "profile" });
    expect(updates[0].patch.contact_confidence).toBeLessThanOrEqual(40);
  });

  it("skips opted-out contacts, and flags an unsubscribed one so it leaves the queue", async () => {
    rows = [base({ id: "s", email: "jane@acme.com", suppressed: true }), base({ id: "u", email: "Bob@acme.com" })];
    unsubs = ["bob@acme.com"];
    const r = await verifyByIds(["s", "u"]);
    expect(updates).toEqual([{ id: "u", patch: { suppressed: true } }]);
    expect(r).toMatchObject({ suppressed: 2, verified: 0 });
  });

  it("treats an empty-string email as missing", async () => {
    rows = [base({ id: "e", email: "  " })];
    const r = await verifyByIds(["e"]);
    expect(updates).toHaveLength(0);
    expect(r).toMatchObject({ missingEmail: 1, verified: 0 });
  });
});
