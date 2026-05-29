import fs from "node:fs";
import path from "node:path";
import pg from "pg";

function loadEnvLocalIfNeeded() {
  if (process.env.DATABASE_URL) return;

  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const contents = fs.readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const value = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocalIfNeeded();

const migrationFile = process.argv[2] ?? "supabase/migrations/0007_admin_platform_linking.sql";
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Missing DATABASE_URL. Add it to .env.local (Supabase → Project Settings → Database).");
  process.exit(1);
}

const sql = fs.readFileSync(path.join(process.cwd(), migrationFile), "utf8");
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  console.log(`Applied migration: ${migrationFile}`);
} catch (error) {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await client.end();
}
