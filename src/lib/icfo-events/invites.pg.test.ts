/**
 * The presenter-invite migration on real Postgres (PGlite).
 *
 * Applied by hand in the Supabase SQL editor, so anything that only fails at
 * apply time — a bare ALTER TYPE, a partial unique index that doesn't do what it
 * claims — is otherwise found in production. Two things are worth proving:
 * the enum gains 'exhibitor' without a DO block, and the open-invite constraint
 * blocks a duplicate while still allowing a re-invite after a withdrawal.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let pg: PGlite;
const EVENT = "11111111-1111-1111-1111-111111111111";
const STAFF = "22222222-2222-2222-2222-222222222222";

beforeAll(async () => {
  pg = new PGlite();
  // Trimmed to what the migration references.
  await pg.exec(`
    create schema if not exists public;
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create or replace function public.is_staff() returns boolean language sql stable as $$ select true $$;

    create type speaker_application_kind as enum ('presenter','panelist','founder_showcase');

    create table public.profiles (id uuid primary key, email text);
    create table public.events (id uuid primary key, title text);
    create table public.sessions (id uuid primary key, event_id uuid references public.events(id));
    create table public.speaker_applications (id uuid primary key, kind speaker_application_kind);
    create table public.event_presenters (
      id uuid primary key default gen_random_uuid(),
      event_id uuid not null references public.events(id) on delete cascade,
      display_name text not null
    );

    insert into public.profiles (id, email) values ('${STAFF}', 'staff@icapos.com');
    insert into public.events (id, title) values ('${EVENT}', 'iCFO PE Expo');
  `);

  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20260922001_event_presenter_invites.sql"),
    "utf8",
  );
  await pg.exec(sql);
}, 60_000);

afterAll(async () => {
  await pg?.close();
});

async function invite(email: string, status = "invited", kind = "founder_showcase") {
  return pg.query(
    `insert into public.event_presenter_invites (event_id, kind, email, status)
     values ($1, $2::speaker_application_kind, $3, $4::event_invite_status) returning id`,
    [EVENT, kind, email, status],
  );
}

describe("the migration applies", () => {
  it("adds 'exhibitor' to the shared application-kind enum", async () => {
    const r = await pg.query<{ enumlabel: string }>(
      `select enumlabel from pg_enum e
         join pg_type t on t.oid = e.enumtypid
        where t.typname = 'speaker_application_kind' order by e.enumsortorder`,
    );
    expect(r.rows.map((x) => x.enumlabel)).toEqual([
      "presenter",
      "panelist",
      "founder_showcase",
      "exhibitor",
    ]);
  });

  it("stores an exhibitor invite with no profile — they have no account", async () => {
    const r = await invite("booth@holomd.ai", "invited", "exhibitor");
    expect(r.rows).toHaveLength(1);
    const row = await pg.query<{ profile_id: string | null; token_nonce: string }>(
      `select profile_id, token_nonce from public.event_presenter_invites where email = 'booth@holomd.ai'`,
    );
    expect(row.rows[0].profile_id).toBeNull();
    expect(row.rows[0].token_nonce).toBeTruthy();
  });

  it("adds the materials columns to event_presenters", async () => {
    const r = await pg.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_name = 'event_presenters' and column_name in
          ('video_url','deck_path','deck_filename','deck_bytes','materials_updated_at')`,
    );
    expect(r.rows).toHaveLength(5);
  });
});

describe("one open invitation per person per event", () => {
  it("rejects a second open invite to the same email", async () => {
    await invite("dup@nutriflex.ai");
    await expect(invite("dup@nutriflex.ai")).rejects.toThrow();
  });

  it("treats the email case-insensitively", async () => {
    await invite("case@nutriflex.ai");
    await expect(invite("CASE@NutriFlex.ai")).rejects.toThrow();
  });

  it("allows re-inviting after a withdrawal — history is kept, not reused", async () => {
    await invite("again@nutriflex.ai");
    await pg.query(
      `update public.event_presenter_invites set status = 'withdrawn' where email = 'again@nutriflex.ai'`,
    );
    await expect(invite("again@nutriflex.ai")).resolves.toBeTruthy();
    const r = await pg.query(
      `select count(*)::int as n from public.event_presenter_invites where email = 'again@nutriflex.ai'`,
    );
    expect((r.rows[0] as { n: number }).n).toBe(2);
  });

  it("allows the same person at a different event", async () => {
    const other = "33333333-3333-3333-3333-333333333333";
    await pg.query(`insert into public.events (id, title) values ($1, 'Second event')`, [other]);
    await invite("both@nutriflex.ai");
    await expect(
      pg.query(
        `insert into public.event_presenter_invites (event_id, kind, email)
         values ($1, 'founder_showcase'::speaker_application_kind, 'both@nutriflex.ai')`,
        [other],
      ),
    ).resolves.toBeTruthy();
  });
});
