/**
 * The LinkedIn outreach migration on real Postgres (PGlite). Applied by hand in the Supabase
 * SQL editor, so it runs here first: it applies cleanly, the checks and unique indexes hold,
 * deleting an account cascades, and row level security is on for every table.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let pg: PGlite;
const OWNER = "11111111-1111-1111-1111-111111111111";
const CONTACT = "22222222-2222-2222-2222-222222222222";

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    create table public.profiles (id uuid primary key);
    create table public.crm_contacts (id uuid primary key);
    insert into public.profiles values ('${OWNER}');
    insert into public.crm_contacts values ('${CONTACT}');
  `);
  await pg.exec(readFileSync(join(process.cwd(), "supabase/migrations/20261108100000_linkedin_outreach.sql"), "utf8"));
  await pg.exec(readFileSync(join(process.cwd(), "supabase/migrations/20261108110000_linkedin_worker.sql"), "utf8"));
  await pg.exec(readFileSync(join(process.cwd(), "supabase/migrations/20261109120001_linkedin_connected_message.sql"), "utf8"));
  await pg.exec(readFileSync(join(process.cwd(), "supabase/migrations/20261109130000_linkedin_network_audience.sql"), "utf8"));
}, 60_000);

afterAll(async () => { await pg?.close(); });

const account = async () => (await pg.query<{ id: string }>(`insert into linkedin_accounts (owner_id, label) values ('${OWNER}', 'Khris') returning id`)).rows[0].id;

describe("linkedin outreach migration", () => {
  it("applies twice without error", async () => {
    await pg.exec(readFileSync(join(process.cwd(), "supabase/migrations/20261108100000_linkedin_outreach.sql"), "utf8"));
  });

  it("applies the sender key migration twice and keeps sender keys unique", async () => {
    await pg.exec(readFileSync(join(process.cwd(), "supabase/migrations/20261108110000_linkedin_worker.sql"), "utf8"));
    const a = await account();
    const cols = await pg.query<{ sender_key_set: boolean; worker_key_hash: string | null }>(`select sender_key_set, worker_key_hash from linkedin_accounts where id = '${a}'`);
    expect(cols.rows[0]).toEqual({ sender_key_set: false, worker_key_hash: null });
    await pg.exec(`update linkedin_accounts set worker_key_hash = 'abc' where id = '${a}'`);
    const OTHER = "00000000-0000-0000-0000-0000000000f2";
    await pg.exec(`insert into profiles values ('${OTHER}')`);
    await expect(pg.exec(`insert into linkedin_accounts (owner_id, label, worker_key_hash) values ('${OTHER}', 'x', 'abc')`)).rejects.toThrow();
    await pg.exec(`delete from linkedin_accounts where id = '${a}'`);
  });

  it("adds the existing connections message columns, applies twice, and leaves old campaigns unchanged", async () => {
    await pg.exec(readFileSync(join(process.cwd(), "supabase/migrations/20261109120001_linkedin_connected_message.sql"), "utf8"));
    const a = await account();
    const c = (await pg.query<{ id: string; connected_message_text: string | null }>(`insert into linkedin_campaigns (account_id, name, created_by) values ('${a}', 'Old', '${OWNER}') returning id, connected_message_text`)).rows[0];
    expect(c.connected_message_text).toBeNull();
    const t = await pg.query<{ messaged_at: string | null }>(`insert into linkedin_targets (campaign_id) values ('${c.id}') returning messaged_at`);
    expect(t.rows[0].messaged_at).toBeNull();
    await pg.exec(`delete from linkedin_accounts where id = '${a}'`);
  });

  it("defaults a new account to Standard, not connected, 5 a day by hand", async () => {
    const id = await account();
    const r = await pg.query<{ safety_level: string; status: string; manual_allowance: number; withdraw_pending: boolean }>(`select safety_level, status, manual_allowance, withdraw_pending from linkedin_accounts where id = '${id}'`);
    expect(r.rows[0]).toEqual({ safety_level: "standard", status: "not_connected", manual_allowance: 5, withdraw_pending: true });
  });

  it("allows one account per owner and rejects bad safety levels and caps", async () => {
    await expect(pg.exec(`insert into linkedin_accounts (owner_id, label) values ('${OWNER}', 'Again')`)).rejects.toThrow();
    const id = (await pg.query<{ id: string }>(`select id from linkedin_accounts limit 1`)).rows[0].id;
    await expect(pg.exec(`update linkedin_accounts set safety_level = 'reckless' where id = '${id}'`)).rejects.toThrow();
    await expect(pg.exec(`update linkedin_accounts set custom_daily_cap = 500 where id = '${id}'`)).rejects.toThrow();
  });

  it("keeps one target per contact in a campaign and cascades on delete", async () => {
    const accId = (await pg.query<{ id: string }>(`select id from linkedin_accounts limit 1`)).rows[0].id;
    const camp = (await pg.query<{ id: string }>(`insert into linkedin_campaigns (account_id, name, created_by) values ('${accId}', 'Seed', '${OWNER}') returning id`)).rows[0].id;
    await pg.exec(`insert into linkedin_targets (campaign_id, contact_id, linkedin_slug) values ('${camp}', '${CONTACT}', 'ana')`);
    await expect(pg.exec(`insert into linkedin_targets (campaign_id, contact_id, linkedin_slug) values ('${camp}', '${CONTACT}', 'ana')`)).rejects.toThrow();
    await expect(pg.exec(`insert into linkedin_campaigns (account_id, name, created_by, status) values ('${accId}', 'x', '${OWNER}', 'bogus')`)).rejects.toThrow();
    await pg.exec(`delete from linkedin_accounts where id = '${accId}'`);
    const left = await pg.query<{ n: number }>(`select count(*)::int as n from linkedin_targets`);
    expect(left.rows[0].n).toBe(0);
  });

  it("keeps one person once per campaign when read from LinkedIn, applies twice, and leaves CRM targets alone", async () => {
    await pg.exec(readFileSync(join(process.cwd(), "supabase/migrations/20261109130000_linkedin_network_audience.sql"), "utf8"));
    const a = await account();
    const camp = (await pg.query<{ id: string }>(`insert into linkedin_campaigns (account_id, name, created_by) values ('${a}', 'Network', '${OWNER}') returning id`)).rows[0].id;
    await pg.exec(`insert into linkedin_targets (campaign_id, linkedin_slug, route) values ('${camp}', 'ben', 'message')`);
    await expect(pg.exec(`insert into linkedin_targets (campaign_id, linkedin_slug, route) values ('${camp}', 'ben', 'message')`)).rejects.toThrow();
    await pg.exec(`insert into linkedin_targets (campaign_id, linkedin_slug, route) values ('${camp}', 'cat', 'message')`);
    await pg.exec(`insert into linkedin_targets (campaign_id, contact_id, linkedin_slug) values ('${camp}', '${CONTACT}', 'ben')`);
    await pg.exec(`delete from linkedin_accounts where id = '${a}'`);
  });

  it("adds archived_at, applies twice, and keeps a campaign active until archived", async () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261111100000_linkedin_campaign_archive.sql"), "utf8");
    await pg.exec(sql);
    await pg.exec(sql);
    const a = await account();
    const camp = (await pg.query<{ id: string }>(`insert into linkedin_campaigns (account_id, name, created_by) values ('${a}', 'Archive me', '${OWNER}') returning id`)).rows[0].id;
    const before = await pg.query<{ archived_at: string | null }>(`select archived_at from linkedin_campaigns where id = '${camp}'`);
    expect(before.rows[0].archived_at).toBeNull();
    await pg.exec(`update linkedin_campaigns set archived_at = now() where id = '${camp}'`);
    const after = await pg.query<{ archived_at: string | null }>(`select archived_at from linkedin_campaigns where id = '${camp}'`);
    expect(after.rows[0].archived_at).not.toBeNull();
    await pg.exec(`insert into linkedin_targets (campaign_id, linkedin_slug, route) values ('${camp}', 'dee', 'message')`);
    await pg.exec(`delete from linkedin_campaigns where id = '${camp}'`);
    const left = await pg.query<{ n: number }>(`select count(*)::int as n from linkedin_targets where campaign_id = '${camp}'`);
    expect(left.rows[0].n).toBe(0);
    await pg.exec(`delete from linkedin_accounts where id = '${a}'`);
  });

  it("turns row level security on for every table", async () => {
    const r = await pg.query<{ relname: string; relrowsecurity: boolean }>(`select relname, relrowsecurity from pg_class where relname like 'linkedin\\_%' and relkind = 'r' order by relname`);
    expect(r.rows.map((x) => x.relname)).toEqual(["linkedin_accounts", "linkedin_campaigns", "linkedin_events", "linkedin_messages", "linkedin_targets", "linkedin_threads"]);
    expect(r.rows.every((x) => x.relrowsecurity)).toBe(true);
  });
});
