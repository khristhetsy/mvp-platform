import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { loadEnvLocalIfNeeded } from "./lib/load-env.mjs";

loadEnvLocalIfNeeded();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((n) => n.endsWith(".sql")).sort()
  : [];

const REQUIRED_BUCKETS = ["pitch-decks", "spv-investor-documents", "company-documents"];
const BACKUP_ACTIONS = [
  "backup.database.completed",
  "backup.database.failed",
  "backup.storage.manifest.completed",
  "backup.storage.failed",
  "backup.verification.passed",
  "backup.verification.failed",
];

function envPresent(key) {
  return Boolean(process.env[key]?.trim());
}

function hostFromUrl(value) {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

const [
  bucketsRes,
  googleCountRes,
  profilesRes,
  companiesRes,
  documentsRes,
  notificationsRes,
  spvRes,
  backupLogsRes,
] = await Promise.all([
  admin.storage.listBuckets(),
  admin.from("connected_accounts").select("id", { count: "exact", head: true }).eq("provider", "google"),
  admin.from("profiles").select("id", { count: "exact", head: true }),
  admin.from("companies").select("id", { count: "exact", head: true }),
  admin.from("documents").select("id", { count: "exact", head: true }),
  admin.from("notifications").select("id", { count: "exact", head: true }),
  admin.from("spv_opportunities").select("id", { count: "exact", head: true }),
  admin
    .from("audit_logs")
    .select("action, created_at, metadata")
    .in("action", BACKUP_ACTIONS)
    .order("created_at", { ascending: false })
    .limit(10),
]);

const bucketNames = new Set((bucketsRes.data ?? []).map((b) => b.name ?? b.id));

const snapshot = {
  generatedAt: new Date().toISOString(),
  environment: {
    nodeEnv: process.env.NODE_ENV ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    supabaseProjectHost: hostFromUrl(url),
    supabasePublicConfigured: envPresent("NEXT_PUBLIC_SUPABASE_URL") && envPresent("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleConfigured: envPresent("SUPABASE_SERVICE_ROLE_KEY"),
    databaseUrlConfigured: envPresent("DATABASE_URL"),
    googleOAuthConfigured:
      envPresent("GOOGLE_CLIENT_ID") &&
      envPresent("GOOGLE_CLIENT_SECRET") &&
      envPresent("GOOGLE_REDIRECT_URI") &&
      envPresent("TOKEN_ENCRYPTION_SECRET"),
    claudeConfigured: envPresent("ANTHROPIC_API_KEY"),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
    googleRedirectHost: hostFromUrl(process.env.GOOGLE_REDIRECT_URI),
  },
  migrations: {
    latest: migrationFiles.at(-1) ?? null,
    total: migrationFiles.length,
    files: migrationFiles,
  },
  storage: {
    buckets: (bucketsRes.data ?? []).map((b) => ({ name: b.name ?? b.id, public: b.public ?? false })),
    requiredBucketsPresent: Object.fromEntries(
      REQUIRED_BUCKETS.map((name) => [name, bucketNames.has(name)]),
    ),
  },
  integrations: {
    googleConnectedAccounts: googleCountRes.count ?? 0,
  },
  counts: {
    profiles: profilesRes.count,
    companies: companiesRes.count,
    documents: documentsRes.count,
    notifications: notificationsRes.count,
    spvOpportunities: spvRes.count,
  },
  backup: {
    lastEvents: (backupLogsRes.data ?? []).map((row) => ({
      action: row.action,
      createdAt: row.created_at,
      level: row.metadata?.level ?? null,
      metadata: row.metadata ?? {},
    })),
  },
};

const backupDir = process.env.BACKUP_DIR?.trim() || path.join(process.cwd(), "backups");
fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outfile = path.join(backupDir, `operational-metadata-${stamp}.json`);
fs.writeFileSync(outfile, JSON.stringify(snapshot, null, 2));
console.log(`Wrote ${outfile}`);
