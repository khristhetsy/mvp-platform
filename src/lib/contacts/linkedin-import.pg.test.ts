/**
 * The LinkedIn import migration on real Postgres (PGlite): match keys, the backfill of
 * LinkedIn URLs already on contacts, fill-blanks merge, and the enrichment lookups.
 * Applied by hand in the Supabase SQL editor, so it runs here first.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nameKey, phoneKey } from "./linkedin-import";

let pg: PGlite;
const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const C = "33333333-3333-3333-3333-333333333333";
const D = "44444444-4444-4444-4444-444444444444";
const L = "55555555-5555-5555-5555-555555555555";

beforeAll(async () => {
  pg = new PGlite({ extensions: { pg_trgm } });
  await pg.exec(`
    create extension if not exists pg_trgm;
    do $$ begin create role anon; exception when others then null; end $$;
    do $$ begin create role authenticated; exception when others then null; end $$;
    do $$ begin create role service_role; exception when others then null; end $$;
    create table public.crm_contacts (
      id uuid primary key default gen_random_uuid(),
      source text, external_id text, name text, email text, phone text, company text,
      company_domain text, website text, email_source text, enrichment_status text,
      raw jsonb, profile jsonb,
      unique (source, external_id)
    );
    insert into public.crm_contacts (id, source, name, email, phone, company, website, raw) values
      ('${A}', 'odoo', 'Ana Ruiz', null, null, 'Northbay Ventures', 'https://www.linkedin.com/in/Ana-Ruiz-12/', '{}'),
      ('${B}', 'odoo', 'Marc Leroy', 'marc@atlas.vc', '+1 (212) 555-0140', 'Atlas Capital', 'atlas.vc', '{"function":"Partner"}'),
      ('${C}', 'odoo', 'David Chen', null, null, 'Helio Bio', null, '{"x":"see linkedin.com/in/dchen"}'),
      ('${D}', 'odoo', 'David  Chen', null, null, 'Other Co', null, '{}');
    insert into public.crm_contacts (id, source, external_id, name, company, enrichment_status, raw) values
      ('${L}', 'linkedin', 'sara-p', 'Sara Patel', 'Fieldstone', 'pending', '{"linkedin":{"group":"investor","first_name":"Sara","last_name":"Patel"}}');
  `);
  await pg.exec(readFileSync(join(process.cwd(), "supabase/migrations/20261004160000_linkedin_import.sql"), "utf8"));
});
afterAll(async () => { await pg.close(); });

describe("linkedin import migration", () => {
  it("backfills slugs from the website field and the record body", async () => {
    const r = await pg.query<{ id: string; linkedin_slug: string | null }>(`select id, linkedin_slug from crm_contacts order by id`);
    const by = Object.fromEntries(r.rows.map((x) => [x.id, x.linkedin_slug]));
    expect(by[A]).toBe("ana-ruiz-12");
    expect(by[C]).toBe("dchen");
    expect(by[B]).toBeNull();
  });

  it("keys match the TypeScript helpers", async () => {
    const r = await pg.query<{ n: string; p: string }>(`select person_name_key('  David  Chen ') n, phone_key('+1 (212) 555-0140') p`);
    expect(r.rows[0].n).toBe(nameKey("  David  Chen "));
    expect(r.rows[0].p).toBe(phoneKey("+1 (212) 555-0140"));
  });

  it("finds every candidate by LinkedIn, email and name", async () => {
    const rows = [
      { i: 0, slug: "ana-ruiz-12", email: null, name: "Ana Ruiz" },
      { i: 1, slug: "marc-l", email: "MARC@atlas.vc", name: "Marc Leroy" },
      { i: 2, slug: "david-c", email: null, name: "David Chen" },
      { i: 3, slug: "nobody", email: null, name: "Nobody Here" },
    ];
    const r = await pg.query<{ m: Array<{ idx: number; kind: string; contact_id: string }> }>(`select linkedin_import_match($1::jsonb) m`, [JSON.stringify(rows)]);
    const got = r.rows[0].m.map((x) => `${x.idx}:${x.kind}:${x.contact_id.slice(0, 1)}`).sort();
    expect(got).toEqual(["0:linkedin:1", "0:name:1", "1:email:2", "1:name:2", "2:name:3", "2:name:4"]);
  });

  it("merge fills blanks only", async () => {
    const n = await pg.query<{ n: number }>(`select linkedin_import_merge($1::jsonb) n`, [JSON.stringify([
      { id: B, slug: "marc-l", email: "other@x.com", company: "Changed", position: "CEO", li: { url: "u" } },
    ])]);
    expect(n.rows[0].n).toBe(1);
    const r = await pg.query<{ email: string; company: string; linkedin_slug: string; raw: { function: string; linkedin: { url: string } } }>(`select email, company, linkedin_slug, raw from crm_contacts where id = $1`, [B]);
    expect(r.rows[0]).toMatchObject({ email: "marc@atlas.vc", company: "Atlas Capital", linkedin_slug: "marc-l" });
    expect(r.rows[0].raw.function).toBe("Partner");
    expect(r.rows[0].raw.linkedin.url).toBe("u");
  });

  it("enrichment helpers: stats, next, known domains, lookup", async () => {
    const s = await pg.query<{ contacts: number; pending_companies: number }>(`select * from linkedin_enrich_stats('investor')`);
    expect(Number(s.rows[0].contacts)).toBe(1);
    expect(Number(s.rows[0].pending_companies)).toBe(1);
    expect(Number((await pg.query<{ contacts: number }>(`select * from linkedin_enrich_stats('founder')`)).rows[0].contacts)).toBe(0);
    const nx = await pg.query<{ id: string; first_name: string }>(`select * from linkedin_enrich_next('all', 50)`);
    expect(nx.rows).toHaveLength(1);
    expect(nx.rows[0].first_name).toBe("Sara");
    const kd = await pg.query<{ company: string; domain: string }>(`select * from linkedin_known_domains(array['atlas capital', 'northbay ventures'])`);
    expect(kd.rows).toEqual([{ company: "atlas capital", domain: "atlas.vc" }]);
    const lk = await pg.query<{ kind: string; contact_id: string }>(`select kind, contact_id from linkedin_enrich_lookup(array['212.555.0140'], array['Marc@Atlas.vc']) order by kind`);
    expect(lk.rows.map((x) => `${x.kind}:${x.contact_id}`)).toEqual([`email:${B}`, `phone:${B}`]);
  });
});
