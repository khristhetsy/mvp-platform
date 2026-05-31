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

const backupDir = process.env.BACKUP_DIR?.trim() || path.join(process.cwd(), "backups");
fs.mkdirSync(backupDir, { recursive: true });

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: buckets, error: bucketsError } = await admin.storage.listBuckets();

if (bucketsError) {
  console.error("Unable to list storage buckets:", bucketsError.message);
  process.exit(1);
}

const manifest = {
  generatedAt: new Date().toISOString(),
  supabaseProjectHost: new URL(url).host,
  buckets: [],
  note:
    "Inventory only. Full object backup should use Supabase dashboard export or controlled CLI copy — not automated bulk download in this script.",
};

for (const bucket of buckets ?? []) {
  const name = bucket.name ?? bucket.id;
  const { data: objects, error: listError } = await admin.storage.from(name).list("", { limit: 100 });
  manifest.buckets.push({
    name,
    public: bucket.public ?? false,
    sampleObjectCount: listError ? null : (objects ?? []).length,
    listError: listError?.message ?? null,
  });
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outfile = path.join(backupDir, `storage-manifest-${stamp}.json`);
fs.writeFileSync(outfile, JSON.stringify(manifest, null, 2));
console.log(`Wrote ${outfile}`);
console.log(JSON.stringify({ buckets: manifest.buckets.length }, null, 2));
