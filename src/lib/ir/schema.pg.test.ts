/**
 * The ir_* schema on real Postgres (PGlite): stage-event trigger, one-match-per-investor
 * rule, generated end_date, activity ownership check.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let pg: PGlite;
const P = "11111111-1111-1111-1111-111111111111", C = "22222222-2222-2222-2222-222222222222", INV = "33333333-3333-3333-3333-333333333333", INV2 = "44444444-4444-4444-4444-444444444444";

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    create schema if not exists public;
    create table public.profiles (id uuid primary key, role text);
    create table public.companies (id uuid primary key, company_name text);
    create table public.crm_contacts (id uuid primary key, name text, company text);
    create table public.sales_opportunities (id uuid primary key);
    create table public.scheduling_bookings (id uuid primary key);
    create or replace function public.is_staff() returns boolean language sql as $$ select true $$;
    do $$ begin if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if; end $$;
    insert into public.profiles values ('${P}', 'admin');
    insert into public.companies values ('${C}', 'Doyle Organics');
    insert into public.crm_contacts values ('${INV}', 'Dan Farrell', 'Farrell Capital'), ('${INV2}', 'Chris Leary', 'Leary Ventures');
  `);
  await pg.exec(readFileSync(join(process.cwd(), "supabase/migrations/20260917001_ir_deal_flow.sql"), "utf8"));
  await pg.exec(readFileSync(join(process.cwd(), "supabase/migrations/20260918001_ir_scheduled_summaries.sql"), "utf8"));
  await pg.exec(readFileSync(join(process.cwd(), "supabase/migrations/20260918002_ir_blockers.sql"), "utf8"));
  await pg.exec(readFileSync(join(process.cwd(), "supabase/migrations/20260918003_ir_project_description.sql"), "utf8"));
});
afterAll(async () => { await pg.close(); });

describe("ir schema", () => {
  let projectId: string, matchId: string;
  it("end_date is start + term × 28 days", async () => {
    const r = await pg.query<{ id: string; end_date: string }>(`insert into public.ir_projects (company_id, title, owner_id, start_date, term_months, created_by) values ($1, 'Doyle Organics', $2, '2026-04-22', 6, $2) returning id, end_date::text`, [C, P]);
    projectId = r.rows[0].id;
    expect(r.rows[0].end_date).toBe("2026-10-07");
  });
  it("a project needs a company or a founder contact", async () => {
    await expect(pg.query(`insert into public.ir_projects (title, owner_id, start_date, term_months, created_by) values ('x', $1, '2026-01-01', 4, $1)`, [P])).rejects.toThrow();
  });
  it("inserting a match records the first stage event; changing stage records another", async () => {
    const r = await pg.query<{ id: string }>(`insert into public.ir_matches (project_id, investor_contact_id, created_by) values ($1, $2, $3) returning id`, [projectId, INV, P]);
    matchId = r.rows[0].id;
    await pg.query(`update public.ir_matches set stage = 'intro_sent' where id = $1`, [matchId]);
    await pg.query(`update public.ir_matches set starred = true where id = $1`, [matchId]);   // no stage change → no event
    const ev = await pg.query<{ from_stage: string | null; to_stage: string; changed_by: string | null }>(`select from_stage, to_stage, changed_by from public.ir_match_stage_events where match_id = $1 order by id`, [matchId]);
    expect(ev.rows).toEqual([{ from_stage: null, to_stage: "matched", changed_by: P }, { from_stage: "matched", to_stage: "intro_sent", changed_by: null }]);
  });
  it("the same investor cannot be matched twice to one project, but can be on another", async () => {
    await expect(pg.query(`insert into public.ir_matches (project_id, investor_contact_id) values ($1, $2)`, [projectId, INV])).rejects.toThrow(/unique|duplicate/i);
    const p2 = await pg.query<{ id: string }>(`insert into public.ir_projects (company_id, title, owner_id, start_date, term_months, created_by) values ($1, 'Second raise', $2, '2026-06-01', 4, $2) returning id`, [C, P]);
    await expect(pg.query(`insert into public.ir_matches (project_id, investor_contact_id) values ($1, $2)`, [p2.rows[0].id, INV])).resolves.toBeTruthy();
  });
  it("an activity must belong to a match or a task", async () => {
    await expect(pg.query(`insert into public.ir_activities (project_id, type, subject, created_by) values ($1, 'call', 'x', $2)`, [projectId, P])).rejects.toThrow();
    await expect(pg.query(`insert into public.ir_activities (project_id, match_id, type, subject, created_by) values ($1, $2, 'call', 'First call', $3)`, [projectId, matchId, P])).resolves.toBeTruthy();
  });
  it("scheduled summaries: toggles default off, one send per project + period", async () => {
    const t = await pg.query<{ weekly_summary: boolean; monthly_summary: boolean }>(`select weekly_summary, monthly_summary from public.ir_projects where id = $1`, [projectId]);
    expect(t.rows[0]).toEqual({ weekly_summary: false, monthly_summary: false });
    await pg.query(`insert into public.ir_summary_sends (project_id, kind, period_start, period_end, sent_to) values ($1, 'week', '2026-09-16', '2026-09-23', 'founder@example.com')`, [projectId]);
    await expect(pg.query(`insert into public.ir_summary_sends (project_id, kind, period_start, period_end, sent_to) values ($1, 'week', '2026-09-16', '2026-09-23', 'founder@example.com')`, [projectId])).rejects.toThrow(/unique|duplicate/i);
    await expect(pg.query(`insert into public.ir_summary_sends (project_id, kind, period_start, period_end, sent_to) values ($1, 'day', '2026-09-16', '2026-09-17', 'x@y.z')`, [projectId])).rejects.toThrow();
  });
  it("blockers default to an empty list on matches and tasks", async () => {
    const r = await pg.query<{ blockers: unknown }>(`select blockers from public.ir_matches where id = $1`, [matchId]);
    expect(r.rows[0].blockers).toEqual([]);
    await pg.query(`update public.ir_matches set blockers = '[{"label":"Data room ready","cleared_at":null}]'::jsonb where id = $1`, [matchId]);
    const r2 = await pg.query<{ n: number }>(`select jsonb_array_length(blockers) as n from public.ir_matches where id = $1`, [matchId]);
    expect(Number(r2.rows[0].n)).toBe(1);
  });
});
