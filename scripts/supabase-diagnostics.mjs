import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function loadEnvLocalIfNeeded() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }

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

const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function checkTable(table, select = "id") {
  const { data, error } = await supabase.from(table).select(select).limit(1);
  return { table, ok: !error, error: error?.message ?? null, sample: data?.[0] ?? null };
}

async function main() {
  // We avoid printing secrets. URL is ok to print.
  console.log(JSON.stringify({ supabaseUrl: url }, null, 2));

  // Public table reachability (PostgREST)
  const checks = await Promise.all([
    checkTable("profiles", "id, role, email"),
    checkTable("companies", "id, founder_id, company_name, status"),
    checkTable("documents", "id, company_id, uploaded_by, document_type, file_path, status"),
    checkTable("company_members", "id, company_id, user_id, role"),
  ]);
  console.log(JSON.stringify({ tableChecks: checks }, null, 2));

  // Counts to help diagnose missing linkage (service role can read regardless of RLS)
  const [{ count: profilesCount }, { count: companiesCount }, { count: documentsCount }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase.from("documents").select("id", { count: "exact", head: true }),
  ]);
  console.log(JSON.stringify({ counts: { profiles: profilesCount, companies: companiesCount, documents: documentsCount } }, null, 2));

  // Storage buckets via storage schema
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  const companyDocumentsBucket = buckets?.find((b) => b.id === "company-documents" || b.name === "company-documents") ?? null;
  console.log(
    JSON.stringify(
      {
        bucketsError: bucketsError?.message ?? null,
        buckets: buckets?.map((b) => ({ id: b.id, name: b.name, public: b.public })) ?? null,
        pitchDeckBucketExists: Boolean(buckets?.find((b) => b.id === "pitch-decks" || b.name === "pitch-decks")),
        companyDocumentsBucketExists: Boolean(companyDocumentsBucket),
        companyDocumentsBucketPublic: companyDocumentsBucket?.public ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});

