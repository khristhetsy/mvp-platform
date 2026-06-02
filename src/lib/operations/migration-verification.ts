import fs from "node:fs";
import path from "node:path";
import pg from "pg";

/** Minimum migration required for private beta launch hardening. */
export const REQUIRED_MIGRATION_FLOOR = "0056_launch_hardening_security";

export type MigrationVerificationResult = {
  floor: string;
  repoLatest: string | null;
  repoTotal: number;
  appliedLatest: string | null;
  appliedTotal: number | null;
  floorApplied: boolean;
  ok: boolean;
  databaseQueryable: boolean;
  detail: string;
};

function migrationsDir() {
  return path.join(process.cwd(), "supabase", "migrations");
}

export function listRepoMigrationFiles() {
  const dir = migrationsDir();
  if (!fs.existsSync(dir)) {
    return [] as string[];
  }

  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

export function migrationVersionFromFile(filename: string) {
  return filename.replace(/\.sql$/i, "");
}

export function migrationNumericPrefix(version: string) {
  const match = /^(\d+)/.exec(version);
  return match ? Number.parseInt(match[1], 10) : 0;
}

export function isMigrationAtOrAboveFloor(version: string, floor = REQUIRED_MIGRATION_FLOOR) {
  return migrationNumericPrefix(version) >= migrationNumericPrefix(floor);
}

export async function queryAppliedMigrationVersions(): Promise<{
  versions: string[];
  databaseQueryable: boolean;
  error: string | null;
}> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return { versions: [], databaseQueryable: false, error: "DATABASE_URL not configured" };
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    const result = await client.query<{ version: string }>(
      "select version from supabase_migrations.schema_migrations order by version asc",
    );
    return {
      versions: result.rows.map((row) => String(row.version)),
      databaseQueryable: true,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to query applied migrations";
    return { versions: [], databaseQueryable: true, error: message };
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function verifyMigrationsApplied(
  floor = REQUIRED_MIGRATION_FLOOR,
): Promise<MigrationVerificationResult> {
  const repoFiles = listRepoMigrationFiles();
  const repoLatest = repoFiles.at(-1) ? migrationVersionFromFile(repoFiles.at(-1)!) : null;

  const { versions, databaseQueryable, error } = await queryAppliedMigrationVersions();

  if (!databaseQueryable) {
    const repoFloorPresent = repoFiles.some((file) => migrationVersionFromFile(file) === floor);
    return {
      floor,
      repoLatest,
      repoTotal: repoFiles.length,
      appliedLatest: null,
      appliedTotal: null,
      floorApplied: false,
      ok: false,
      databaseQueryable: false,
      detail: error ?? "Set DATABASE_URL on the server to verify applied migrations against Supabase.",
    };
  }

  if (error) {
    return {
      floor,
      repoLatest,
      repoTotal: repoFiles.length,
      appliedLatest: null,
      appliedTotal: 0,
      floorApplied: false,
      ok: false,
      databaseQueryable: true,
      detail: `Migration query failed: ${error}`,
    };
  }

  const appliedLatest = versions.at(-1) ?? null;
  const floorApplied = versions.some(
    (version) => version === floor || isMigrationAtOrAboveFloor(version, floor),
  );

  return {
    floor,
    repoLatest,
    repoTotal: repoFiles.length,
    appliedLatest,
    appliedTotal: versions.length,
    floorApplied,
    ok: floorApplied,
    databaseQueryable: true,
    detail: floorApplied
      ? `Migration floor ${floor} is applied (latest applied: ${appliedLatest ?? "none"}).`
      : `Migration floor ${floor} is NOT applied. Latest applied: ${appliedLatest ?? "none"}. Run pending Supabase migrations.`,
  };
}
