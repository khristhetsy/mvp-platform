import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "@/lib/verify/fake-db.test-helper";

let db: FakeDb;
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ serviceRoleClientUntyped: () => db, createServiceRoleClient: () => db }));
vi.mock("@/lib/cron/gate", () => ({ withCronGate: (_p: string, h: (r: Request) => Promise<Response>) => h, CRON_SUMMARY_HEADER: "x-cron-summary" }));
vi.mock("@/lib/notifications/cron/auth", () => ({
  getCronSecret: () => "s",
  validateCronSecret: (r: Request) => r.headers.get("authorization") === "Bearer s",
  cronUnauthorizedResponse: () => new Response("no", { status: 401 }),
  cronMisconfiguredResponse: () => new Response("cfg", { status: 500 }),
}));

import { GET } from "./route";

const call = (auth = "Bearer s") => GET(new Request("https://x/api/cron/learn-domain-patterns", { headers: { authorization: auth } }));

beforeEach(() => {
  db = new FakeDb();
  db.rows("crm_contacts").push(
    { id: "1", name: "Jane Doe", email: "jane.doe@acme.com", email_source: "given", email_status: "valid" },
    { id: "2", name: "Bob Ray", email: "bob.ray@acme.com", email_source: null, email_status: "unverified" },
  );
});

describe("learn-domain-patterns cron", () => {
  it("rejects calls without the cron secret", async () => {
    expect((await call("Bearer nope")).status).toBe(401);
  });

  it("learns when nothing has been learned yet", async () => {
    const res = await call();
    const body = await res.json();
    expect(body).toMatchObject({ scanned: 2, matched: 2, domains: 1, learned: 1 });
    expect(res.headers.get("x-cron-summary")).toMatch(/1 learned/);
    expect(db.rows("email_domain_patterns")[0]).toMatchObject({ domain: "acme.com", pattern: "first.last" });
  });

  it("skips when patterns were rebuilt recently", async () => {
    db.rows("email_domain_patterns").push({ domain: "x.com", pattern: "flast", last_checked_at: new Date().toISOString() });
    const body = await (await call()).json();
    expect(body.skipped).toBe(true);
    expect(db.rows("email_domain_patterns")).toHaveLength(1);
  });

  it("relearns when the last run is older than 20 hours", async () => {
    db.rows("email_domain_patterns").push({ domain: "x.com", pattern: "flast", last_checked_at: new Date(Date.now() - 21 * 3_600_000).toISOString() });
    const body = await (await call()).json();
    expect(body.learned).toBe(1);
  });
});
