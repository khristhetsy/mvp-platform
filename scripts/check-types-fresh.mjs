#!/usr/bin/env node
// Detects Supabase type drift: every `create table public.<name>` in the
// migrations should have a corresponding entry in the generated types file.
// Missing entries mean queries against those tables have NO column-level type
// safety (a typo compiles, then fails at runtime).
//
//   node scripts/check-types-fresh.mjs           # report only (exit 0)
//   node scripts/check-types-fresh.mjs --strict  # exit 1 if any table is missing
//
// Regenerate with:  npm run db:types

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");
const typesFile = join(root, "src", "lib", "supabase", "types.ts");

const strict = process.argv.includes("--strict");

const createRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.("?)([a-z0-9_]+)\1/gi;
const tables = new Set();
for (const f of readdirSync(migrationsDir)) {
  if (!f.endsWith(".sql")) continue;
  const sql = readFileSync(join(migrationsDir, f), "utf8");
  let m;
  while ((m = createRe.exec(sql)) !== null) tables.add(m[2]);
}

const types = readFileSync(typesFile, "utf8");
const missing = [...tables].filter((t) => !new RegExp(`\\n\\s+${t}:\\s*\\{`).test(types)).sort();

if (missing.length === 0) {
  console.log(`Supabase types are fresh — all ${tables.size} migration tables are present.`);
  process.exit(0);
}

console.log(`Supabase type drift: ${missing.length} of ${tables.size} tables are missing from src/lib/supabase/types.ts`);
console.log(missing.map((t) => `  - ${t}`).join("\n"));
console.log("\nRegenerate with:  npm run db:types");
process.exit(strict ? 1 : 0);
