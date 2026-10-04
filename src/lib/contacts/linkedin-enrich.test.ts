import { beforeEach, describe, expect, it, vi } from "vitest";

const found = { email: null as string | null, phone: null as string | null, domain: null as string | null, source: "site" as const };
vi.mock("@/lib/append/websearch", () => ({ searchConfigured: () => true, searchCompanyContacts: vi.fn(async () => ({ ...found })) }));
vi.mock("@/lib/ai-budget/service", () => ({ assertAiBudget: vi.fn(async () => {}), isAiBudgetExceeded: () => false }));
vi.mock("@/lib/ai-budget/config", () => ({ serperCostPerSearch: () => 0.0003 }));

type Call = { table: string; op: string; arg?: unknown; eq?: Array<[string, unknown]> };
const calls: Call[] = [];
const rpcData: Record<string, unknown[]> = {};
function builder(table: string) {
  const c: Call = { table, op: "select", eq: [] };
  const b = {
    select: () => b, gte: () => b, in: (k: string, v: unknown) => { c.eq!.push([k, v]); calls.push(c); return Promise.resolve({ data: null, error: null }); },
    eq: (k: string, v: unknown) => { c.eq!.push([k, v]); return b; },
    maybeSingle: async () => ({ data: { raw: { linkedin: { position: "Partner" } }, linkedin_slug: "sara-p" } }),
    update: (arg: unknown) => { c.op = "update"; c.arg = arg; calls.push(c); return b; },
    delete: () => { c.op = "delete"; calls.push(c); return b; },
    then: (r: (v: unknown) => void) => r({ data: table === "ai_spend_events" ? [{ cost_usd: 0.0006 }] : null, error: null }),
  };
  return b;
}
const db = { from: (t: string) => builder(t), rpc: async (fn: string, arg: unknown) => { calls.push({ table: fn, op: "rpc", arg }); return { data: rpcData[fn] ?? [], error: null }; } };
vi.mock("@/lib/supabase/admin", () => ({ serviceRoleClientUntyped: () => db }));

import { runEnrichBatch } from "./linkedin-enrich";

const SARA = { id: "s1", name: "Sara Patel", company: "Fieldstone", email: null, phone: null, first_name: "Sara", last_name: "Patel", company_domain: null, website: null };

beforeEach(() => {
  calls.length = 0;
  Object.assign(found, { email: null, phone: null, domain: null });
  for (const k of Object.keys(rpcData)) delete rpcData[k];
  rpcData.linkedin_enrich_next = [SARA];
});

describe("runEnrichBatch", () => {
  it("writes website and phone, keeps a company mailbox out of the email field", async () => {
    Object.assign(found, { domain: "fieldstone.com", phone: "+1 415 555 0100", email: "info@fieldstone.com" });
    const b = await runEnrichBatch("investor", 50, 60_000);
    expect(b.rows[0]).toMatchObject({ result: "enriched", phone: "+1 415 555 0100", email: null, companyEmail: "info@fieldstone.com", website: "https://fieldstone.com" });
    const up = calls.find((c) => c.op === "update" && c.table === "crm_contacts");
    expect(up?.arg).toMatchObject({ company_domain: "fieldstone.com", phone: "+1 415 555 0100", phone_source: "site", enrichment_status: "enriched" });
    expect((up?.arg as Record<string, unknown>).email).toBeUndefined();
    expect(b.costUsd).toBe(0.0006);
  });

  it("does not copy a phone held by a contact at another company", async () => {
    Object.assign(found, { domain: "fieldstone.com", phone: "+1 415 555 0100" });
    rpcData.linkedin_enrich_lookup = [{ kind: "phone", key: "155550100", contact_id: "x", contact_name: "Bob", contact_company: "Elsewhere", source: "odoo" }];
    const b = await runEnrichBatch("investor", 50, 60_000);
    expect(b.rows[0]).toMatchObject({ result: "phone_elsewhere", phone: null });
    const up = calls.find((c) => c.op === "update");
    expect((up?.arg as Record<string, unknown>).phone).toBeUndefined();
  });

  it("merges into the existing contact when the personal email is already in Contacts", async () => {
    Object.assign(found, { domain: "fieldstone.com", email: "sara.patel@fieldstone.com" });
    rpcData.linkedin_enrich_lookup = [{ kind: "email", key: "sara.patel@fieldstone.com", contact_id: "old", contact_name: "Sara P.", contact_company: "Fieldstone", source: "odoo" }];
    const b = await runEnrichBatch("investor", 50, 60_000);
    expect(b.rows[0]).toMatchObject({ result: "merged" });
    expect(calls.some((c) => c.op === "rpc" && c.table === "linkedin_import_merge")).toBe(true);
    const del = calls.find((c) => c.op === "delete");
    expect(del?.eq).toEqual([["id", "s1"], ["source", "linkedin"]]);
  });

  it("marks no website when the company site isn't found", async () => {
    const b = await runEnrichBatch("investor", 50, 60_000);
    expect(b.rows[0].result).toBe("no_website");
    expect(calls.find((c) => c.op === "update")?.arg).toMatchObject({ enrichment_status: "no_website" });
  });
});
