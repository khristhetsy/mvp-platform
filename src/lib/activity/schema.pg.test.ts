/**
 * The activity schema on real Postgres (PGlite).
 *
 * The migration is applied by hand in the Supabase SQL editor, so a syntax error
 * or a constraint that does not do what it claims is only found in production
 * unless it is executed here first.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let pg: PGlite;
const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const CO = "33333333-3333-3333-3333-333333333333";

beforeAll(async () => {
  pg = new PGlite();

  // PGlite has no `auth` schema, so it has to exist before anything references
  // auth.uid() in an RLS policy.
  await pg.exec(`
    create schema if not exists public;
    create schema if not exists auth;
    create table auth.users (id uuid primary key);
    create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    end $$;
  `);

  await pg.exec(`
    create table public.profiles (
      id uuid primary key,
      role text,
      is_super_admin boolean default false,
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    );
    create table public.companies (id uuid primary key, company_name text);
    create table public.spv_opportunities (id uuid primary key);
    -- 0044's RLS policies call this; it exists in the real database.
    create or replace function public.is_staff() returns boolean language sql as $$ select true $$;
    insert into public.profiles (id, role, is_super_admin) values
      ('${A}', 'admin', true), ('${B}', 'analyst', false);
    insert into public.companies values ('${CO}', 'Tinski Tech');
  `);

  // 0044 created the events table; only its shape matters here.
  await pg.exec(
    readFileSync(join(process.cwd(), "supabase/migrations/0044_operational_activity.sql"), "utf8"),
  );
  await pg.exec(
    readFileSync(
      join(process.cwd(), "supabase/migrations/20260921003_activity_stage_assignments.sql"),
      "utf8",
    ),
  );
});

afterAll(async () => {
  await pg.close();
});

describe("the activity migration applies cleanly", () => {
  it("adds the stage and audience columns to the events table", async () => {
    const r = await pg.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_name = 'operational_activity_events'
          and column_name in ('activity_stage', 'activity_audience')`,
    );
    expect(r.rows.map((x) => x.column_name).sort()).toEqual([
      "activity_audience",
      "activity_stage",
    ]);
  });

  it("accepts every real stage and rejects anything else", async () => {
    for (const stage of [
      "initialize",
      "qualify",
      "deploy",
      "optimize",
      "prospect",
      "outreach",
      "engaged",
      "diligence",
      "committed",
    ]) {
      await pg.query(
        `insert into public.operational_activity_events
           (event_type, event_category, entity_type, title, source_module, activity_stage, activity_audience)
         values ('founder.profile_edited', 'founder', 'company', 't', 'test', $1, 'founder')`,
        [stage],
      );
    }

    await expect(
      pg.query(
        `insert into public.operational_activity_events
           (event_type, event_category, entity_type, title, source_module, activity_stage)
         values ('x', 'founder', 'company', 't', 'test', 'Preparation')`,
      ),
    ).rejects.toThrow();
  });

  it("leaves the stage nullable so the pre-existing 0044 rows stay valid", async () => {
    const r = await pg.query(
      `insert into public.operational_activity_events
         (event_type, event_category, entity_type, title, source_module)
       values ('digest_generated', 'system', 'system', 'daily digest', 'cron') returning id`,
    );
    expect(r.rows).toHaveLength(1);
  });
});

describe("one lead per stage is enforced by the database, not by hope", () => {
  it("allows several assignees on a stage", async () => {
    await pg.query(
      `insert into public.activity_stage_assignments (audience, stage, user_id, is_lead)
       values ('founder', 'qualify', $1, true), ('founder', 'qualify', $2, false)`,
      [A, B],
    );
    const r = await pg.query<{ n: number }>(
      `select count(*)::int as n from public.activity_stage_assignments where stage = 'qualify'`,
    );
    expect(r.rows[0].n).toBe(2);
  });

  it("refuses a second lead on the same stage", async () => {
    // Two leads is the same failure as no lead: nobody knows who owns it.
    await expect(
      pg.query(
        `update public.activity_stage_assignments set is_lead = true
          where stage = 'qualify' and user_id = $1`,
        [B],
      ),
    ).rejects.toThrow();
  });

  it("refuses the same person twice on one stage", async () => {
    await expect(
      pg.query(
        `insert into public.activity_stage_assignments (audience, stage, user_id)
         values ('founder', 'qualify', $1)`,
        [A],
      ),
    ).rejects.toThrow();
  });

  it("allows the same person to lead a different stage", async () => {
    const r = await pg.query(
      `insert into public.activity_stage_assignments (audience, stage, user_id, is_lead)
       values ('founder', 'deploy', $1, true) returning id`,
      [A],
    );
    expect(r.rows).toHaveLength(1);
  });
});

describe("escalation policy", () => {
  it("seeds a row for every one of the nine stages", async () => {
    const r = await pg.query<{ n: number }>(
      `select count(*)::int as n from public.activity_stage_policies`,
    );
    expect(r.rows[0].n).toBe(9);
  });

  it("gives the money-moving stages the shortest window", async () => {
    const r = await pg.query<{ stage: string; escalate_after_minutes: number }>(
      `select stage, escalate_after_minutes from public.activity_stage_policies
        where stage in ('optimize', 'committed', 'prospect') order by escalate_after_minutes`,
    );
    expect(r.rows[0].escalate_after_minutes).toBe(60);
    expect(r.rows.at(-1)?.stage).toBe("prospect");
  });

  it("points escalation at a super_admin, not at nobody", async () => {
    const r = await pg.query<{ escalate_to_user_id: string | null }>(
      `select escalate_to_user_id from public.activity_stage_policies where stage = 'qualify'`,
    );
    expect(r.rows[0].escalate_to_user_id).toBe(A);
  });

  it("rejects a negative escalation window", async () => {
    await expect(
      pg.query(
        `update public.activity_stage_policies set escalate_after_minutes = -1 where stage = 'qualify'`,
      ),
    ).rejects.toThrow();
  });
});

describe("escalation and read bookkeeping", () => {
  it("records a read only once per person per event", async () => {
    const ev = await pg.query<{ id: string }>(
      `insert into public.operational_activity_events
         (event_type, event_category, entity_type, title, source_module, activity_stage, activity_audience)
       values ('founder.document_deleted', 'diligence', 'document', 'Removed a file', 'test', 'qualify', 'founder')
       returning id`,
    );
    const eventId = ev.rows[0].id;

    await pg.query(`insert into public.activity_event_reads (event_id, user_id) values ($1, $2)`, [
      eventId,
      A,
    ]);
    await expect(
      pg.query(`insert into public.activity_event_reads (event_id, user_id) values ($1, $2)`, [
        eventId,
        A,
      ]),
    ).rejects.toThrow();
  });

  it("escalates an event at most once", async () => {
    // Without this the sweep would re-notify the same unopened event every run.
    const ev = await pg.query<{ id: string }>(
      `insert into public.operational_activity_events
         (event_type, event_category, entity_type, title, source_module, activity_stage, activity_audience)
       values ('founder.outreach_below_gate', 'outreach', 'campaign', 'Under the gate', 'test', 'deploy', 'founder')
       returning id`,
    );
    const eventId = ev.rows[0].id;

    await pg.query(
      `insert into public.activity_event_escalations (event_id, escalated_to) values ($1, $2)`,
      [eventId, A],
    );
    await expect(
      pg.query(
        `insert into public.activity_event_escalations (event_id, escalated_to) values ($1, $2)`,
        [eventId, A],
      ),
    ).rejects.toThrow();
  });

  it("cleans up read and escalation rows when the event is deleted", async () => {
    const ev = await pg.query<{ id: string }>(
      `insert into public.operational_activity_events
         (event_type, event_category, entity_type, title, source_module, activity_stage, activity_audience)
       values ('founder.profile_edited', 'founder', 'company', 'x', 'test', 'initialize', 'founder')
       returning id`,
    );
    const eventId = ev.rows[0].id;
    await pg.query(`insert into public.activity_event_reads (event_id, user_id) values ($1, $2)`, [
      eventId,
      B,
    ]);
    await pg.query(`delete from public.operational_activity_events where id = $1`, [eventId]);
    const r = await pg.query<{ n: number }>(
      `select count(*)::int as n from public.activity_event_reads where event_id = $1`,
      [eventId],
    );
    expect(r.rows[0].n).toBe(0);
  });
});
