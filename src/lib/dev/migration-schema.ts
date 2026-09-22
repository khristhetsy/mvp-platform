/**
 * The real schema, built by running the migrations.
 *
 * Parsing `create table` by hand would miss columns added in later `alter`s,
 * inside `do $$` blocks, or by anything conditional — which is exactly where
 * the interesting ones live. So the migrations are applied to an in-process
 * Postgres and the answer read from `information_schema`.
 *
 * Test-support only; never imported by the app.
 */

import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * What Supabase provides before any migration runs. PGlite has none of it, and
 * without these the first migration fails and every later one cascades.
 */
const PRELUDE = `
  create schema if not exists auth;
  create schema if not exists storage;
  create schema if not exists extensions;

  create or replace function public.gen_random_uuid() returns uuid language sql volatile as $$
    select md5(random()::text || clock_timestamp()::text)::uuid $$;

  create or replace function auth.uid()  returns uuid  language sql stable as $$ select null::uuid $$;
  create or replace function auth.role() returns text  language sql stable as $$ select 'service_role'::text $$;
  create or replace function auth.jwt()  returns jsonb language sql stable as $$ select '{}'::jsonb $$;

  create table if not exists auth.users (
    id uuid primary key, email text, raw_user_meta_data jsonb, created_at timestamptz default now());

  create table if not exists storage.buckets (
    id text primary key, name text, public boolean default false, owner uuid,
    file_size_limit bigint, allowed_mime_types text[],
    created_at timestamptz default now(), updated_at timestamptz default now());
  create table if not exists storage.objects (
    id uuid primary key default public.gen_random_uuid(), bucket_id text, name text,
    owner uuid, metadata jsonb, created_at timestamptz default now());
  create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
    select string_to_array(name, '/') $$;
  create or replace function storage.filename(name text) returns text language sql immutable as $$
    select split_part(name, '/', array_length(string_to_array(name, '/'), 1)) $$;
  create or replace function storage.extension(name text) returns text language sql immutable as $$
    select split_part(name, '.', 2) $$;

  do $$ begin create publication supabase_realtime; exception when others then null; end $$;
  do $$ begin create role authenticated; exception when others then null; end $$;
  do $$ begin create role service_role;  exception when others then null; end $$;
  do $$ begin create role anon;          exception when others then null; end $$;
`;

/** Extensions PGlite doesn't ship, and the indexes that need them. */
function portable(sql: string): string {
  return sql
    .replace(/create\s+extension[^;]*;/gi, "")
    .replace(/create\s+index[^;]*gin_trgm_ops[^;]*;/gi, "");
}

export type MigrationSchema = {
  /** table name → its columns. Only tables the run actually created. */
  columns: Map<string, Set<string>>;
  /** Migrations that could not be applied here, with the reason. */
  skipped: { file: string; reason: string }[];
  applied: number;
  total: number;
};

/**
 * Apply every migration in order and read back the schema.
 *
 * A migration that won't run under PGlite is recorded and stepped over rather
 * than thrown: the guard's job is to catch columns that don't exist, and it is
 * worth nothing if one unsupported index turns it red.
 */
export async function buildMigrationSchema(dir = "supabase/migrations"): Promise<MigrationSchema> {
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const pg = new PGlite();
  const skipped: { file: string; reason: string }[] = [];
  let applied = 0;

  try {
    await pg.exec(PRELUDE);
    for (const file of files) {
      try {
        await pg.exec(portable(readFileSync(join(dir, file), "utf8")));
        applied += 1;
      } catch (err) {
        skipped.push({ file, reason: err instanceof Error ? err.message.split("\n")[0] : String(err) });
      }
    }

    const { rows } = await pg.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns where table_schema = 'public'`,
    );
    const columns = new Map<string, Set<string>>();
    for (const r of rows) {
      const set = columns.get(r.table_name) ?? new Set<string>();
      set.add(r.column_name);
      columns.set(r.table_name, set);
    }
    return { columns, skipped, applied, total: files.length };
  } finally {
    await pg.close();
  }
}
