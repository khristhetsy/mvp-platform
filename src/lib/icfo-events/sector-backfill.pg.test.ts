/**
 * The backfill, against real Postgres.
 *
 * A migration that only ever runs once is exactly the kind that gets written,
 * never tested, and pasted into the SQL editor at the point it can do damage.
 * This runs it over rows shaped like the ones on the current event.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const MIGRATION = readFileSync(
  join(process.cwd(), "supabase/migrations/20260922013_registration_sectors_to_slugs.sql"),
  "utf8",
);

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  // Only the two columns the backfill touches: a schema copy would drift from
  // the real one and prove less, not more.
  await db.exec(`
    create table public.registrations (
      id uuid primary key default gen_random_uuid(),
      answers jsonb not null default '{}'::jsonb
    );
    create table public.networking_optins (
      id uuid primary key default gen_random_uuid(),
      interests jsonb not null default '[]'::jsonb
    );
  `);
});

afterAll(async () => { await db.close(); });

async function answers(): Promise<Record<string, unknown>[]> {
  const r = await db.query<{ answers: Record<string, unknown> }>(
    "select answers from public.registrations order by (answers->>'name')",
  );
  return r.rows.map((x) => x.answers);
}

describe("backfilling stored sectors to slugs", () => {
  beforeAll(async () => {
    await db.exec(`
      insert into public.registrations (answers) values
        ('{"name":"a","sectors":["FinTech","SaaS / B2B Software"]}'),
        ('{"name":"b","sector":"HealthTech"}'),
        ('{"name":"c","sectors":["fintech"]}'),
        ('{"name":"d","sectors":["AI / ML","E-commerce","Real Estate","Deep Tech"]}'),
        ('{"name":"e","sectors":["Agtech"]}'),
        ('{"name":"f","sectors":"FinTech"}'),
        ('{"name":"g","pitch":"no sectors at all"}'),
        ('{"name":"h","sectors":[]}');
      insert into public.networking_optins (interests) values
        ('["FinTech","fintech"]'), ('["saas"]');
    `);
    await db.exec(MIGRATION);
  });

  it("resolves labels to slugs", async () => {
    const rows = await answers();
    expect(rows[0].sectors).toEqual(["fintech", "saas"]);
    expect(rows[1].sector).toBe("healthtech");
  });

  it("leaves rows that were already slugs alone", async () => {
    expect((await answers())[2].sectors).toEqual(["fintech"]);
  });

  it("handles the labels with separators in them", async () => {
    expect(((await answers())[3].sectors as string[]).sort())
      .toEqual(["ai-ml", "deep-tech", "ecommerce", "real-estate"]);
  });

  it("keeps a legacy value rather than dropping the answer", async () => {
    expect((await answers())[4].sectors).toEqual(["agtech"]);
  });

  it("converts a sectors answer that was stored as one string", async () => {
    expect((await answers())[5].sectors).toBe("fintech");
  });

  it("leaves a registration that declared nothing untouched", async () => {
    const rows = await answers();
    expect(rows[6]).toEqual({ name: "g", pitch: "no sectors at all" });
    expect(rows[7].sectors).toEqual([]);
  });

  it("normalises the opt-in store too, and de-duplicates across spellings", async () => {
    const r = await db.query<{ interests: string[] }>(
      "select interests from public.networking_optins order by interests::text",
    );
    const all = r.rows.map((x) => x.interests);
    expect(all).toContainEqual(["fintech"]);
    expect(all).toContainEqual(["saas"]);
  });

  it("leaves no helper function behind", async () => {
    const r = await db.query<{ n: number }>(
      "select count(*)::int as n from pg_proc where proname = 'icfo_sector_slug'",
    );
    expect(r.rows[0].n).toBe(0);
  });

  it("is safe to run twice", async () => {
    const before = await answers();
    await db.exec(MIGRATION);
    expect(await answers()).toEqual(before);
  });
});
