/**
 * contact_industries_override + crm_contacts_sync_profile on real Postgres (PGlite).
 * The grid groups on profile->'industries'; the profile page shows overrides->'Industries'
 * over Odoo's synced list. These prove the two now agree.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = [
  "supabase/migrations/20260916001_investor_profile_merge.sql",
  "supabase/migrations/20260930115123_contact_industries_override.sql",
].map((f) => join(process.cwd(), f));
let pg: PGlite;

type Prof = { industries?: string[]; investorTypes: string[] };
async function insert(raw: unknown, overrides: unknown): Promise<{ id: string; profile: Prof }> {
  const r = await pg.query<{ id: string; profile: Prof }>(
    "insert into public.crm_contacts (name, raw, overrides) values ('c', $1::jsonb, $2::jsonb) returning id, profile",
    [JSON.stringify(raw), JSON.stringify(overrides)],
  );
  return r.rows[0];
}

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    create schema if not exists public;
    create table public.crm_contacts (
      id uuid primary key default gen_random_uuid(),
      name text, raw jsonb, overrides jsonb, profile jsonb
    );
  `);
  for (const m of MIGRATIONS) await pg.exec(readFileSync(m, "utf8"));
});
afterAll(async () => { await pg.close(); });

describe("crm_contacts_sync_profile — Industry", () => {
  it("an Industries override lands in profile.industries (the Unassigned bug)", async () => {
    const c = await insert({ __profile: { leadSource: "LinkedIn" } }, { Industries: ["E-commerce"] });
    expect(c.profile.industries).toEqual(["E-commerce"]);
  });
  it("a non-empty override replaces Odoo's synced list", async () => {
    const c = await insert({ __profile: { industries: ["FinTech"] } }, { Industries: ["Healthcare", " Healthcare ", ""] });
    expect(c.profile.industries).toEqual(["Healthcare"]);
  });
  it("an empty override clears it, no override keeps Odoo's value", async () => {
    expect((await insert({ __profile: { industries: ["FinTech"] } }, { Industries: [] })).profile.industries).toEqual([]);
    expect((await insert({ __profile: { industries: ["FinTech"] } }, { "Investor type": ["Angel Investor"] })).profile.industries).toEqual(["FinTech"]);
    expect((await insert({ __profile: {} }, null)).profile.industries).toBeUndefined();
  });
  it("recomputes on an overrides write and keeps investorTypes working", async () => {
    const c = await insert({ __profile: { industries: ["FinTech"] } }, null);
    const u = await pg.query<{ profile: Prof }>(
      "update public.crm_contacts set overrides = $1::jsonb where id = $2 returning profile",
      [JSON.stringify({ Industries: ["Software"], "Investor type": ["vc"] }), c.id],
    );
    expect(u.rows[0].profile.industries).toEqual(["Software"]);
    expect(u.rows[0].profile.investorTypes).toEqual(["Venture Capital"]);
  });
});
