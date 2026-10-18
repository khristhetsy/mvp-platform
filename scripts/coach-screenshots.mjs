// AI IR Coach Screenshot studio: captures course screens from the running app.
//
// Run it yourself, locally. It signs in as a DEMO founder account (an @myicfos.com address) and
// refuses to run for any other account, so a real founder's data can never end up in a course image.
//
//   npm install -D playwright && npx playwright install chromium     (once)
//   COACH_DEMO_BASE_URL=https://staging.example.com \
//   COACH_DEMO_EMAIL=demo-founder@myicfos.com \
//   COACH_DEMO_PASSWORD='...' \
//   node scripts/coach-screenshots.mjs [--requested] [--only=<step_key>] [--headed]
//
// Supabase settings come from .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY): the
// tier in that file is where images and rows are written. The work list is the coach_screenshots table;
// open Learning, AI IR Coach, Screenshots once so it is filled from the course.
//
// For each step it opens the route, waits for the control (found by data-learning-id), blurs emails,
// phone numbers and amounts, draws a numbered pin on the control, saves a 1280 by 800 PNG, and records
// a content hash so a later change to the screen shows as Stale. A failure is recorded on the row and
// flags the step; it never changes what founders see. Staff approve images in the studio.

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { loadEnvLocalIfNeeded } from "./lib/load-env.mjs";
import { preparePage } from "./lib/coach-screenshots-page.mjs";
import {
  SCREEN,
  capturePath,
  isDemoAccountEmail,
  normalizeForHash,
  rowUpdateAfterCapture,
} from "./lib/coach-screenshots-core.mjs";

loadEnvLocalIfNeeded();

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

function fail(message) {
  console.error(message);
  process.exit(1);
}

const baseUrl = (process.env.COACH_DEMO_BASE_URL ?? "").replace(/\/$/, "");
const email = process.env.COACH_DEMO_EMAIL ?? "";
const password = process.env.COACH_DEMO_PASSWORD ?? "";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!baseUrl || !email || !password) fail("Set COACH_DEMO_BASE_URL, COACH_DEMO_EMAIL and COACH_DEMO_PASSWORD.");
if (!supabaseUrl || !serviceKey) fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env or .env.local.");

// Hard guard: demo accounts only. Checked before a browser is even started.
if (!isDemoAccountEmail(email)) {
  fail(`Refusing to run: ${email} is not a demo account. Course images may only be captured from an @myicfos.com demo founder.`);
}

let playwright;
try {
  playwright = await import("playwright");
} catch {
  fail("Playwright is not installed. Run: npm install -D playwright && npx playwright install chromium");
}

const db = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// The account must exist and be a founder, otherwise there is nothing sensible to capture.
const { data: profile } = await db.from("profiles").select("id, role, email").eq("email", email).maybeSingle();
if (!profile) fail(`No profile found for ${email} in ${new URL(supabaseUrl).host}.`);
if (profile.role !== "founder") fail(`${email} is a ${profile.role} account. Use a demo founder account.`);

let query = db.from("coach_screenshots").select("*").order("course_slug").order("lesson_id").order("step_index");
const only = opt("only");
if (only) query = query.eq("step_key", only);
if (flag("requested")) query = query.not("capture_requested_at", "is", null);
const { data: rows, error: rowsError } = await query;
if (rowsError) fail(`Could not read coach_screenshots: ${rowsError.message}`);
if (!rows?.length) fail("Nothing to capture. Open Learning, AI IR Coach, Screenshots once to fill the list, or check your --only value.");

function appVersion() {
  if (process.env.COACH_APP_VERSION) return process.env.COACH_APP_VERSION;
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
  }
}
const version = appVersion();

console.log(`Writing to ${new URL(supabaseUrl).host}. Capturing ${rows.length} step(s) from ${baseUrl} as ${email}.`);

const browser = await playwright.chromium.launch({ headless: !flag("headed") });
const context = await browser.newContext({ viewport: SCREEN });
const page = await context.newPage();

// Sign in through the normal form, as a person would.
await page.goto(`${baseUrl}/auth/sign-in`, { waitUntil: "domcontentloaded" });
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
await page.click('button[type="submit"]');
try {
  await page.waitForURL((u) => !u.pathname.startsWith("/auth/sign-in"), { timeout: 20000 });
} catch {
  await browser.close();
  fail("Sign in did not complete. Check the demo email and password. No steps were marked as failed.");
}

async function captureOne(row) {
  const response = await page.goto(`${baseUrl}${row.route}`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/auth/sign-in")) return { ok: false, error: "Redirected to sign in. The demo account cannot open this page." };
  if (response && response.status() >= 400) return { ok: false, error: `Page returned ${response.status()}.` };
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);

  if (row.learning_id) {
    try {
      await page.waitForSelector(`[data-learning-id="${row.learning_id}"]`, { timeout: 8000 });
    } catch {
      return { ok: false, error: `Control not found: data-learning-id="${row.learning_id}". The step names "${row.control_label ?? "a control"}", which this screen does not have.` };
    }
  }
  await page.waitForTimeout(600);

  const text = await page.evaluate(() => (document.querySelector("main") ?? document.body).innerText);
  const contentHash = createHash("sha256").update(normalizeForHash(text)).digest("hex");

  const prepared = await preparePage(page, { learningId: row.learning_id, number: row.step_index + 1 });
  if (prepared.missing) return { ok: false, error: `Control not found: data-learning-id="${row.learning_id}".` };
  const png = await page.screenshot({ type: "png" });

  const capturedAt = new Date().toISOString();
  const imagePath = capturePath({ courseSlug: row.course_slug, lessonId: row.lesson_id, stepIndex: row.step_index, capturedAt });
  const { error: uploadError } = await db.storage.from("coach-screenshots").upload(imagePath, png, { contentType: "image/png", upsert: false });
  if (uploadError) return { ok: false, error: `Upload failed: ${uploadError.message}` };
  return { ok: true, imagePath, contentHash, capturedAt, appVersion: version, pinned: prepared.pinned };
}

let captured = 0;
let failed = 0;
for (const row of rows) {
  let result;
  try {
    result = await captureOne(row);
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  const { error: updateError } = await db.from("coach_screenshots").update(rowUpdateAfterCapture(result)).eq("step_key", row.step_key);
  if (updateError) console.error(`  could not save row for ${row.step_key}: ${updateError.message}`);
  if (result.ok) {
    captured += 1;
    console.log(`  captured  ${row.step_key}${result.pinned ? " (pinned)" : " (no pin)"}`);
  } else {
    failed += 1;
    console.log(`  FAILED    ${row.step_key}: ${result.error}`);
  }
}

await browser.close();
console.log(`Done. ${captured} captured, ${failed} failed. Review and approve in Learning, AI IR Coach, Screenshots.`);
