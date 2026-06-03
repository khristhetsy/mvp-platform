import fs from "node:fs";
import path from "node:path";
import pg from "pg";

/** Minimum migration required for private beta launch hardening. */
export const REQUIRED_MIGRATION_FLOOR = "0056_launch_hardening_security";

export const MIGRATION_VERIFICATION_UNAVAILABLE = "Migration verification unavailable";

export type MigrationVerificationResult = {
  floor: string;
  repoLatest: string | null;
  repoTotal: number;
  appliedLatest: string | null;
  appliedTotal: number | null;
  floorApplied: boolean;
  ok: boolean;
  databaseQueryable: boolean;
  /** True when DATABASE_URL checks were skipped or could not run (non-blocking). */
  verificationUnavailable: boolean;
  detail: string;
};

function migrationsDir() {
  return path.join(process.cwd(), "supabase", "migrations");
}

export function listRepoMigrationFiles() {
  try {
    const dir = migrationsDir();
    if (!fs.existsSync(dir)) {
      return [] as string[];
    }

    return fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".sql"))
      .sort();
  } catch {
    return [] as string[];
  }
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

/** Strip secrets from database driver errors before display. */
export function sanitizeDatabaseErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Unknown database error";
  let message = raw
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[connection redacted]")
    .replace(/\bpassword[=:]\S+/gi, "password=[redacted]")
    .trim();
  if (message.length > 180) {
    message = `${message.slice(0, 180)}…`;
  }
  return message || "Unknown database error";
}

export function classifyDatabaseVerificationError(error: unknown): string {
  const message = sanitizeDatabaseErrorMessage(error).toLowerCase();
  if (
    message.includes("invalid") ||
    message.includes("unrecognized") ||
    message.includes("malformed") ||
    message.includes("must be a string") ||
    message.includes("connection string")
  ) {
    return "DATABASE_URL is invalid or malformed";
  }
  if (
    message.includes("econnrefused") ||
    message.includes("etimedout") ||
    message.includes("timeout") ||
    message.includes("enotfound") ||
    message.includes("could not connect") ||
    message.includes("connection terminated") ||
    message.includes("connection refused")
  ) {
    return "DATABASE_URL connection failed";
  }
  return "Migration query failed";
}

function unavailableDetail(reason: string) {
  return `${MIGRATION_VERIFICATION_UNAVAILABLE} — ${reason}`;
}

function buildRepoMeta(repoFiles: string[]) {
  return {
    repoLatest: repoFiles.at(-1) ? migrationVersionFromFile(repoFiles.at(-1)!) : null,
    repoTotal: repoFiles.length,
  };
}

function buildUnavailableResult(
  floor: string,
  reason: string,
  repoFiles: string[],
): MigrationVerificationResult {
  const { repoLatest, repoTotal } = buildRepoMeta(repoFiles);
  return {
    floor,
    repoLatest,
    repoTotal,
    appliedLatest: null,
    appliedTotal: null,
    floorApplied: false,
    ok: true,
    databaseQueryable: false,
    verificationUnavailable: true,
    detail: unavailableDetail(reason),
  };
}

function createPgClientSafe(): { client: pg.Client | null; setupError: string | null } {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return { client: null, setupError: "DATABASE_URL not configured" };
  }

  try {
    return { client: new pg.Client({ connectionString: databaseUrl }), setupError: null };
  } catch (error) {
    return { client: null, setupError: classifyDatabaseVerificationError(error) };
  }
}

export async function queryAppliedMigrationVersions(): Promise<{
  versions: string[];
  databaseQueryable: boolean;
  verificationUnavailable: boolean;
  error: string | null;
}> {
  const { client, setupError } = createPgClientSafe();
  if (!client) {
    const reason = setupError ?? "DATABASE_URL not configured";
    return {
      versions: [],
      databaseQueryable: false,
      verificationUnavailable: true,
      error: reason,
    };
  }

  try {
    await client.connect();
    const result = await client.query<{ version: string }>(
      "select version from supabase_migrations.schema_migrations order by version asc",
    );
    return {
      versions: result.rows.map((row) => String(row.version)),
      databaseQueryable: true,
      verificationUnavailable: false,
      error: null,
    };
  } catch (error) {
    const classified = classifyDatabaseVerificationError(error);
    const isConnectionIssue =
      classified === "DATABASE_URL connection failed" ||
      classified === "DATABASE_URL is invalid or malformed";

    return {
      versions: [],
      databaseQueryable: !isConnectionIssue,
      verificationUnavailable: isConnectionIssue,
      error: classified,
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function verifyMigrationsApplied(
  floor = REQUIRED_MIGRATION_FLOOR,
): Promise<MigrationVerificationResult> {
  try {
    const repoFiles = listRepoMigrationFiles();
    const { repoLatest, repoTotal } = buildRepoMeta(repoFiles);

    const { versions, databaseQueryable, verificationUnavailable, error } =
      await queryAppliedMigrationVersions();

    if (verificationUnavailable) {
      return buildUnavailableResult(floor, error ?? "DATABASE_URL not configured", repoFiles);
    }

    if (!databaseQueryable) {
      return buildUnavailableResult(floor, error ?? "DATABASE_URL not configured", repoFiles);
    }

    if (error) {
      return {
        floor,
        repoLatest,
        repoTotal,
        appliedLatest: null,
        appliedTotal: 0,
        floorApplied: false,
        ok: false,
        databaseQueryable: true,
        verificationUnavailable: false,
        detail: unavailableDetail("Migration query failed"),
      };
    }

    const appliedLatest = versions.at(-1) ?? null;
    const floorApplied = versions.some(
      (version) => version === floor || isMigrationAtOrAboveFloor(version, floor),
    );

    return {
      floor,
      repoLatest,
      repoTotal,
      appliedLatest,
      appliedTotal: versions.length,
      floorApplied,
      ok: floorApplied,
      databaseQueryable: true,
      verificationUnavailable: false,
      detail: floorApplied
        ? `Migration floor ${floor} is applied (latest applied: ${appliedLatest ?? "none"}).`
        : `Migration floor ${floor} is NOT applied. Latest applied: ${appliedLatest ?? "none"}. Run pending Supabase migrations.`,
    };
  } catch {
    const repoFiles = listRepoMigrationFiles();
    return buildUnavailableResult(floor, "Migration query failed", repoFiles);
  }
}
