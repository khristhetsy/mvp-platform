import { beforeEach, describe, expect, it, vi } from "vitest";

const inserts: Array<Record<string, unknown>> = [];
let openOpps: Array<{ id: string }> = [];
let failInsert = false;

vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      Object.assign(chain, {
        select: self, ilike: self, eq: self,
        maybeSingle: async () => ({ data: table === "crm_contacts" ? { id: "c1" } : null, error: null }),
        then: (resolve: (v: unknown) => void) => resolve({ data: table === "sales_opportunities" ? openOpps : [], error: null }),
        insert: async (row: Record<string, unknown>) => {
          if (failInsert) throw new Error("db down");
          inserts.push(row);
          return { error: null };
        },
      });
      return chain;
    },
  }),
}));

import { logOutboundEmailActivity } from "./activity";

beforeEach(() => { inserts.length = 0; openOpps = []; failInsert = false; });

describe("logOutboundEmailActivity", () => {
  it("without details writes exactly what it wrote before (mass email path)", async () => {
    await logOutboundEmailActivity(["Ana@Example.com"], "Hello", "u1", 25, "gmail");
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ kind: "email", summary: "Email sent: Hello", contact_crm_id: "c1", meta: { via: "gmail" } });
  });

  it("with details adds recipient, subject, a 280 character preview and the message id", async () => {
    await logOutboundEmailActivity(["ana@example.com"], "Deck", "u1", 25, "gmail", { body: `<p>${"y".repeat(400)}</p>`, externalId: "gmail-123" });
    const meta = inserts[0].meta as Record<string, unknown>;
    expect(meta).toMatchObject({ via: "gmail", direction: "outbound", to: "ana@example.com", subject: "Deck", external_id: "gmail-123" });
    expect(String(meta.preview)).toHaveLength(280);
  });

  it("logs one row per open opportunity, as before", async () => {
    openOpps = [{ id: "o1" }, { id: "o2" }];
    await logOutboundEmailActivity(["ana@example.com"], "Deck", "u1", 25, "gmail", { body: "Hi", externalId: "g-1" });
    expect(inserts.map((r) => r.opportunity_id)).toEqual(["o1", "o2"]);
  });

  it("never throws when the log write fails", async () => {
    failInsert = true;
    await expect(logOutboundEmailActivity(["ana@example.com"], "Deck", "u1", 25, "gmail", { body: "Hi", externalId: "g-1" })).resolves.toBeUndefined();
  });
});
