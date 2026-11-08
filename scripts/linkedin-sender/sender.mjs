// iCapOS LinkedIn sender. Runs on the account owner's own computer, in a visible Chrome window.
//
//   cd scripts/linkedin-sender && npm install
//   ICAPOS_URL=https://your-icapos-domain ICAPOS_SENDER_KEY=lis_... npm start
//
// It starts in DRY RUN: it opens the profile, fills in the invite note, then closes the box
// without sending. Set DRY_RUN=false to really send.
//
// What it does not do: it never sees your LinkedIn password (you sign in yourself in the
// window), it does not disguise the browser, and it does not decide how many to send. iCapOS
// decides that and answers one person at a time. On anything unexpected it stops and reports.
import { chromium } from "playwright";
import { homedir } from "node:os";
import { join } from "node:path";

const BASE = (process.env.ICAPOS_URL ?? "").replace(/\/+$/, "");
const KEY = process.env.ICAPOS_SENDER_KEY ?? "";
const DRY_RUN = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";
const PROFILE_DIR = process.env.SENDER_PROFILE_DIR ?? join(homedir(), ".icapos-linkedin-profile");

if (!BASE || !KEY) {
  console.error("Set ICAPOS_URL and ICAPOS_SENDER_KEY first. Make the key in iCapOS: LinkedIn, Settings, Sender.");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const minutes = (m) => m * 60_000;
const log = (...a) => console.log(new Date().toLocaleTimeString(), ...a);

async function api(path, body) {
  const res = await fetch(`${BASE}/api/linkedin/worker/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("iCapOS does not accept this sender key. Make a new one in Settings.");
  if (!res.ok) throw new Error(`iCapOS answered ${res.status}`);
  return res.json();
}

const WARNING_URL = /\/(checkpoint|challenge|uas\/login|authwall|login)/i;
const WARNING_TEXT = /(weekly invitation limit|reached the weekly|unusual activity|verify (that )?you('| a)re (not )?a (robot|human)|restricted|temporarily (limited|restricted)|security verification)/i;

async function warningOn(page) {
  if (WARNING_URL.test(page.url())) return `Page moved to ${new URL(page.url()).pathname}`;
  const text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
  const m = WARNING_TEXT.exec(text);
  return m ? `LinkedIn said: ${m[0]}` : null;
}

async function waitForSignIn(page) {
  await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
  if (!/\/feed/.test(page.url())) {
    log("Sign in to LinkedIn in the window that opened. The sender continues by itself.");
    await page.waitForURL(/linkedin\.com\/feed/, { timeout: 15 * 60_000 });
  }
  log("Signed in.");
}

// One invite. Returns { outcome, detail }.
async function doInvite(page, job) {
  await page.goto(`https://www.linkedin.com/in/${encodeURIComponent(job.slug)}/`, { waitUntil: "domcontentloaded" });
  await sleep(2500 + Math.random() * 2500);
  const warn = await warningOn(page);
  if (warn) return { outcome: "warning", detail: warn };
  if (/page isn.?t available|profile is not available/i.test(await page.title())) return { outcome: "not_found", detail: "Profile not found" };

  const top = page.locator("main section").first();
  if (await top.getByRole("button", { name: /^message$/i }).count() && !(await top.getByRole("button", { name: /^connect$/i }).count())) {
    const more0 = top.getByRole("button", { name: /^more/i }).first();
    if (await more0.count()) { await more0.click(); await sleep(600); }
    if (!(await page.getByRole("menuitem", { name: /connect/i }).count()) && !(await top.getByRole("button", { name: /^connect$/i }).count())) {
      return { outcome: "already_connected", detail: "No Connect button, Message is shown" };
    }
  }

  let connect = top.getByRole("button", { name: /^connect$/i }).first();
  if (!(await connect.count())) {
    const more = top.getByRole("button", { name: /^more/i }).first();
    if (await more.count()) { await more.click(); await sleep(600); }
    connect = page.getByRole("menuitem", { name: /connect/i }).first();
  }
  if (!(await connect.count())) return { outcome: "failed", detail: "Could not find a Connect button" };
  await connect.click();
  await sleep(1200 + Math.random() * 800);

  const dialog = page.getByRole("dialog").first();
  const addNote = dialog.getByRole("button", { name: /add a note/i });
  if (!(await addNote.count())) return { outcome: "failed", detail: "Invite box did not offer Add a note" };
  await addNote.click();
  await sleep(700);

  const box = dialog.locator("textarea").first();
  if (!(await box.count())) return { outcome: "failed", detail: "Note box not found" };
  await box.click();
  await page.keyboard.type(job.text, { delay: 35 + Math.random() * 45 });
  await sleep(900);

  const afterWarn = await warningOn(page);
  if (afterWarn) return { outcome: "warning", detail: afterWarn };

  if (DRY_RUN) {
    await page.keyboard.press("Escape");
    await sleep(500);
    const discard = page.getByRole("button", { name: /discard|dismiss/i }).first();
    if (await discard.count()) await discard.click().catch(() => {});
    return { outcome: "dry_run", detail: "Note filled in, not sent" };
  }

  const send = dialog.getByRole("button", { name: /^send( invitation)?$/i }).first();
  if (!(await send.count())) return { outcome: "failed", detail: "Send button not found" };
  await send.click();
  await sleep(2500);
  const finalWarn = await warningOn(page);
  if (finalWarn) return { outcome: "warning", detail: finalWarn };
  return { outcome: "sent", detail: null };
}

async function main() {
  log(DRY_RUN ? "DRY RUN: invites are filled in but never sent." : "LIVE: invites will be sent.");
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: "chrome", headless: false, viewport: null, chromiumSandbox: true });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await waitForSignIn(page);

  for (;;) {
    let next;
    try { next = await api("next", { dryRun: DRY_RUN }); }
    catch (e) { log("Could not reach iCapOS:", e.message); await sleep(minutes(5)); continue; }

    if (next.action === "wait") {
      log(`Waiting ${next.retryMinutes} min (${next.reason}).`);
      await sleep(minutes(next.retryMinutes));
      continue;
    }
    if (next.action === "stop") { log("iCapOS said stop:", next.reason); break; }

    log(`${DRY_RUN ? "Dry run" : "Inviting"}: ${next.contactName ?? next.slug}`);
    let result;
    try { result = await doInvite(page, next); }
    catch (e) { result = { outcome: "failed", detail: String(e.message ?? e).slice(0, 200) }; }
    log("Result:", result.outcome, result.detail ?? "");
    const ack = await api("result", { targetId: next.targetId, outcome: result.outcome, detail: result.detail }).catch((e) => { log("Could not report:", e.message); return null; });

    if (result.outcome === "warning" || ack?.paused) {
      log("LinkedIn showed a warning. Everything is paused in iCapOS. Leave the account alone and look at it in LinkedIn.");
      break;
    }
    // Random gap between actions. A dry run only needs a short pause.
    await sleep(DRY_RUN ? 15_000 : minutes(4 + Math.random() * 14));
  }
  await ctx.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
