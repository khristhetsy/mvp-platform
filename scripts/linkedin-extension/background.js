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

  if (next.action === "read") {
    await readConnections(s, next);
    return;
  }

  const isMessage = next.action === "message";
  await setStatus(`${dryRun ? "Dry run" : isMessage ? "Messaging" : "Inviting"}: ${next.contactName ?? next.slug}`);
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
    const [{ result: r } = {}] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: isMessage ? doMessage : doInvite, args: [{ text: next.text, dryRun }] });
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
  await setStatus(`Last: ${next.contactName ?? next.slug}, ${result.outcome}${result.outcome === "failed" && result.detail ? ` (${result.detail})` : ""}.`, { nextAt: Date.now() + gapMin * 60_000 });
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
  const getDialog = () => document.querySelector("[role=dialog]") ?? document.querySelector("#interop-outlet")?.shadowRoot?.querySelector("[role=dialog]") ?? null;
  const label = (el) => `${el.getAttribute("aria-label") ?? ""} ${el.textContent ?? ""}`.replace(/\s+/g, " ").trim();
  const find = (root, re, sel = "button, a, [role=button], [role=menuitem], div[role=button]") =>
    [...root.querySelectorAll(sel)].find((el) => re.test(label(el)) && el.offsetParent !== null);

  await sleep(2500 + Math.random() * 2500);
  let w = warning();
  if (w) return { outcome: "warning", detail: w };
  if (/page isn.?t available|profile is not available/i.test(document.title)) return { outcome: "not_found", detail: "Profile not found" };

  let top = document.body;
  const h1 = document.querySelector("h1");
  if (h1) {
    let el = h1;
    for (let i = 0; i < 10 && el.parentElement; i++) {
      el = el.parentElement;
      if (find(el, /^(connect$|invite .* to connect|message$|follow$)/i)) { top = el; break; }
    }
  }
  const CONNECT = /^(connect$|invite .* to connect)/i;
  let connect = find(top, CONNECT);
  if (!connect) {
    const more = find(top, /^more( actions)?$/i);
    if (more) { more.click(); await sleep(700); connect = find(document, CONNECT); }
  }
  if (!connect) {
    if (find(top, /^message$/i)) return { outcome: "already_connected", detail: "No Connect button, Message is shown" };
    const seen = [...top.querySelectorAll("button, a[role=button]")].map(label).filter(Boolean).slice(0, 8).join(" | ");
    return { outcome: "failed", detail: `No Connect button. Saw: ${seen}`.slice(0, 190) };
  }
  connect.click();
  await sleep(1200 + Math.random() * 800);

  const dialog = getDialog() ?? document;
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
    const dRoot = getDialog() ?? document;
    const dismiss = find(dRoot, /^(dismiss|close)$/i) ?? find(document, /^(dismiss|close)$/i);
    if (dismiss) { dismiss.click(); await sleep(600); }
    const discard = find(getDialog() ?? document, /^discard$/i) ?? find(document, /^discard$/i);
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

// Runs inside the LinkedIn profile page of someone you are already connected with. Must be self contained.
// It opens the normal message box. It never clicks Connect: a person who is not a connection is reported back.
async function doMessage({ text, dryRun }) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const WARN_URL = /\/(checkpoint|challenge|uas\/login|authwall|login)/i;
  const WARN_TEXT = /(unusual activity|verify (that )?you('| a)re (not )?a (robot|human)|restricted|temporarily (limited|restricted)|security verification)/i;
  const warning = () => {
    if (WARN_URL.test(location.pathname)) return `Page moved to ${location.pathname}`;
    const m = WARN_TEXT.exec(document.body?.innerText ?? "");
    return m ? `LinkedIn said: ${m[0]}` : null;
  };
  const roots = () => [document, document.querySelector("#interop-outlet")?.shadowRoot].filter(Boolean);
  const label = (el) => `${el.getAttribute("aria-label") ?? ""} ${el.textContent ?? ""}`.replace(/\s+/g, " ").trim();
  const find = (root, re, sel = "button, a, [role=button], [role=menuitem], div[role=button]") =>
    [...root.querySelectorAll(sel)].find((el) => re.test(label(el)) && el.offsetParent !== null);
  const findAny = (re) => { for (const r of roots()) { const el = find(r, re); if (el) return el; } return null; };
  const waitFor = async (fn, ms) => { const end = Date.now() + ms; while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(400); } return fn(); };

  await sleep(2500 + Math.random() * 2500);
  let w = warning();
  if (w) return { outcome: "warning", detail: w };
  if (/page isn.?t available|profile is not available/i.test(document.title)) return { outcome: "not_found", detail: "Profile not found" };

  // The profile card must have drawn before anything is searched.
  const h1 = await waitFor(() => document.querySelector("h1"), 15_000);
  if (!h1) return { outcome: "failed", detail: "Profile did not finish loading" };
  const MESSAGE = /^message\b/i;
  const CONNECT = /^(connect$|invite .* to connect)/i;
  let top = document.body;
  let el = h1;
  for (let i = 0; i < 10 && el.parentElement; i++) {
    el = el.parentElement;
    if (find(el, /^(connect$|invite .* to connect|message\b|follow$)/i)) { top = el; break; }
  }
  await sleep(600 + Math.random() * 600);

  const msgBtn = find(top, MESSAGE);
  if (!msgBtn) {
    if (find(top, CONNECT)) return { outcome: "not_connected", detail: "Connect is shown, not Message" };
    const seen = [...top.querySelectorAll("button, a[role=button]")].map(label).filter(Boolean).slice(0, 8).join(" | ");
    return { outcome: "failed", detail: `No Message button. Saw: ${seen}`.slice(0, 190) };
  }
  msgBtn.click();

  const getBox = () => { for (const r of roots()) { const b = [...r.querySelectorAll("[contenteditable=true][role=textbox], div.msg-form__contenteditable, textarea")].find((x) => x.offsetParent !== null); if (b) return b; } return null; };
  const box = await waitFor(getBox, 12_000);
  if (!box) return { outcome: "failed", detail: "Message box did not open" };
  box.focus();
  await sleep(500);

  // Typed in short bursts so the editor sees real input events.
  for (const part of text.split(/(\n)/)) {
    if (part === "\n") { document.execCommand("insertParagraph"); await sleep(120); continue; }
    for (const ch of part) {
      if (box.tagName === "TEXTAREA") {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
        setter.call(box, (box.value ?? "") + ch);
        box.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        document.execCommand("insertText", false, ch);
      }
      await sleep(25 + Math.random() * 45);
    }
  }
  await sleep(900);
  w = warning();
  if (w) return { outcome: "warning", detail: w };
  const typed = (box.tagName === "TEXTAREA" ? box.value : box.innerText ?? "").trim();
  if (typed.length < Math.min(20, text.length)) return { outcome: "failed", detail: "Message text did not go into the box" };

  const closeBox = async () => {
    const close = findAny(/^close your (draft )?conversation/i) ?? findAny(/^close$/i);
    if (close) { close.click(); await sleep(700); }
    const discard = findAny(/^(discard|discard draft)$/i);
    if (discard) { discard.click(); await sleep(500); }
  };

  if (dryRun) {
    await closeBox();
    return { outcome: "dry_run", detail: "Message typed, not sent" };
  }

  const send = findAny(/^send$/i) ?? [...document.querySelectorAll("button[type=submit]")].find((b) => b.offsetParent !== null && !b.disabled);
  if (!send || send.disabled) return { outcome: "failed", detail: "Send button not found" };
  send.click();
  await sleep(2500);
  w = warning();
  if (w) return { outcome: "warning", detail: w };
  const left = (box.tagName === "TEXTAREA" ? box.value : box.innerText ?? "").trim();
  // Not being sure is not a failure: a retry could message the person twice. Stop and let the owner look.
  if (left.length > 0) return { outcome: "warning", detail: "Could not confirm the message was sent, the box still has text" };
  await closeBox();
  return { outcome: "message_sent", detail: null };
}

// Reads one page of YOUR OWN LinkedIn 1st connections (LinkedIn's connection search, same as typing in its search box).
// The first page sets the filters through LinkedIn's filter panel and saves LinkedIn's own address for them; later
// pages open that address with a page number. If a filter cannot be set, nothing is reported as read.
async function readConnections(s, next) {
  const needPanel = !!(next.filters.industry || next.filters.locations || next.filters.currentCompany || next.filters.pastCompany || next.filters.school || next.filters.profileLanguage) || (next.filters.sort && next.filters.sort !== "recent");
  const saved = typeof next.searchUrl === "string" && /^https:\/\/www\.linkedin\.com\/search\/results\/people/.test(next.searchUrl) ? next.searchUrl : null;
  let url;
  if (saved) {
    const u = new URL(saved);
    u.searchParams.set("page", String(next.page));
    url = u.toString();
  } else {
    const u = new URL("https://www.linkedin.com/search/results/people/");
    u.searchParams.set("network", JSON.stringify(["F"]));
    u.searchParams.set("origin", "FACETED_SEARCH");
    if (next.filters.name) u.searchParams.set("keywords", next.filters.name);
    if (next.page > 1) u.searchParams.set("page", String(next.page));
    url = u.toString();
  }
  await setStatus(`Reading your connections, page ${next.page}`);
  const tab = await chrome.tabs.create({ url, active: false });
  let result;
  try {
    await waitForLoad(tab.id);
    const loaded = await chrome.tabs.get(tab.id);
    if (/\/(login|checkpoint|authwall|uas\/login)/i.test(loaded.url ?? "")) {
      await setStatus("Sign in to LinkedIn in Chrome, then this continues by itself.", { nextAt: Date.now() + 10 * 60_000 });
      return;
    }
    const [{ result: r } = {}] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: doRead, args: [{ filters: next.filters, needPanel: needPanel && !saved }] });
    result = r ?? { failed: true, detail: "No answer from the LinkedIn page" };
  } catch (e) {
    result = { failed: true, detail: String(e?.message ?? e).slice(0, 200) };
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
  }
  const ack = await api(s, "connections", {
    campaignId: next.campaignId, page: next.page, people: result.people ?? [], searchUrl: result.searchUrl ?? null,
    filtersApplied: result.filtersApplied === true, failed: result.failed === true, warning: result.warning === true, detail: result.detail ?? null,
  }).catch(() => null);
  if (result.warning || ack?.paused) {
    await setStatus("LinkedIn showed a warning. iCapOS paused everything. Leave the account alone and check it in LinkedIn.", { nextAt: Date.now() + 30 * 60_000 });
    return;
  }
  const detail = result.failed || !result.filtersApplied ? ` failed (${result.detail ?? "unknown"})` : `: ${(result.people ?? []).length} people, ${ack?.added ?? 0} new`;
  await setStatus(`Read page ${next.page}${detail}.`, { nextAt: Date.now() + (10 + Math.random() * 10) * 60_000 });
}

// Runs inside the LinkedIn search page. Must be self contained.
async function doRead({ filters, needPanel }) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const WARN_URL = /\/(checkpoint|challenge|uas\/login|authwall|login)/i;
  const WARN_TEXT = /(unusual activity|verify (that )?you('| a)re (not )?a (robot|human)|temporarily (limited|restricted)|security verification)/i;
  const LIMIT_TEXT = /(monthly search limit|reached the (commercial use|search) limit)/i;
  const warning = () => {
    if (WARN_URL.test(location.pathname)) return `Page moved to ${location.pathname}`;
    const m = WARN_TEXT.exec(document.body?.innerText ?? "");
    return m ? `LinkedIn said: ${m[0]}` : null;
  };
  const label = (el) => `${el.getAttribute("aria-label") ?? ""} ${el.textContent ?? ""}`.replace(/\s+/g, " ").trim();
  const visible = (el) => el.offsetParent !== null;
  const find = (root, re, sel = "button, a, [role=button], label, [role=option], li, span") => [...root.querySelectorAll(sel)].find((el) => re.test(label(el)) && visible(el));
  const waitFor = async (fn, ms) => { const end = Date.now() + ms; while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(400); } return fn(); };
  const fail = (detail) => ({ failed: true, filtersApplied: false, detail: String(detail).slice(0, 200) });
  const rx = (t) => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  await sleep(2500 + Math.random() * 2500);
  const w0 = warning();
  if (w0) return { warning: true, filtersApplied: false, detail: w0 };
  if (LIMIT_TEXT.test(document.body?.innerText ?? "")) return fail("LinkedIn says the monthly search limit is reached");

  if (needPanel) {
    // Open the filter panel, fill each filter by typing and picking LinkedIn's own suggestion, then show results.
    const all = await waitFor(() => find(document, /^all filters$/i, "button, [role=button]"), 15_000);
    if (!all) return fail("All filters button not found");
    all.click();
    const panel = await waitFor(() => document.querySelector("[role=dialog]"), 8_000);
    if (!panel) return fail("Filter panel did not open");
    await sleep(900);

    const facets = [["Industry", filters.industry], ["Locations", filters.locations], ["Current company", filters.currentCompany], ["Past company", filters.pastCompany], ["School", filters.school], ["Profile language", filters.profileLanguage]];
    for (const [name, value] of facets) {
      if (!value) continue;
      const heading = [...panel.querySelectorAll("h3, h4, legend, span, div")].find((el) => visible(el) && el.children.length === 0 && new RegExp(`^${name}$`, "i").test((el.textContent ?? "").trim()));
      if (!heading) return fail(`${name} filter not found`);
      let section = heading;
      for (let i = 0; i < 6 && section.parentElement; i++) { section = section.parentElement; if (section.querySelector("input, button")) break; }
      const add = find(section, new RegExp(`^(add a|\\+ add)`, "i"), "button, [role=button]");
      if (add) { add.click(); await sleep(600); }
      const input = [...section.querySelectorAll("input[type=text], input[type=search], input:not([type])")].find(visible);
      if (input) {
        input.focus();
        for (const ch of value) { document.execCommand("insertText", false, ch); await sleep(40 + Math.random() * 50); }
        await sleep(1500);
        const opt = [...document.querySelectorAll("[role=option], [role=listbox] li")].find((el) => visible(el) && rx(value.slice(0, Math.min(value.length, 12))).test(label(el)));
        if (!opt) return fail(`LinkedIn has no ${name} match for ${value}`);
        opt.click();
      } else {
        // Short lists such as language are shown as ticks, not a box.
        const tick = find(section, rx(value), "label, button, [role=checkbox], span");
        if (!tick) return fail(`LinkedIn has no ${name} option for ${value}`);
        tick.click();
      }
      await sleep(700 + Math.random() * 500);
    }
    if (filters.sort && filters.sort !== "recent") {
      const sortName = filters.sort === "first" ? "First name" : "Last name";
      const opt = find(panel, rx(sortName), "label, button, [role=radio], span");
      if (!opt) return fail(`Sort by ${sortName} not found`);
      opt.click();
      await sleep(600);
    }
    const show = find(panel, /^show (\d+\+? )?results$/i, "button, [role=button]");
    if (!show) return fail("Show results button not found");
    show.click();
    await sleep(4000);
    if (!/network=/.test(location.search) || !/F/.test(decodeURIComponent(location.search))) return fail("Results are not limited to 1st connections");
  }

  const w1 = warning();
  if (w1) return { warning: true, filtersApplied: false, detail: w1 };
  if (LIMIT_TEXT.test(document.body?.innerText ?? "")) return fail("LinkedIn says the monthly search limit is reached");

  const linksNow = () => [...document.querySelectorAll("a[href*='/in/']")].filter(visible);
  // The line under the name in a result card, for example "Founder at Acme". Null when the card cannot be read.
  const headlineOf = (a, name) => {
    let card = a.closest("li");
    for (let el = a, i = 0; !card && el && i < 5; i++, el = el.parentElement) if ((el.innerText ?? "").length > name.length + 10) card = el;
    if (!card) return null;
    const skip = /^(message|connect|follow|pending|view|send|save|\u2022|·|1st|2nd|3rd\+?|status is)/i;
    for (const line of (card.innerText ?? "").split("\n").map((l) => l.replace(/\s+/g, " ").trim())) {
      if (!line || line.length < 3 || line.includes(name) || skip.test(line)) continue;
      return line.slice(0, 200);
    }
    return null;
  };
  await waitFor(() => linksNow().length > 0 || /no results found/i.test(document.body?.innerText ?? ""), 15_000);
  for (let i = 0; i < 4; i++) { window.scrollBy(0, Math.max(400, window.innerHeight * 0.8)); await sleep(700 + Math.random() * 500); }

  const people = new Map();
  for (const a of linksNow()) {
    const m = /\/in\/([A-Za-z0-9_%-]+)/.exec(a.getAttribute("href") ?? "");
    if (!m) continue;
    const slug = decodeURIComponent(m[1]).toLowerCase();
    const raw = (a.querySelector("span[aria-hidden=true]")?.textContent ?? a.textContent ?? "").replace(/\s+/g, " ").trim();
    const name = raw.replace(/^view\s+/i, "").replace(/['\u2019]s profile.*$/i, "").replace(/\s*[\u2022\u00b7]\s*(1st|2nd|3rd).*$/i, "").replace(/\s+(1st|2nd|3rd)\+?$/i, "").trim();
    if (!name || /^linkedin member$/i.test(name)) continue;
    if (!people.has(slug)) people.set(slug, { name: name.slice(0, 120), headline: headlineOf(a, name) });
  }
  if (people.size === 0) {
    if (/no results found/i.test(document.body?.innerText ?? "")) return { filtersApplied: true, people: [], searchUrl: location.href };
    return fail("Results did not load or the page looks different");
  }
  return { filtersApplied: true, people: [...people].map(([slug, v]) => ({ slug, name: v.name, headline: v.headline })), searchUrl: location.href };
}
