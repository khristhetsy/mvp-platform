/**
 * The booking-source migration on real Postgres (PGlite).
 *
 * Applied by hand in the Supabase SQL editor, so a syntax error or a constraint
 * that does not do what it claims is only found in production unless it runs
 * here first. The backfill matters most: without it every historical /fit
 * meeting would drop to zero the moment the funnel switches to reading the
 * column.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let pg: PGlite;
const HOST = "11111111-1111-1111-1111-111111111111";
const CONTACT_TAGGED = "22222222-2222-2222-2222-222222222222";
const CONTACT_JUNK = "33333333-3333-3333-3333-333333333333";
const CAMPAIGN = "44444444-4444-4444-4444-444444444444";

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    create schema if not exists public;
    create table public.profiles (id uuid primary key, full_name text, email text);

    -- Trimmed to the columns this migration touches.
    create table public.scheduling_bookings (
      id uuid primary key default gen_random_uuid(),
      host_id uuid references public.profiles(id) on delete set null,
      booker_email text,
      contact_crm_id uuid,
      start_time timestamptz not null default now(),
      end_time timestamptz not null default now(),
      status text not null default 'confirmed',
      created_at timestamptz not null default now()
    );

    create table public.crm_contacts (
      id uuid primary key,
      email text,
      overrides jsonb
    );

    create table public.social_campaigns (
      id uuid primary key,
      name text,
      source_tag text,
      archived_at timestamptz
    );

    insert into public.profiles (id, full_name) values ('${HOST}', 'Khris');
    insert into public.social_campaigns (id, name, source_tag)
      values ('${CAMPAIGN}', 'LinkedIn September', 'linkedin-sept');

    -- One contact attributed to a REAL campaign, one carrying the free text
    -- that the old booking code used to write ("LinkedIn").
    insert into public.crm_contacts (id, email, overrides) values
      ('${CONTACT_TAGGED}', 'anne@fund.com', '{"lead_source":"linkedin-sept"}'::jsonb),
      ('${CONTACT_JUNK}',  'dan@fund.com',  '{"lead_source":"LinkedIn"}'::jsonb);

    insert into public.scheduling_bookings (host_id, booker_email, contact_crm_id) values
      ('${HOST}', 'anne@fund.com', '${CONTACT_TAGGED}'),
      ('${HOST}', 'dan@fund.com',  '${CONTACT_JUNK}'),
      ('${HOST}', 'cold@lead.com', null);
  `);

  await pg.exec(
    readFileSync(
      join(process.cwd(), "supabase/migrations/20260921004_booking_source_attribution.sql"),
      "utf8",
    ),
  );
});

afterAll(async () => {
  await pg.close();
});

describe("the migration applies cleanly", () => {
  it("adds the four source columns", async () => {
    const r = await pg.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_name = 'scheduling_bookings'
          and column_name in ('source_tag','source_confidence','source_set_by','source_set_at')`,
    );
    expect(r.rows.map((x) => x.column_name).sort()).toEqual([
      "source_confidence",
      "source_set_at",
      "source_set_by",
      "source_tag",
    ]);
  });
});

describe("the backfill keeps history that /fit already attributed", () => {
  it("copies a tag that matches a real campaign onto the booking", async () => {
    // Without this, every historical meeting drops to zero the moment the
    // funnel starts reading the column instead of walking contacts.
    const r = await pg.query<{ source_tag: string; source_confidence: string }>(
      `select source_tag, source_confidence from public.scheduling_bookings
        where booker_email = 'anne@fund.com'`,
    );
    expect(r.rows[0]).toEqual({ source_tag: "linkedin-sept", source_confidence: "fit" });
  });

  it("does NOT copy free text that matches no campaign", async () => {
    // "LinkedIn" was never a campaign tag — copying it would move the old bug
    // from the contact table into the booking table.
    const r = await pg.query<{ source_tag: string | null }>(
      `select source_tag from public.scheduling_bookings where booker_email = 'dan@fund.com'`,
    );
    expect(r.rows[0].source_tag).toBeNull();
  });

  it("leaves a booking with no contact unattributed", async () => {
    const r = await pg.query<{ source_tag: string | null }>(
      `select source_tag from public.scheduling_bookings where booker_email = 'cold@lead.com'`,
    );
    expect(r.rows[0].source_tag).toBeNull();
  });
});

describe("the constraints hold the data honest", () => {
  it("accepts every real confidence value", async () => {
    for (const c of ["fit", "link", "cookie", "self_reported", "manual"]) {
      await pg.query(
        `insert into public.scheduling_bookings (host_id, booker_email, source_tag, source_confidence)
         values ($1, 'x@y.com', 'linkedin-sept', $2)`,
        [HOST, c],
      );
    }
    const r = await pg.query<{ n: number }>(
      `select count(*)::int as n from public.scheduling_bookings where booker_email = 'x@y.com'`,
    );
    expect(r.rows[0].n).toBe(5);
  });

  it("rejects an invented confidence value", async () => {
    await expect(
      pg.query(
        `insert into public.scheduling_bookings (host_id, booker_email, source_tag, source_confidence)
         values ($1, 'z@y.com', 'linkedin-sept', 'guessed')`,
        [HOST],
      ),
    ).rejects.toThrow();
  });

  it("refuses a tag without a confidence", async () => {
    // A tag with no provenance would make the funnel's "7 tagged, 2
    // self-reported" breakdown a fiction.
    await expect(
      pg.query(
        `insert into public.scheduling_bookings (host_id, booker_email, source_tag)
         values ($1, 'z@y.com', 'linkedin-sept')`,
        [HOST],
      ),
    ).rejects.toThrow();
  });

  it("refuses a confidence without a tag", async () => {
    await expect(
      pg.query(
        `insert into public.scheduling_bookings (host_id, booker_email, source_confidence)
         values ($1, 'z@y.com', 'manual')`,
        [HOST],
      ),
    ).rejects.toThrow();
  });

  it("allows both to be null — unattributed is a legal state", async () => {
    const r = await pg.query(
      `insert into public.scheduling_bookings (host_id, booker_email) values ($1, 'ok@y.com') returning id`,
      [HOST],
    );
    expect(r.rows).toHaveLength(1);
  });
});

describe("the funnel's new query", () => {
  it("counts meetings by tag in one read, with no contact join", async () => {
    // This is the whole point: a booking no longer needs a CRM contact, a
    // matching lead_source, and an equal email address in order to count.
    const r = await pg.query<{ source_tag: string; n: number }>(
      `select source_tag, count(*)::int as n
         from public.scheduling_bookings
        where source_tag is not null
        group by 1`,
    );
    expect(r.rows[0].source_tag).toBe("linkedin-sept");
    // 5 from the confidence loop + 1 backfilled.
    expect(r.rows[0].n).toBe(6);
  });

  it("can find the unattributed ones for the manual queue", async () => {
    const r = await pg.query<{ n: number }>(
      `select count(*)::int as n from public.scheduling_bookings where source_tag is null`,
    );
    expect(r.rows[0].n).toBeGreaterThan(0);
  });
});
