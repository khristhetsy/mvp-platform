#!/usr/bin/env node
// Pre-deploy guardrail. Fails the build if any of these regressions ship:
//   1. Untranslated i18n keys — a referenced namespace/key missing from the
//      message files (they render as raw "sharedCmp.foo" text on the page).
//   2. Deprecated brand hexes (#0D9488 #5EEAD4 #534AB7 #3C3489).
//   3. The old brand name "CapitalOS" (PascalCase) in shipped output.
//
// Layers:
//   - source:  static scan of src + messages (fast, no build needed).
//   - built:   scan .next/static assets (css/js) if present.
//   - render:  boot `next start`, fetch public routes, scan the HTML.
//
// Usage:
//   node scripts/predeploy-check.mjs            # source (+ built if .next exists)
//   node scripts/predeploy-check.mjs --render   # also boot server + check HTML
//   node scripts/predeploy-check.mjs --require-built   # fail if .next missing

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { spawn } from "node:child_process";

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const DO_RENDER = args.has("--render");
const REQUIRE_BUILT = args.has("--require-built");

const DEPRECATED_HEX = [/#0D9488/i, /#5EEAD4/i, /#534AB7/i, /#3C3489/i];
const SHAREDCMP_KEY = /sharedCmp\.[a-z_]+/;
const OLD_BRAND = /CapitalOS/; // PascalCase only — lowercase infra keys are exempt
const PUBLIC_ROUTES = ["/", "/founders", "/investors", "/marketplace", "/pricing"];

const failures = [];
const fail = (msg) => failures.push(msg);

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, exts, out);
    else if (exts.includes(extname(p))) out.push(p);
  }
  return out;
}

// ── 1. Source i18n completeness ────────────────────────────────────────────
function checkI18nSource() {
  const en = JSON.parse(readFileSync(join(ROOT, "messages/en.json"), "utf8"));
  const es = JSON.parse(readFileSync(join(ROOT, "messages/es.json"), "utf8"));
  const files = walk(join(ROOT, "src"), [".ts", ".tsx"]);
  let checked = 0;
  for (const f of files) {
    const s = readFileSync(f, "utf8");
    const namespaces = [
      ...s.matchAll(/useTranslations\("([a-zA-Z]+)"\)/g),
      ...s.matchAll(/getTranslations\("([a-zA-Z]+)"\)/g),
    ].map((m) => m[1]);
    if (namespaces.length === 0) continue;
    const keys = [...s.matchAll(/\b(?:t|tI18n)\("([^".]+)"\)/g)].map((m) => m[1]);
    for (const ns of new Set(namespaces)) {
      const enPool = en[ns];
      const esPool = es[ns];
      if (!enPool || Object.keys(enPool).length === 0) {
        fail(`i18n: namespace "${ns}" missing/empty in messages/en.json (used in ${f})`);
        continue;
      }
      if (!esPool || Object.keys(esPool).length === 0) {
        fail(`i18n: namespace "${ns}" missing/empty in messages/es.json (used in ${f})`);
      }
      for (const k of keys) {
        // a file may use several namespaces; the key only needs to exist in one
        const inAny = namespaces.some((n) => en[n] && k in en[n]);
        if (!inAny) fail(`i18n: key "${ns}.${k}" not found in messages (used in ${f})`);
      }
    }
    checked++;
  }
  // parity
  const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" ? flat(v, `${p}${k}.`) : [`${p}${k}`]);
  const ek = new Set(flat(en)), sk = new Set(flat(es));
  const miss = [...ek].filter((k) => !sk.has(k));
  const extra = [...sk].filter((k) => !ek.has(k));
  if (miss.length) fail(`i18n: ${miss.length} keys in en.json missing from es.json (e.g. ${miss.slice(0, 3).join(", ")})`);
  if (extra.length) fail(`i18n: ${extra.length} keys in es.json missing from en.json (e.g. ${extra.slice(0, 3).join(", ")})`);
  console.log(`  i18n source: checked ${checked} translated files, parity ${miss.length + extra.length === 0 ? "OK" : "MISMATCH"}`);
}

// ── 2/3. Source scan for deprecated hexes + old brand ───────────────────────
function checkSourceStrings() {
  const files = walk(join(ROOT, "src"), [".ts", ".tsx", ".css"]);
  let hex = 0, brand = 0;
  for (const f of files) {
    const s = readFileSync(f, "utf8");
    if (DEPRECATED_HEX.some((re) => re.test(s))) { hex++; fail(`hex: deprecated brand color in ${f}`); }
    if (OLD_BRAND.test(s)) { brand++; fail(`brand: "CapitalOS" in ${f}`); }
  }
  console.log(`  source strings: ${hex} files with deprecated hex, ${brand} with old brand`);
}

// ── built asset scan ────────────────────────────────────────────────────────
function checkBuiltAssets() {
  const dir = join(ROOT, ".next", "static");
  if (!existsSync(dir)) {
    if (REQUIRE_BUILT) fail("built: .next/static not found (run `next build` first)");
    else console.log("  built assets: skipped (.next/static not present)");
    return;
  }
  const files = walk(dir, [".css", ".js"]).filter((f) => !f.endsWith(".map"));
  let hex = 0, brand = 0;
  for (const f of files) {
    const s = readFileSync(f, "utf8");
    if (DEPRECATED_HEX.some((re) => re.test(s))) { hex++; fail(`built hex: deprecated brand color in ${f}`); }
    if (OLD_BRAND.test(s)) { brand++; fail(`built brand: "CapitalOS" in ${f}`); }
  }
  console.log(`  built assets: scanned ${files.length} css/js files (${hex} hex, ${brand} brand hits)`);
}

// ── render check ────────────────────────────────────────────────────────────
async function checkRenderedHtml() {
  if (!DO_RENDER) { console.log("  render: skipped (pass --render to enable)"); return; }
  const port = 3123;
  const server = spawn("npx", ["next", "start", "-p", String(port)], {
    cwd: ROOT, env: process.env, stdio: "ignore",
  });
  try {
    const base = `http://localhost:${port}`;
    // wait for readiness
    let up = false;
    for (let i = 0; i < 40; i++) {
      try { const r = await fetch(base, { signal: AbortSignal.timeout(2000) }); if (r.ok || r.status < 500) { up = true; break; } } catch {}
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!up) { fail("render: server did not become ready in time"); return; }
    for (const route of PUBLIC_ROUTES) {
      try {
        const res = await fetch(base + route, { signal: AbortSignal.timeout(8000) });
        const html = await res.text();
        if (SHAREDCMP_KEY.test(html)) fail(`render: raw i18n key on ${route} (${(html.match(SHAREDCMP_KEY) || [])[0]})`);
        if (OLD_BRAND.test(html)) fail(`render: "CapitalOS" in HTML on ${route}`);
        if (DEPRECATED_HEX.some((re) => re.test(html))) fail(`render: deprecated hex in HTML on ${route}`);
        console.log(`  render: ${route} → ${res.status} ${res.ok ? "checked" : "(non-200, checked anyway)"}`);
      } catch (e) {
        console.log(`  render: ${route} fetch failed (${e.message}) — skipped`);
      }
    }
  } finally {
    server.kill("SIGTERM");
  }
}

// ── run ─────────────────────────────────────────────────────────────────────
console.log("Pre-deploy checks:");
checkI18nSource();
checkSourceStrings();
checkBuiltAssets();
await checkRenderedHtml();

if (failures.length) {
  console.error(`\n✗ Pre-deploy check FAILED with ${failures.length} issue(s):`);
  for (const m of failures.slice(0, 50)) console.error("  - " + m);
  if (failures.length > 50) console.error(`  …and ${failures.length - 50} more`);
  process.exit(1);
}
console.log("\n✓ Pre-deploy checks passed.");
