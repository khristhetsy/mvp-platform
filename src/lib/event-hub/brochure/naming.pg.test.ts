/**
 * The unique-title migration on real Postgres (PGlite).
 *
 * Two things have to hold: the duplicates already in the library are renamed
 * rather than deleted (the index cannot be created otherwise), and a second
 * booklet can't take a name that differs only by case or spacing.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let pg: PGlite;

const EVENT_A = "11111111-1111-1111-1111-111111111111";
const EVENT_B = "22222222-2222-2222-2222-222222222222";

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    create schema if not exists public;
    create table public.event_brochures (
      id uuid primary key default gen_random_uuid(),
      event_id uuid,
      title text not null,
      created_at timestamptz not null default now()
    );
  `);

  // Exactly the shape of the library that prompted this: two identical drafts
  // for one event, a differently-spaced third, and an unrelated event.
  await pg.exec(`
    insert into public.event_brochures (event_id, title, created_at) values
      ('${EVENT_A}', 'Las Vegas — Issue 2026', '2026-09-21 10:00:00'),
      ('${EVENT_A}', 'Las Vegas — Issue 2026', '2026-09-21 10:05:00'),
      ('${EVENT_A}', 'las vegas —  Issue 2026', '2026-09-21 10:09:00'),
      ('${EVENT_B}', 'Newport Beach — Issue 2026', '2026-08-24 09:00:00'),
      (null,         'Archived 2019 booklet', '2019-01-01 09:00:00');
  `);

  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20260922003_brochure_unique_title.sql"),
    "utf8",
  );
  await pg.exec(sql);
}, 60_000);

afterAll(async () => {
  await pg?.close();
});

async function titles(eventId: string): Promise<string[]> {
  const r = await pg.query<{ title: string }>(
    `select title from public.event_brochures where event_id = $1 order by created_at`,
    [eventId],
  );
  return r.rows.map((x) => x.title);
}

describe("the duplicates already in the library", () => {
  it("keeps every row — nothing is deleted", async () => {
    const r = await pg.query<{ n: number }>(`select count(*)::int as n from public.event_brochures`);
    expect(r.rows[0].n).toBe(5);
  });

  it("leaves the oldest of a colliding group with its name", async () => {
    expect((await titles(EVENT_A))[0]).toBe("Las Vegas — Issue 2026");
  });

  it("numbers the rest in creation order", async () => {
    expect(await titles(EVENT_A)).toEqual([
      "Las Vegas — Issue 2026",
      "Las Vegas — Issue 2026 (2)",
      "las vegas — Issue 2026 (3)",
    ]);
  });

  it("does not touch an event that never had a collision", async () => {
    expect(await titles(EVENT_B)).toEqual(["Newport Beach — Issue 2026"]);
  });

  it("leaves archived imports alone — they have no event to be unique within", async () => {
    const r = await pg.query<{ title: string }>(`select title from public.event_brochures where event_id is null`);
    expect(r.rows[0].title).toBe("Archived 2019 booklet");
  });
});

describe("and stops new ones", () => {
  it("rejects an exact duplicate for the same event", async () => {
    await expect(
      pg.query(`insert into public.event_brochures (event_id, title) values ('${EVENT_A}', 'Las Vegas — Issue 2026')`),
    ).rejects.toThrow();
  });

  it("rejects one that differs only by case", async () => {
    await expect(
      pg.query(`insert into public.event_brochures (event_id, title) values ('${EVENT_A}', 'LAS VEGAS — ISSUE 2026')`),
    ).rejects.toThrow();
  });

  it("rejects one that differs only by spacing", async () => {
    await expect(
      pg.query(`insert into public.event_brochures (event_id, title) values ('${EVENT_A}', '  Las Vegas —   Issue 2026 ')`),
    ).rejects.toThrow();
  });

  it("allows the same name on a different event", async () => {
    await pg.query(`insert into public.event_brochures (event_id, title) values ('${EVENT_B}', 'Las Vegas — Issue 2026')`);
    expect(await titles(EVENT_B)).toContain("Las Vegas — Issue 2026");
  });

  it("allows a genuinely different name", async () => {
    await pg.query(`insert into public.event_brochures (event_id, title) values ('${EVENT_A}', 'Las Vegas — Issue 2027')`);
    expect(await titles(EVENT_A)).toContain("Las Vegas — Issue 2027");
  });

  it("allows any number of archived imports sharing a name", async () => {
    await pg.query(`insert into public.event_brochures (event_id, title) values (null, 'Archived 2019 booklet')`);
    const r = await pg.query<{ n: number }>(
      `select count(*)::int as n from public.event_brochures where event_id is null`,
    );
    expect(r.rows[0].n).toBe(2);
  });
});
