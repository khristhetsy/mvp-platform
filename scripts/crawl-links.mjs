#!/usr/bin/env node
// Runtime crawler: loads every static route in a real browser as a signed-in
// user and reports pages that 404/500, bounce to sign-in (a role/guard problem),
// throw console errors, or contain anchors pointing at non-existent routes.
// Catches behavioral breakage the static auditor can't. Run: `npm run audit:crawl`.
//
// Setup:
//   npm i -D playwright && npx playwright install chromium
//   # sign in once and save the session so the crawl is authenticated:
//   #   (log in manually, then export storageState to auth-state.json)
//   BASE_URL=http://localhost:3000 \
//   STORAGE_STATE=auth-state.json \
//   SAMPLE_ID=<a real company/id for [param] routes> \
//   npm run audit:crawl
//
// It only VISITS pages (and checks their links) — it never clicks action
// buttons, so it's side-effect free and safe against staging/prod-like data.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = path.join(ROOT, "src/app");
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const STORAGE_STATE = process.env.STORAGE_STATE || "";
const SAMPLE_ID = process.env.SAMPLE_ID || "";

function walk(dir, test, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      walk(p, test, acc);
    } else if (test(p)) acc.push(p);
  }
  return acc;
}

// Page routes only (skip API and route.ts). Substitute [param] with SAMPLE_ID.
function toPath(file) {
  let rel = file.slice(APP.length).replace(/\/page\.(t|j)sx?$/, "");
  rel = rel.split("/").filter((s) => !/^\(.*\)$/.test(s)).join("/");
  return rel === "" ? "/" : rel;
}
const allPages = walk(APP, (p) => /\/page\.(t|j)sx?$/.test(p)).map(toPath);
const routeMatchers = allPages.map((r) => ({
  rel: r,
  re: new RegExp("^" + r.replace(/\[\.\.\..+?\]/g, ".*").replace(/\[.+?\]/g, "[^/]+").replace(/\//g, "\\/") + "\\/?$"),
}));

const visitable = allPages
  .filter((r) => !r.startsWith("/api"))
  .map((r) => (SAMPLE_ID ? r.replace(/\[[^/]+\]/g, SAMPLE_ID) : r))
  .filter((r) => !r.includes("[")); // skip param routes when no SAMPLE_ID given

function isKnownRoute(pathname) {
  return routeMatchers.some((m) => m.re.test(pathname));
}

const playwright = await import("playwright").catch(() => null);
if (!playwright) {
  console.error("Playwright not installed. Run:  npm i -D playwright && npx playwright install chromium");
  process.exit(2);
}

const browser = await playwright.chromium.launch();
const context = await browser.newContext(
  STORAGE_STATE && fs.existsSync(STORAGE_STATE) ? { storageState: STORAGE_STATE } : {},
);
const page = await context.newPage();

const problems = [];
for (const route of visitable) {
  const url = BASE_URL + route;
  const consoleErrors = [];
  page.removeAllListeners("console");
  page.on("console", (msg) => msg.type() === "error" && consoleErrors.push(msg.text().slice(0, 140)));

  let status = 0;
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    status = resp?.status() ?? 0;
  } catch (e) {
    problems.push(`${route}  LOAD ERROR: ${String(e).slice(0, 100)}`);
    continue;
  }
  const landed = new URL(page.url()).pathname;

  if (status >= 400) problems.push(`${route}  HTTP ${status}`);
  else if (/\/auth\/sign-in/.test(landed) && !/\/auth\//.test(route))
    problems.push(`${route}  bounced to sign-in (auth/guard) -> ${landed}`);

  // Check in-page internal anchors resolve to a real route.
  const hrefs = await page.$$eval("a[href^='/']", (as) => as.map((a) => a.getAttribute("href")));
  for (const h of [...new Set(hrefs)]) {
    const p = h.split("?")[0].split("#")[0];
    if (!p.startsWith("/api") && !isKnownRoute(p)) problems.push(`${route}  dead link -> ${h}`);
  }
  if (consoleErrors.length) problems.push(`${route}  console errors: ${consoleErrors.slice(0, 2).join(" | ")}`);
}

await browser.close();

console.log(`Crawled ${visitable.length} routes at ${BASE_URL}\n`);
console.log(`PROBLEMS (${problems.length}):`);
console.log(problems.length ? [...new Set(problems)].join("\n") : "  none");
process.exit(problems.length > 0 ? 1 : 0);
