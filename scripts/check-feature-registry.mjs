#!/usr/bin/env node
// Drift protection for the Departments feature registry. Walks src/app/admin for
// page.tsx routes and checks each is covered by a registered feature path prefix.
// A new admin route with no registry entry → exit 1 (wire into CI / pre-push).
//
// Keep REGISTERED in sync with the `features` seed (supabase migration). ALLOWLIST
// holds intentionally-unregistered routes (orphans left Admin-only per Phase 0).

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src/app/admin";

// Registered feature path prefixes (mirror of the features seed).
const REGISTERED = [
  "/admin", "/admin/playbook", "/admin/companies", "/admin/investors", "/admin/actions",
  "/admin/tasks", "/admin/portfolio", "/admin/readiness", "/admin/data-room", "/admin/diligence",
  "/admin/learning", "/admin/events", "/admin/manual", "/admin/analytics", "/admin/reports",
  "/admin/insights", "/admin/funnels", "/admin/compliance", "/admin/audit", "/admin/voice",
  "/admin/inbox", "/admin/calendar", "/admin/signatures", "/admin/users", "/admin/feature-controls",
  "/admin/billing", "/admin/integrations", "/admin/profile", "/admin/crm", "/admin/intro-requests",
  "/admin/deal-rooms", "/admin/spvs", "/admin/matching", "/admin/partner-scores", "/admin/marketing",
  "/admin/sales",
];

// Intentionally unregistered (orphans left Admin-only, and calendar's sibling routes).
const ALLOWLIST = [
  "/admin/dashboard", "/admin/schedule", "/admin/meet",
  "/admin/operations-hub", "/admin/queues", "/admin/automation", "/admin/system-health",
  "/admin/imports", "/admin/beta-operations", "/admin/page-builder-lab",
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry === "page.tsx") out.push(dir);
  }
  return out;
}

function toRoute(dir) {
  return "/" + dir.replace(/^src\/app\//, "").replace(/\/\([^)]+\)/g, "").replace(/\/\[[^\]]+\]/g, "/:id");
}

const routes = [...new Set(walk(ROOT).map(toRoute))];
const covered = (r) => REGISTERED.some((p) => r === p || r.startsWith(p + "/")) || ALLOWLIST.some((p) => r === p || r.startsWith(p + "/"));

const missing = routes.filter((r) => !covered(r));
if (missing.length) {
  console.error("✗ Feature registry drift — these admin routes have no registered feature:");
  for (const m of missing) console.error("   " + m);
  console.error("\nAdd a feature to the migration seed (and REGISTERED here), or add to ALLOWLIST if intentionally Admin-only.");
  process.exit(1);
}
console.log(`✓ Feature registry: ${routes.length} admin routes all covered.`);
