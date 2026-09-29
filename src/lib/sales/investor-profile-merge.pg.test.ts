/**
 * investor_profile_merge + the crm_contacts_sync_profile trigger on real Postgres (PGlite).
 * The grid groups on profile->'investorTypes'; these prove that value now reflects a
 * manual pick, Odoo's synced array, or Odoo's raw "Investor Profile" answer — in that
 * order — and that an overrides write (a detail-page edit) refreshes it immediately.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION = join(process.cwd(), "supabase/migrations/20260916001_investor_profile_merge.sql");
let pg: PGlite;

async function merge(overrides: unknown, raw: unknown): Promise<string[]> {
  const r = await pg.query<{ m: string[] }>("select public.investor_profile_merge($1::jsonb, $2::jsonb) as m", [JSON.stringify(overrides), JSON.stringify(raw)]);
  return r.rows[0].m;
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
  await pg.exec(readFileSync(MIGRATION, "utf8"));
});
afterAll(async () => { await pg.close(); });

describe("investor_profile_merge", () => {
  it("a manual pick wins over the synced array", async () => {
    expect(await merge({ "Investor type": ["Represent Investors"] }, { __profile: { investorTypes: ["Angel Investor"] } })).toEqual(["Represent Investors"]);
  });
  it("falls back to Odoo's synced array, then to the raw 'Investor Profile' answer", async () => {
    expect(await merge({}, { __profile: { investorTypes: ["Venture Capital"] } })).toEqual(["Venture Capital"]);
    expect(await merge(null, { __profile: { extra: { "Investor profile?": "Family Office" } } })).toEqual(["Family Office"]);
    expect(await merge({ "Investor type": [] }, { __profile: { extra: { "Type of investor": ["Lender", "Hedge Fund"] } } })).toEqual(["Hedge Fund", "Lender"]);
  });
  it("canonicalises aliases, splits comma-joined values, drops blanks and Odoo's false", async () => {
    expect(await merge({ "Investor type": ["vc, angel", " ", "false"] }, {})).toEqual(["Angel Investor", "Venture Capital"]);
    expect(await merge({}, { __profile: { extra: { "Investor profile?": false } } })).toEqual([]);
  });
  it("keeps an unknown value as typed (the UI flags it as unlisted)", async () => {
    expect(await merge({ "Investor type": ["Sovereign Wealth"] }, {})).toEqual(["Sovereign Wealth"]);
  });
  it("is empty when nothing says anything", async () => {
    expect(await merge(null, null)).toEqual([]);
    expect(await merge({}, { __profile: {} })).toEqual([]);
  });
});

describe("crm_contacts_sync_profile trigger", () => {
  it("computes profile on insert and recomputes on an overrides write", async () => {
    const ins = await pg.query<{ id: string; profile: { investorTypes: string[]; industries?: string[] }; profile_v: number }>(
      "insert into public.crm_contacts (name, raw) values ('Sean', $1::jsonb) returning id, profile, profile_v",
      [JSON.stringify({ __profile: { industries: ["FinTech"], extra: { "Investor profile?": "Represent Investors" } } })],
    );
    expect(ins.rows[0].profile.investorTypes).toEqual(["Represent Investors"]);
    expect(ins.rows[0].profile.industries).toEqual(["FinTech"]);   // the rest of __profile is kept
    expect(ins.rows[0].profile_v).toBe(2);

    const upd = await pg.query<{ profile: { investorTypes: string[] } }>(
      "update public.crm_contacts set overrides = $1::jsonb where id = $2 returning profile",
      [JSON.stringify({ "Investor type": ["Angel Investor"] }), ins.rows[0].id],
    );
    expect(upd.rows[0].profile.investorTypes).toEqual(["Angel Investor"]);
  });
});
