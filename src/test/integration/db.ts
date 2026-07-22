import { Pool } from "pg";

// Shared connection for integration tests. Points at a real Postgres that has
// had all migrations applied (Supabase local stack in CI). Fails fast with a
// clear message if the URL isn't set, rather than hanging on a bad connection.

const url = process.env.TEST_DATABASE_URL;

export const hasTestDatabase = Boolean(url);

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Integration tests need a live Postgres — run `supabase start` and set " +
        "TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres",
    );
  }
  if (!pool) pool = new Pool({ connectionString: url, max: 4 });
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/** True if RLS is enabled on a public table. Reads the live catalog, not migrations. */
export async function isRlsEnabled(table: string): Promise<boolean> {
  const { rows } = await getPool().query<{ relrowsecurity: boolean }>(
    `select c.relrowsecurity
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = $1`,
    [table],
  );
  return rows[0]?.relrowsecurity ?? false;
}

/** True if a unique constraint or unique index covers exactly the given columns. */
export async function hasUniqueOn(table: string, columns: string[]): Promise<boolean> {
  const { rows } = await getPool().query<{ cols: string[] }>(
    `select array_agg(a.attname order by a.attname) as cols
       from pg_constraint con
       join pg_class c on c.oid = con.conrelid
       join pg_namespace n on n.oid = c.relnamespace
       join unnest(con.conkey) as k(attnum) on true
       join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum
      where n.nspname = 'public' and c.relname = $1 and con.contype in ('u','p')
      group by con.oid`,
    [table],
  );
  const want = [...columns].sort().join(",");
  return rows.some((r) => [...r.cols].sort().join(",") === want);
}

/** True if a column exists on a public table. */
export async function hasColumn(table: string, column: string): Promise<boolean> {
  const { rows } = await getPool().query(
    `select 1
       from information_schema.columns
      where table_schema = 'public' and table_name = $1 and column_name = $2`,
    [table, column],
  );
  return rows.length > 0;
}
