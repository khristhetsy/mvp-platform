// One-off: directly set a staff user's password and confirm their email,
// bypassing the email-invite/recovery flow. Run locally where .env.local holds
// the service role key for the target tier.
//
//   node scripts/set-staff-password.mjs <email> <new-password>
//
// Example:
//   node scripts/set-staff-password.mjs kthetsy@myicfos.com 'SomeStrongPass123!'

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Minimal .env.local loader (no extra deps).
function loadEnv() {
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // fall back to ambient env
  }
}
loadEnv();

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: node scripts/set-staff-password.mjs <email> <new-password>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env/.env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// Find the auth user by email (paginate if needed).
let target = null;
for (let page = 1; page <= 20 && !target; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) { console.error("listUsers failed:", error.message); process.exit(1); }
  target = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (data.users.length < 200) break;
}

if (!target) {
  console.error(`No auth user found for ${email}.`);
  process.exit(1);
}

const { error: updErr } = await admin.auth.admin.updateUserById(target.id, {
  password,
  email_confirm: true,
});
if (updErr) { console.error("updateUserById failed:", updErr.message); process.exit(1); }

// Make sure the profile role is admin (so the workspace lets them in).
const { error: roleErr } = await admin
  .from("profiles")
  .update({ role: "admin", is_active: true })
  .eq("id", target.id);
if (roleErr) console.warn("Profile role update warning:", roleErr.message);

console.log(`✓ Password set and email confirmed for ${email} (id: ${target.id}). Role set to admin.`);
