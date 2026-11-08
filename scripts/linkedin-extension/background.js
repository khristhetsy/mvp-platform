// iCapOS LinkedIn Connect: background worker. iCapOS decides who to invite and when. This file asks
// iCapOS for one person at a time, fills in the invite in the signed in LinkedIn tab, and reports back.
// It never reads or sends your LinkedIn password, and it stops on any LinkedIn warning.
const ALARM = "icapos-linkedin-tick";
const LEASE_GUARD_MS = 10 * 60_000;

async function setStatus(status, extra = {}) {
  await chrome.storage.local.set({ status, statusAt: Date.now(), ...extra });
}

async function api(s, path, body) {
  const res = await fetch(`${s.base}/api/linkedin/worker/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${s.key}` },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("iCapOS no longer accepts this connection. Press Connect again.");
  if (!res.ok) throw new Error(`iCapOS answered ${res.status}`);
  return res.json();
}

function ensureAlarm() {
  chrome.alarms.create(ALARM, { periodInMinutes: 1 });
}

chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);
chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) void tick(); });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.kind !== "pair") return false;
  // Only the iCapOS admin page content script may pair.
  const ok = sender.id === chrome.runtime.id && typeof msg.base === "string" && typeof msg.key === "string" && /^lis_[0-9a-f]{48}$/.test(msg.key) && /^https:\/\/([a-z0-9-]+\.)*icapos\.com$/.test(msg.base);
  if (!ok) { sendResponse({ ok: false }); return false; }
  chrome.storage.local.set({ base: msg.base, key: msg.key, nextAt: 0, busyUntil: 0 }).then(async () => {
    ensureAlarm();
    await setStatus("Connected. Checking for the next invite.");
    sendResponse({ ok: true });
    void tick();
  });
  return true;
});

function waitForLoad(tabId, timeoutMs = 45_000) {
  return new Promise((resolve) => {
    const t = setTimeout(done, timeoutMs);
    function done() { clearTimeout(t); chrome.tabs.onUpdated.removeListener(on); resolve(); }
    function on(id, info) { if (id === tabId && info.status === "complete") done(); }
    chrome.tabs.onUpdated.addListener(on);
    chrome.tabs.get(tabId).then((tab) => { if (tab.status === "complete") done(); }).catch(done);
  });
}

async function tick() {
  const s = await chrome.storage.local.get(["base", "key", "live", "nextAt", "busyUntil"]);
  if (!s.base || !s.key) return;
  const now = Date.now();
  if (s.busyUntil && now < s.busyUntil) return;
  if (s.nextAt && now < s.nextAt) return;
  await chrome.storage.local.set({ busyUntil: now + LEASE_GUARD_MS });
  try {
    await runOnce(s, !s.live);
  } catch (e) {
    await setStatus(String(e?.message ?? e).slice(0, 160), { nextAt: Date.now() + 5 * 60_000 });
  } finally {
    await chrome.storage.local.set({ busyUntil: 0 });
  }
}

async function runOnce(s, dryRun) {
  const next = await api(s, "next", { dryRun });
  if (next.action === "wait") {
    await setStatus(`Waiting (${next.reason}). Next check in ${next.retryMinutes} min.`, { nextAt: Date.now() + next.retryMinutes * 60_000 });
    return;
  }
  if (next.action === "stop") {
    await setStatus(`iCapOS said stop: ${next.reason}`, { nextAt: Date.now() + 60 * 60_000 });
    return;
  }

  await setStatus(`${dryRun ? "Dry run" : "Inviting"}: ${next.contactName ?? next.slug}`);
  const tab = await chrome.tabs.create({ url: `https://www.linkedin.com/in/${encodeURIComponent(next.slug)}/`, active: false });
  let result;
  try {
    await waitForLoad(tab.id);
    const loaded = await chrome.tabs.get(tab.id);
    if (/\/(login|checkpoint|authwall|uas\/login)/i.test(loaded.url ?? "")) {
      // Not signed in is not a warning. Do not report, the lease runs out by itself.
      await setStatus("Sign in to LinkedIn in Chrome, then this continues by itself.", { nextAt: Date.now() + 10 * 60_000 });
      return;
    }
    const [{ result: r } = {}] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: doInvite, args: [{ text: next.text, dryRun }] });
    result = r ?? { outcome: "failed", detail: "No answer from the LinkedIn page" };
  } catch (e) {
    result = { outcome: "failed", detail: String(e?.message ?? e).slice(0, 200) };
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
  }

  const ack = await api(s, "result", { targetId: next.targetId, outcome: result.outcome, detail: result.detail ?? null }).catch(() => null);
  if (result.outcome === "warning" || ack?.paused) {
    await setStatus("LinkedIn showed a warning. iCapOS paused everything. Leave the account alone and check it in LinkedIn.", { nextAt: Date.now() + 30 * 60_000 });
    return;
  }
  const gapMin = dryRun ? 1 : 4 + Math.random() * 14;
  await setStatus(`Last: ${next.contactName ?? next.slug}, ${result.outcome}.`, { nextAt: Date.now() + gapMin * 60_000 });
}

// Runs inside the LinkedIn profile page. Must be self contained.
async function doInvite({ text, dryRun }) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const WARN_URL = /\/(checkpoint|challenge|uas\/login|authwall|login)/i;
  const WARN_TEXT = /(weekly invitation limit|reached the weekly|unusual activity|verify (that )?you('| a)re (not )?a (robot|human)|restricted|temporarily (limited|restricted)|security verification)/i;
  const warning = () => {
    if (WARN_URL.test(location.pathname)) return `Page moved to ${location.pathname}`;
    const m = WARN_TEXT.exec(document.body?.innerText ?? "");
    return m ? `LinkedIn said: ${m[0]}` : null;
  };
  const label = (el) => `${el.getAttribute("aria-label") ?? ""} ${el.textContent ?? ""}`.replace(/\s+/g, " ").trim();
  const find = (root, re, sel = "button, a, [role=button], [role=menuitem], div[role=button]") =>
    [...root.querySelectorAll(sel)].find((el) => re.test(label(el)) && el.offsetParent !== null);

  await sleep(2500 + Math.random() * 2500);
  let w = warning();
  if (w) return { outcome: "warning", detail: w };
  if (/page isn.?t available|profile is not available/i.test(document.title)) return { outcome: "not_found", detail: "Profile not found" };

  const top = document.querySelector("main section") ?? document.body;
  const CONNECT = /^(connect$|invite .* to connect)/i;
  let connect = find(top, CONNECT);
  if (!connect) {
    const more = find(top, /^more( actions)?$/i);
    if (more) { more.click(); await sleep(700); connect = find(document, CONNECT); }
  }
  if (!connect) {
    if (find(top, /^message$/i)) return { outcome: "already_connected", detail: "No Connect button, Message is shown" };
    return { outcome: "failed", detail: "Could not find a Connect button" };
  }
  connect.click();
  await sleep(1200 + Math.random() * 800);

  const dialog = document.querySelector("[role=dialog]") ?? document;
  const addNote = find(dialog, /add a note/i);
  if (!addNote) return { outcome: "failed", detail: "Invite box did not offer Add a note" };
  addNote.click();
  await sleep(800);

  const box = dialog.querySelector("textarea");
  if (!box) return { outcome: "failed", detail: "Note box not found" };
  box.focus();
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
  let typed = "";
  for (const ch of text) {
    typed += ch;
    setter.call(box, typed);
    box.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(35 + Math.random() * 45);
  }
  await sleep(900);
  w = warning();
  if (w) return { outcome: "warning", detail: w };

  if (dryRun) {
    const dismiss = find(document, /^(dismiss|close)$/i);
    if (dismiss) { dismiss.click(); await sleep(600); }
    const discard = find(document, /^discard$/i);
    if (discard) discard.click();
    return { outcome: "dry_run", detail: "Note filled in, not sent" };
  }

  const send = find(dialog, /^(send( invitation)?|send now)$/i);
  if (!send) return { outcome: "failed", detail: "Send button not found" };
  send.click();
  await sleep(2500);
  w = warning();
  if (w) return { outcome: "warning", detail: w };
  return { outcome: "sent", detail: null };
}
