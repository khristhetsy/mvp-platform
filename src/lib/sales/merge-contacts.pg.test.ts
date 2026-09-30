/**
 * merge_crm_contacts / undo_contact_merge / contact_duplicate_groups on a real Postgres (PGlite).
 * The schema below is the slice of production those functions touch: crm_contacts (with its
 * generated columns, which undo must skip on re-insert) and every table that points at a contact.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = [
  "supabase/migrations/20260930134947_contact_merges.sql",
  "supabase/migrations/20260930160000_merge_crm_contacts.sql",
].map((f) => join(process.cwd(), f));

const KEEP = "00000000-0000-0000-0000-00000000000a";
const DUPE = "00000000-0000-0000-0000-00000000000b";
const OTHER = "00000000-0000-0000-0000-00000000000c";
const P1 = "10000000-0000-0000-0000-000000000001";
const P2 = "10000000-0000-0000-0000-000000000002";
const OWNER = "20000000-0000-0000-0000-000000000001";

let pg: PGlite;
const one = async <T,>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows[0];
const all = async <T,>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    end $$;
    create schema if not exists auth;
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create table public.profiles (id uuid primary key, role text);
    create table public.crm_contacts (
      id uuid primary key default gen_random_uuid(),
      source text, external_id text, module text, plan text, name text, email text, company text, phone text, website text,
      email_status text, email_source text, phone_source text, tags text[], assignee_ids uuid[], owner_id uuid,
      raw jsonb, overrides jsonb default '{}'::jsonb, profile jsonb,
      contact_type text generated always as (coalesce(module, 'other')) stored,
      created_on text generated always as (raw->>'create_date') stored,
      unique (source, external_id)
    );
    create function public.crm_contacts_sync_profile() returns trigger language plpgsql as $$
    begin new.profile := coalesce(new.raw->'__profile', '{}'::jsonb); return new; end $$;
    create trigger crm_contacts_sync_profile before insert or update of raw, overrides on public.crm_contacts
      for each row execute function public.crm_contacts_sync_profile();
    create table public.ir_projects (id uuid primary key, founder_contact_id uuid references public.crm_contacts(id));
    create table public.ir_matches (id uuid primary key default gen_random_uuid(), project_id uuid, investor_contact_id uuid references public.crm_contacts(id), stage text, stage_changed_at timestamptz, unique (project_id, investor_contact_id));
    create table public.ir_activities (id uuid primary key default gen_random_uuid(), match_id uuid references public.ir_matches(id) on delete cascade, subject text);
    create table public.ir_notes (id uuid primary key default gen_random_uuid(), match_id uuid references public.ir_matches(id) on delete set null);
    create table public.ir_match_stage_events (id bigserial primary key, match_id uuid references public.ir_matches(id) on delete cascade);
    create table public.ir_sequence_enrollments (id uuid primary key default gen_random_uuid(), match_id uuid references public.ir_matches(id) on delete cascade);
    create table public.ir_sequence_events (id uuid primary key default gen_random_uuid(), match_id uuid references public.ir_matches(id) on delete cascade);
    create table public.marketing_contacts (id uuid primary key default gen_random_uuid(), email text unique, crm_contact_id uuid references public.crm_contacts(id) on delete set null);
    create table public.publish_events (id uuid primary key default gen_random_uuid(), contact_id uuid references public.crm_contacts(id));
    create table public.formd_filings (accession_no text primary key, promoted_contact_id uuid references public.crm_contacts(id) on delete set null);
    create table public.assessment_leads (id uuid primary key default gen_random_uuid(), converted_contact_id uuid);
    create table public.investor_enrichment (id uuid primary key default gen_random_uuid(), contact_id uuid unique references public.crm_contacts(id) on delete cascade, note text);
    create table public.investor_match_index (contact_id uuid primary key references public.crm_contacts(id) on delete cascade);
    create table public.match_campaign_founders (id uuid primary key default gen_random_uuid(), campaign_id uuid, founder_contact_id uuid references public.crm_contacts(id) on delete cascade, unique (campaign_id, founder_contact_id));
    create table public.match_campaign_matches (id uuid primary key default gen_random_uuid(), campaign_founder_id uuid, investor_contact_id uuid references public.crm_contacts(id) on delete cascade, unique (campaign_founder_id, investor_contact_id));
  `);
  for (const m of MIGRATIONS) await pg.exec(readFileSync(m, "utf8"));

  await pg.query(`insert into public.crm_contacts (id, source, external_id, module, plan, name, email, company, phone, tags, assignee_ids, raw, overrides) values
    ($1, 'odoo', '117985', 'investor', 'Investor', 'Nathan Dau', 'nathan.dau@passaiccapital.com', 'Nathan Dau', '(206) 972-0763', '{Jessica Santos}', '{}',
     '{"create_date":"2023-03-02 01:09:09","__profile":{"industries":["Healthcare"],"investorTypes":["Venture Capital"]}}', '{"lead_source":"Referral"}'),
    ($2, 'odoo', '172063', 'unknown', null, 'nathan.dau@passaiccapital.com', 'Nathan.Dau@passaiccapital.com', 'Vivo Ventures', null, '{Robert Ruiz}', $4,
     '{"create_date":"2024-10-02 18:27:25","__profile":{"extra":{}}}', '{"lead_source":"LinkedIn","Note":"x"}'),
    ($3, 'odoo', '999', 'investor', null, 'Someone Else', 'else@x.com', 'Else Co', null, '{}', '{}', '{"create_date":"2024-01-01 00:00:00"}', '{}'),
    (gen_random_uuid(), 'odoo', 'j1', null, null, 'Junk One', 'email undeliverable', null, null, '{}', '{}', null, '{}'),
    (gen_random_uuid(), 'odoo', 'j2', null, null, 'Junk Two', 'Email undeliverable', null, null, '{}', '{}', null, '{}')`,
    [KEEP, DUPE, OTHER, [OWNER]]);
  await pg.exec(`
    insert into public.ir_projects values ('${P2}', '${DUPE}');
    insert into public.ir_matches (id, project_id, investor_contact_id, stage) values
      ('30000000-0000-0000-0000-000000000001', '${P1}', '${KEEP}', 'contacted'),
      ('30000000-0000-0000-0000-000000000002', '${P1}', '${DUPE}', 'contacted'),
      ('30000000-0000-0000-0000-000000000003', '${P2}', '${DUPE}', 'meeting');
    insert into public.ir_activities (match_id, subject) values ('30000000-0000-0000-0000-000000000002', 'call'), ('30000000-0000-0000-0000-000000000002', 'email');
    insert into public.ir_match_stage_events (match_id) values ('30000000-0000-0000-0000-000000000002');
    insert into public.marketing_contacts (email, crm_contact_id) values ('nathan.dau@passaiccapital.com', '${DUPE}');
    insert into public.investor_enrichment (contact_id, note) values ('${KEEP}', 'keep'), ('${DUPE}', 'dupe');
    insert into public.investor_match_index values ('${KEEP}'), ('${DUPE}');
  `);
});
afterAll(async () => { await pg?.close(); });

describe("contact_duplicate_groups", () => {
  it("groups real addresses by case-insensitive email, ignoring placeholder text", async () => {
    const r = await all<{ email: string; n: number; total_groups: string; total_extra: string; members: Array<{ id: string; profileFields: number }> }>("select * from public.contact_duplicate_groups(null, 0, 25)");
    expect(r).toHaveLength(1);
    expect(r[0].email).toBe("nathan.dau@passaiccapital.com");
    expect(r[0].n).toBe(2);
    expect(Number(r[0].total_extra)).toBe(1);
    expect(r[0].members.find((m) => m.id === KEEP)?.profileFields).toBe(2);
  });
  it("filters by name or company", async () => {
    expect(await all("select * from public.contact_duplicate_groups('vivo', 0, 25)")).toHaveLength(1);
    expect(await all("select * from public.contact_duplicate_groups('nobody', 0, 25)")).toHaveLength(0);
  });
});

describe("merge_crm_contacts", () => {
  let batch = "";
  it("rejects keeping a contact that is also merged in", async () => {
    await expect(pg.query("select public.merge_crm_contacts($1, $2::uuid[], '{}'::jsonb, null)", [KEEP, [KEEP]])).rejects.toThrow(/can't also be merged/);
  });

  it("applies field choices, unions tags, moves and folds references, logs and deletes", async () => {
    const res = await one<{ r: { batchId: string; merged: number; moved: { ir_matches: number; lists: number; projects: number } } }>(
      "select public.merge_crm_contacts($1, $2::uuid[], $3::jsonb, $4) as r", [KEEP, [DUPE], JSON.stringify({ company: DUPE, name: KEEP }), OWNER]);
    batch = res.r.batchId;
    expect(res.r.merged).toBe(1);
    expect(res.r.moved).toEqual({ ir_matches: 2, lists: 1, projects: 1 });

    const k = await one<{ name: string; company: string; tags: string[]; assignee_ids: string[]; overrides: Record<string, string>; profile: Record<string, unknown> }>("select * from public.crm_contacts where id = $1", [KEEP]);
    expect(k.name).toBe("Nathan Dau");
    expect(k.company).toBe("Vivo Ventures");
    expect([...k.tags].sort()).toEqual(["Jessica Santos", "Robert Ruiz"]);
    expect(k.assignee_ids).toEqual([OWNER]);
    expect(k.overrides).toEqual({ lead_source: "Referral", Note: "x" });   // kept value wins, new key added
    expect(k.profile.industries).toEqual(["Healthcare"]);                 // profile stayed with the kept record

    expect(await one("select 1 from public.crm_contacts where id = $1", [DUPE])).toBeUndefined();
    const matches = await all<{ id: string; project_id: string }>("select id, project_id from public.ir_matches where investor_contact_id = $1 order by project_id", [KEEP]);
    expect(matches.map((m) => m.project_id)).toEqual([P1, P2]);
    expect(await one("select 1 from public.ir_matches where id = '30000000-0000-0000-0000-000000000002'")).toBeUndefined();
    const acts = await all<{ match_id: string }>("select match_id from public.ir_activities");
    expect(acts.every((a) => a.match_id === "30000000-0000-0000-0000-000000000001")).toBe(true);
    expect(acts).toHaveLength(2);
    expect((await one<{ founder_contact_id: string }>("select founder_contact_id from public.ir_projects"))?.founder_contact_id).toBe(KEEP);
    expect((await one<{ crm_contact_id: string }>("select crm_contact_id from public.marketing_contacts"))?.crm_contact_id).toBe(KEEP);
    expect(await all("select * from public.investor_enrichment")).toHaveLength(1);
    const log = await one<{ merged_source: string; merged_external_id: string; merged_by: string }>("select * from public.contact_merges where batch_id = $1", [batch]);
    expect(log).toMatchObject({ merged_source: "odoo", merged_external_id: "172063", merged_by: OWNER });
  });

  it("undo restores the removed contact, every moved reference, and the kept contact", async () => {
    const r = await one<{ r: { restored: number } }>("select public.undo_contact_merge($1) as r", [batch]);
    expect(r.r.restored).toBe(1);
    const d = await one<{ name: string; company: string; created_on: string; contact_type: string }>("select * from public.crm_contacts where id = $1", [DUPE]);
    expect(d).toMatchObject({ name: "nathan.dau@passaiccapital.com", company: "Vivo Ventures", created_on: "2024-10-02 18:27:25", contact_type: "unknown" });
    const k = await one<{ company: string; tags: string[]; overrides: Record<string, string> }>("select * from public.crm_contacts where id = $1", [KEEP]);
    expect(k.company).toBe("Nathan Dau");
    expect(k.tags).toEqual(["Jessica Santos"]);
    expect(k.overrides).toEqual({ lead_source: "Referral" });
    const m2 = await one<{ investor_contact_id: string }>("select investor_contact_id from public.ir_matches where id = '30000000-0000-0000-0000-000000000002'");
    expect(m2?.investor_contact_id).toBe(DUPE);
    expect((await one<{ n: string }>("select count(*) n from public.ir_activities where match_id = '30000000-0000-0000-0000-000000000002'"))?.n).toBe(2);
    expect((await one<{ n: string }>("select count(*) n from public.ir_match_stage_events where match_id = '30000000-0000-0000-0000-000000000002'"))?.n).toBe(1);
    expect((await one<{ investor_contact_id: string }>("select investor_contact_id from public.ir_matches where id = '30000000-0000-0000-0000-000000000003'"))?.investor_contact_id).toBe(DUPE);
    expect((await one<{ founder_contact_id: string }>("select founder_contact_id from public.ir_projects"))?.founder_contact_id).toBe(DUPE);
    expect((await one<{ crm_contact_id: string }>("select crm_contact_id from public.marketing_contacts"))?.crm_contact_id).toBe(DUPE);
    expect(await all("select * from public.investor_enrichment")).toHaveLength(2);
    await expect(pg.query("select public.undo_contact_merge($1)", [batch])).rejects.toThrow(/already undone/);
  });

  it("profile and type can come from the merged-in record", async () => {
    await pg.query("select public.merge_crm_contacts($1, $2::uuid[], $3::jsonb, null)", [DUPE, [KEEP], JSON.stringify({ profile: KEEP, type: KEEP, phone: KEEP })]);
    const d = await one<{ profile: Record<string, unknown>; contact_type: string; phone: string; created_on: string }>("select * from public.crm_contacts where id = $1", [DUPE]);
    expect(d.profile.industries).toEqual(["Healthcare"]);
    expect(d.contact_type).toBe("investor");
    expect(d.phone).toBe("(206) 972-0763");
    expect(d.created_on).toBe("2024-10-02 18:27:25");
  });
});
