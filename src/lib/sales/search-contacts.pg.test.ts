/**
 * The search_contacts SQL functions, run on a REAL Postgres (PGlite, in-process WASM).
 *
 * Unit tests that compare the strings we build cannot tell whether Postgres/PostgREST
 * accept them — that is exactly how the doubled-quote bug shipped. Here every filter kind
 * is executed: multi-word values, commas, parentheses, quotes, jsonb facets, group
 * buckets, owner scope. No Supabase stack needed; runs with the normal `npm test`.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION = join(process.cwd(), "supabase/migrations/20260914003_search_contacts.sql");

const OWNER_A = "11111111-1111-1111-1111-111111111111";
const OWNER_B = "22222222-2222-2222-2222-222222222222";

let pg: PGlite;

async function rows(spec: unknown, opts: { owner?: string | null; groupBy?: string | null; groupValue?: string | null; sort?: string; dir?: string; offset?: number; limit?: number } = {}) {
  const r = await pg.query<{ name: string; total: string }>(
    "select name, total from public.search_contacts($1::jsonb, $2::uuid, $3, $4, $5, $6, $7, $8)",
    [JSON.stringify(spec), opts.owner ?? null, opts.groupBy ?? null, opts.groupValue ?? null, opts.sort ?? "name", opts.dir ?? "asc", opts.offset ?? 0, opts.limit ?? 50],
  );
  return { names: r.rows.map((x) => x.name), total: r.rows.length ? Number(r.rows[0].total) : 0 };
}
async function buckets(spec: unknown, groupBy: string, owner: string | null = null) {
  const r = await pg.query<{ value: string; n: string }>("select value, n from public.count_contact_buckets($1::jsonb, $2::uuid, $3)", [JSON.stringify(spec), owner, groupBy]);
  return Object.fromEntries(r.rows.map((x) => [x.value, Number(x.n)]));
}
const spec = (conditions: unknown[], match: "all" | "any" = "all") => ({ match, conditions });

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    create schema if not exists public;
    create table public.crm_contacts (
      id uuid primary key default gen_random_uuid(),
      name text, email text, company text, phone text, source text, external_id text,
      contact_type text, module text, country text, created_on text, synced_at timestamptz,
      assignee_ids uuid[], raw jsonb, overrides jsonb, profile jsonb
    );
    -- service_role does not exist outside Supabase; the grants need it to parse.
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    end $$;
  `);
  await pg.exec(readFileSync(MIGRATION, "utf8"));

  const seed = [
    // name, email, company, phone, contact_type, module, country, created_on, assignees, profile, overrides
    ["Alice Angel", "alice@angel.io", "Angel Ventures", "+1 555", "investor", null, "United States", "2026-09-05 10:00:00", [OWNER_A], { investorTypes: ["Angel Investor"], industries: ["FinTech", "Health Care"], leadSource: "LinkedIn" }, null],
    ["Bob Fund", "bob@fund.com", "Fund, Inc. (NY)", null, "investor", null, "Korea, Republic of", "2026-08-15 10:00:00", [OWNER_B], { investorTypes: ["Venture Capital", "Fund Manager"], industries: ["Real Estate (Commercial)"] }, { lead_source: "SEC Form D" }],
    ["Carol \"CJ\" Jones", "carol@x.com", null, "555-0100", null, "founder", "United States", "2026-09-10 10:00:00", null, { industries: ["FinTech"], leadSource: "Website" }, null],
    ["Dan O'Brien", "dan@x.com", "Dan O'Brien", null, "advisor", null, null, null, [OWNER_A, OWNER_B], {}, null],
    ["Eve Nobody", "eve@x.com", null, null, null, null, "France", "2026-07-01 10:00:00", null, null, null],
  ] as const;
  for (const [name, email, company, phone, ct, mod, country, created, assignees, profile, overrides] of seed) {
    await pg.query(
      `insert into public.crm_contacts (name, email, company, phone, contact_type, module, country, created_on, assignee_ids, raw, profile, overrides)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::uuid[],$10::jsonb,$11::jsonb,$12::jsonb)`,
      [name, email, company, phone, ct, mod, country, created, assignees, JSON.stringify({ phone: phone ?? "raw-phone", __profile: profile ?? {} }), profile ? JSON.stringify(profile) : null, overrides ? JSON.stringify(overrides) : null],
    );
  }
});
afterAll(async () => { await pg.close(); });

describe("search_contacts — every filter kind runs on real Postgres", () => {
  it("empty spec returns everything with an exact total", async () => {
    const r = await rows(spec([]));
    expect(r.total).toBe(5);
    expect(r.names).toEqual(["Alice Angel", "Bob Fund", "Carol \"CJ\" Jones", "Dan O'Brien", "Eve Nobody"]);
  });
  it("global search q across name/email/company/phone, case-insensitive", async () => {
    expect((await rows(spec([{ field: "q", op: "contains", value: "FUND" }]))).names).toEqual(["Bob Fund"]);
    expect((await rows(spec([{ field: "q", op: "contains", value: "555" }]))).names).toEqual(["Alice Angel", "Carol \"CJ\" Jones"]);
  });
  it("values with commas, parentheses and quotes are literals, not syntax", async () => {
    expect((await rows(spec([{ field: "company", op: "contains", value: "Fund, Inc. (NY)" }]))).names).toEqual(["Bob Fund"]);
    expect((await rows(spec([{ field: "name", op: "contains", value: "\"CJ\"" }]))).names).toEqual(["Carol \"CJ\" Jones"]);
    expect((await rows(spec([{ field: "name", op: "equals", value: "dan o'brien" }]))).names).toEqual(["Dan O'Brien"]);
    expect((await rows(spec([{ field: "country", op: "in", value: ["Korea, Republic of"] }]))).names).toEqual(["Bob Fund"]);
    expect((await rows(spec([{ field: "industries", op: "in", value: ["Real Estate (Commercial)"] }]))).names).toEqual(["Bob Fund"]);
  });
  it("ilike wildcards in the value are escaped", async () => {
    expect((await rows(spec([{ field: "name", op: "contains", value: "%" }]))).total).toBe(0);
    expect((await rows(spec([{ field: "email", op: "contains", value: "_" }]))).total).toBe(0);
  });
  it("facet in: multi-word value, and OR across several values", async () => {
    expect((await rows(spec([{ field: "investorTypes", op: "in", value: ["Angel Investor"] }]))).names).toEqual(["Alice Angel"]);
    expect((await rows(spec([{ field: "investorTypes", op: "in", value: ["Angel Investor", "Fund Manager"] }]))).names).toEqual(["Alice Angel", "Bob Fund"]);
    expect((await rows(spec([{ field: "industries", op: "in", value: ["FinTech"] }]))).names).toEqual(["Alice Angel", "Carol \"CJ\" Jones"]);
  });
  it("facet set / country set / assignee set|not_set", async () => {
    expect((await rows(spec([{ field: "investorTypes", op: "set" }]))).names).toEqual(["Alice Angel", "Bob Fund"]);
    expect((await rows(spec([{ field: "country", op: "not_set" }]))).names).toEqual(["Dan O'Brien"]);
    expect((await rows(spec([{ field: "assignee", op: "not_set" }]))).names).toEqual(["Carol \"CJ\" Jones", "Eve Nobody"]);
  });
  it("type in → contact_type OR module", async () => {
    expect((await rows(spec([{ field: "type", op: "in", value: ["founder"] }]))).names).toEqual(["Carol \"CJ\" Jones"]);
    expect((await rows(spec([{ field: "type", op: "in", value: ["investor", "advisor"] }]))).names).toEqual(["Alice Angel", "Bob Fund", "Dan O'Brien"]);
  });
  it("lead source: override wins, profile falls back, multi-word", async () => {
    expect((await rows(spec([{ field: "leadSource", op: "in", value: ["SEC Form D"] }]))).names).toEqual(["Bob Fund"]);
    expect((await rows(spec([{ field: "leadSource", op: "in", value: ["LinkedIn", "Website"] }]))).names).toEqual(["Alice Angel", "Carol \"CJ\" Jones"]);
    expect((await rows(spec([{ field: "leadSource", op: "set" }]))).total).toBe(3);
  });
  it("createdAt after/before on created_on text", async () => {
    expect((await rows(spec([{ field: "createdAt", op: "after", value: "2026-09-01" }]))).names).toEqual(["Alice Angel", "Carol \"CJ\" Jones"]);
    expect((await rows(spec([{ field: "createdAt", op: "before", value: "2026-08-01" }]))).names).toEqual(["Eve Nobody"]);
  });
  it("match any ORs the conditions; match all ANDs them", async () => {
    const both = [{ field: "type", op: "in", value: ["founder"] }, { field: "country", op: "in", value: ["France"] }];
    expect((await rows(spec(both, "any"))).names).toEqual(["Carol \"CJ\" Jones", "Eve Nobody"]);
    expect((await rows(spec(both, "all"))).total).toBe(0);
  });
  it("owner scope narrows to Lead-assigned contacts", async () => {
    expect((await rows(spec([]), { owner: OWNER_A })).names).toEqual(["Alice Angel", "Dan O'Brien"]);
    expect((await rows(spec([]), { owner: OWNER_B })).names).toEqual(["Bob Fund", "Dan O'Brien"]);
  });
  it("pages and sorts; total stays the full count", async () => {
    const p = await rows(spec([]), { sort: "created_on", dir: "desc", offset: 1, limit: 2 });
    expect(p.total).toBe(5);
    expect(p.names).toEqual(["Alice Angel", "Bob Fund"]);
  });
  it("group paging: role, facet, lead source, assignees, created month, and the Unassigned bucket", async () => {
    expect((await rows(spec([]), { groupBy: "profile", groupValue: "investor" })).names).toEqual(["Alice Angel", "Bob Fund"]);
    expect((await rows(spec([]), { groupBy: "profile", groupValue: "other" })).names).toEqual(["Eve Nobody"]);
    expect((await rows(spec([]), { groupBy: "investorTypes", groupValue: "Fund Manager" })).names).toEqual(["Bob Fund"]);
    expect((await rows(spec([]), { groupBy: "investorTypes", groupValue: "__none__" })).names).toEqual(["Carol \"CJ\" Jones", "Dan O'Brien", "Eve Nobody"]);
    expect((await rows(spec([]), { groupBy: "leadSource", groupValue: "__none__" })).names).toEqual(["Dan O'Brien", "Eve Nobody"]);
    expect((await rows(spec([]), { groupBy: "assignees", groupValue: OWNER_B })).names).toEqual(["Bob Fund", "Dan O'Brien"]);
    expect((await rows(spec([]), { groupBy: "createdMonth", groupValue: "2026-09" })).names).toEqual(["Alice Angel", "Carol \"CJ\" Jones"]);
    expect((await rows(spec([]), { groupBy: "country", groupValue: "__none__" })).names).toEqual(["Dan O'Brien"]);
  });
  it("unknown field or op raises instead of silently matching everything", async () => {
    await expect(rows(spec([{ field: "nope", op: "in", value: ["x"] }]))).rejects.toThrow(/unknown field/);
    await expect(rows(spec([{ field: "country", op: "contains", value: "x" }]))).rejects.toThrow(/unsupported op/);
  });
});

describe("count_contact_buckets — header counts equal the rows a group expands to", () => {
  it("role buckets", async () => {
    expect(await buckets(spec([]), "profile")).toEqual({ investor: 2, founder: 1, advisor: 1, other: 1 });
  });
  it("facet buckets count a row once per value, Unassigned last", async () => {
    const b = await buckets(spec([]), "investorTypes");
    expect(b).toEqual({ "Angel Investor": 1, "Venture Capital": 1, "Fund Manager": 1, __none__: 3 });
  });
  it("buckets respect the spec and the owner scope", async () => {
    expect(await buckets(spec([{ field: "type", op: "in", value: ["investor"] }]), "leadSource")).toEqual({ LinkedIn: 1, "SEC Form D": 1 });
    expect(await buckets(spec([]), "profile", OWNER_A)).toEqual({ investor: 1, advisor: 1 });
  });
  it("every bucket count matches paging into that bucket", async () => {
    for (const dim of ["profile", "industries", "investorTypes", "leadSource", "country", "company", "source", "assignees", "createdMonth"]) {
      const b = await buckets(spec([]), dim);
      for (const [value, n] of Object.entries(b)) {
        const r = await rows(spec([]), { groupBy: dim, groupValue: value, limit: 200 });
        expect({ dim, value, total: r.total }).toEqual({ dim, value, total: n });
      }
    }
  });
  it("search_contact_ids returns the same set the list would page through", async () => {
    const r = await pg.query<{ id: string }>("select search_contact_ids as id from public.search_contact_ids($1::jsonb, null, 'profile', 'investor')", [JSON.stringify(spec([]))]);
    expect(r.rows).toHaveLength(2);
  });
});
