/**
 * The registration-field-set migration on real Postgres (PGlite).
 *
 * Two things are worth proving: the seed matches what the code constants
 * currently produce (so the first version changes nothing anyone sees), and the
 * one-active-row index actually holds.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  REGISTRATION_BY_TYPE,
  REGISTRATION_COMMON,
  REGISTRATION_ROLES,
} from "@/lib/icfo-events/registration-fields";

let pg: PGlite;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    create schema if not exists public;
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create or replace function public.is_staff() returns boolean language sql stable as $$ select true $$;
    create table public.profiles (id uuid primary key, email text);
  `);
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20260922002_registration_field_sets.sql"),
    "utf8",
  );
  await pg.exec(sql);
}, 60_000);

afterAll(async () => {
  await pg?.close();
});

type Row = { version: string; roles: unknown; common: unknown; by_type: unknown; is_active: boolean };

async function active(): Promise<Row> {
  const r = await pg.query<Row>(`select * from public.registration_field_sets where is_active`);
  return r.rows[0];
}

describe("the seed is today's behaviour, written down", () => {
  it("creates exactly one active version", async () => {
    const r = await pg.query<{ n: number }>(
      `select count(*)::int as n from public.registration_field_sets where is_active`,
    );
    expect(r.rows[0].n).toBe(1);
    expect((await active()).version).toBe("reg-fields-v1");
  });

  it("seeds the same four attendee types the code declares", async () => {
    const roles = (await active()).roles as { key: string; label: string }[];
    expect(roles.map((r) => r.key)).toEqual(REGISTRATION_ROLES.map((r) => r.key));
    expect(roles.map((r) => r.label)).toEqual(REGISTRATION_ROLES.map((r) => r.label));
  });

  it("seeds the same shared block, in order", async () => {
    const common = (await active()).common as { key: string; label: string }[];
    expect(common.map((f) => f.key)).toEqual(REGISTRATION_COMMON.map((f) => f.key));
    expect(common.map((f) => f.label)).toEqual(REGISTRATION_COMMON.map((f) => f.label));
  });

  it("seeds every per-type question, with matching keys and labels", async () => {
    const byType = (await active()).by_type as Record<string, { key: string; label: string }[]>;
    for (const [type, fields] of Object.entries(REGISTRATION_BY_TYPE)) {
      expect(byType[type], type).toBeTruthy();
      expect(byType[type].map((f) => f.key), type).toEqual(fields.map((f) => f.key));
      expect(byType[type].map((f) => f.label), type).toEqual(fields.map((f) => f.label));
    }
  });

  it("links sectors rather than copying them", async () => {
    const byType = (await active()).by_type as Record<string, { key: string; optionsFrom?: string }[]>;
    const sectors = byType.investor.find((f) => f.key === "sectors");
    expect(sectors?.optionsFrom).toBe("sectors");
    // The country list is linked the same way.
    const common = (await active()).common as { key: string; optionsFrom?: string }[];
    expect(common.find((f) => f.key === "country")?.optionsFrom).toBe("countries");
  });

  it("does not re-seed when re-run", async () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20260922002_registration_field_sets.sql"),
      "utf8",
    );
    await pg.exec(sql);
    const r = await pg.query<{ n: number }>(`select count(*)::int as n from public.registration_field_sets`);
    expect(r.rows[0].n).toBe(1);
  });
});

describe("only one version can be active", () => {
  it("rejects a second active row", async () => {
    await expect(
      pg.query(
        `insert into public.registration_field_sets (version, roles, common, by_type, is_active)
         values ('reg-fields-v2', '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, true)`,
      ),
    ).rejects.toThrow();
  });

  it("allows any number of inactive ones", async () => {
    await pg.query(
      `insert into public.registration_field_sets (version, roles, common, by_type, is_active)
       values ('reg-fields-v3', '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, false)`,
    );
    await pg.query(
      `insert into public.registration_field_sets (version, roles, common, by_type, is_active)
       values ('reg-fields-v4', '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, false)`,
    );
    const r = await pg.query<{ n: number }>(`select count(*)::int as n from public.registration_field_sets`);
    expect(r.rows[0].n).toBe(3);
  });
});

describe("the public-listing question ships as a new version", () => {
  it("adds it to investors and founders, and to nobody else", async () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20260922005_registration_listed_publicly.sql"),
      "utf8",
    );
    await pg.exec(sql);

    const r = await pg.query<Row>(`select * from public.registration_field_sets where is_active`);
    const byType = r.rows[0].by_type as Record<string, { key: string }[]>;
    const has = (t: string) => byType[t]?.some((f) => f.key === "listedPublicly") ?? false;

    expect(r.rows[0].version).not.toBe("reg-fields-v1");
    expect(has("investor")).toBe(true);
    expect(has("founder")).toBe(true);
    expect(has("sponsor")).toBe(false);
    expect(has("service")).toBe(false);
  });

  it("leaves the previous version in place, still readable", async () => {
    const r = await pg.query<{ n: number }>(
      `select count(*)::int as n from public.registration_field_sets where version = 'reg-fields-v1'`,
    );
    expect(r.rows[0].n).toBe(1);
  });

  it("does not add it twice when re-run", async () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20260922005_registration_listed_publicly.sql"),
      "utf8",
    );
    await pg.exec(sql);
    const r = await pg.query<Row>(`select * from public.registration_field_sets where is_active`);
    const investor = (r.rows[0].by_type as Record<string, { key: string }[]>).investor ?? [];
    expect(investor.filter((f) => f.key === "listedPublicly")).toHaveLength(1);
  });
});
