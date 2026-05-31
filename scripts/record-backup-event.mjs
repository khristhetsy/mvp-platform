import { createClient } from "@supabase/supabase-js";
import { loadEnvLocalIfNeeded } from "./lib/load-env.mjs";

loadEnvLocalIfNeeded();

const action = process.argv[2];
const level = process.argv[3] ?? "info";
const metadataRaw = process.argv[4];

if (!action) {
  console.error("Usage: node scripts/record-backup-event.mjs <action> [level] [metadata-json]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

let metadata = {};
if (metadataRaw) {
  try {
    metadata = JSON.parse(metadataRaw);
  } catch {
    metadata = { detail: metadataRaw };
  }
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { error } = await admin.from("audit_logs").insert({
  user_id: null,
  action,
  entity_type: "backup",
  entity_id: null,
  metadata: {
    level,
    recordedAt: new Date().toISOString(),
    ...metadata,
  },
});

if (error) {
  console.error("[capitalos] backup audit log failed:", error.message);
  process.exit(1);
}

console.log(`Recorded backup event: ${action} (${level})`);
