import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};

// A small in-memory stand-in for the Supabase query builder, enough for the sender queries.
function builder(name: string) {
  const rows = () => tables[name] ?? (tables[name] = []);
  const filters: Array<(r: Row) => boolean> = [];
  let mode: "select" | "update" | "insert" = "select";
  let patch: Row = {};
  let head = false;
  let limitN = Infinity;
  let orderBy: { col: string; asc: boolean } | null = null;
  const matched = () => {
    let out = rows().filter((r) => filters.every((f) => f(r)));
    if (orderBy) { const { col, asc } = orderBy; out = [...out].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1)); }
    return out.slice(0, limitN);
  };
  const run = () => {
    if (mode === "update") { const m = matched(); m.forEach((r) => Object.assign(r, patch)); return { data: m, error: null, count: m.length }; }
    if (mode === "insert") { for (const row of (Array.isArray(patch) ? patch : [patch]) as Row[]) rows().push({ id: `n${rows().length}`, ...row }); return { data: [patch], error: null }; }
    const m = matched();
    return { data: head ? null : m, error: null, count: m.length };
  };
  const b: Record<string, unknown> = {
    select: (_c?: string, o?: { head?: boolean }) => { head = !!o?.head; return b; },
    update: (p: Row) => { mode = "update"; patch = p; return b; },
    insert: (p: Row | Row[]) => { mode = "insert"; patch = p as Row; return b; },
    neq: (c: string, v: unknown) => { filters.push((r) => r[c] !== v); return b; },
    eq: (c: string, v: unknown) => { filters.push((r) => r[c] === v); return b; },
    in: (c: string, v: unknown[]) => { filters.push((r) => v.includes(r[c])); return b; },
    gte: (c: string, v: string) => { filters.push((r) => r[c] != null && String(r[c]) >= v); return b; },
    not: (c: string, _op: string, _v: unknown) => { filters.push((r) => r[c] != null); return b; },
    or: (expr: string) => { const lte = expr.split("next_action_at.lte.")[1]; filters.push((r) => r.next_action_at == null || String(r.next_action_at) <= lte); return b; },
    order: (col: string, o: { ascending: boolean }) => { orderBy = { col, asc: o.ascending }; return b; },
    limit: (n: number) => { limitN = n; return b; },
    maybeSingle: async () => ({ data: matched()[0] ?? null, error: null }),
    single: async () => ({ data: matched()[0] ?? null, error: null }),
    then: (res: (v: unknown) => unknown) => Promise.resolve(run()).then(res),
  };
  return b;
}
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({ from: (n: string) => builder(n) }) }));
vi.mock("@/lib/sales/tasks", () => ({ createTask: vi.fn() }));
vi.mock("@/lib/notes-log", () => ({ logCommunication: vi.fn(), toInsertRow: vi.fn() }));

import { nextForSender, recordRead, recordResult, getMatchCheck, pendingMatchCheck, recordMatchCount, requestMatchCheck } from "./worker-store";
import type { LinkedInAccount } from "./store";

const MON_10AM_LA = new Date("2026-11-09T18:00:00Z"); // Monday 10:00 in Los Angeles
const account = (over: Partial<LinkedInAccount> = {}): LinkedInAccount => ({
  id: "a1", owner_id: "u1", label: "Khris", linkedin_slug: null, status: "connected", paused_reason: null, safety_level: "standard",
  custom_daily_cap: null, custom_weekly_cap: null, manual_allowance: 5, high_value_tag: null, warm_up_started_at: "2026-10-01T00:00:00Z",
  timezone: "America/Los_Angeles", sender_key_set: true, worker_last_seen_at: null, send_on_schedule: true, handoff_enabled: true,
  withdraw_pending: true, weekly_summary: true, ...over,
});
const seed = (n = 3) => {
  tables.linkedin_accounts = [account() as unknown as Row];
  tables.linkedin_campaigns = [{ id: "c1", account_id: "a1", status: "ready", approved_at: "2026-11-01", wording_hash: "h", invite_variants: [{ id: "v1", text: "Hi {first_name}, let's connect." }] }];
  tables.linkedin_targets = Array.from({ length: n }, (_, i) => ({ id: `t${i}`, campaign_id: "c1", route: "invite", status: "queued", linkedin_slug: `p${i}`, display_name: `Pat ${i}`, next_action_at: null, invited_at: null, updated_at: "2026-11-01" }));
  tables.linkedin_events = [];
};

describe("nextForSender", () => {
  beforeEach(() => seed());

  it("hands out one invite with the wording filled in and reserves the person", async () => {
    const r = await nextForSender(account(), { dryRun: true, now: MON_10AM_LA });
    expect(r).toMatchObject({ action: "invite", slug: "p0", text: "Hi Pat, let's connect.", variantId: "v1" });
    const again = await nextForSender(account(), { dryRun: true, now: MON_10AM_LA });
    expect(again).toMatchObject({ action: "invite", slug: "p1" }); // p0 is leased, never handed out twice
  });
  it("waits outside working hours", async () => {
    const r = await nextForSender(account(), { dryRun: true, now: new Date("2026-11-09T04:00:00Z") });
    expect(r).toMatchObject({ action: "wait", reason: "outside_hours" });
  });
  it("waits on the weekend", async () => {
    const r = await nextForSender(account(), { dryRun: true, now: new Date("2026-11-14T18:00:00Z") });
    expect(r).toMatchObject({ action: "wait", reason: "outside_hours" });
  });
  it("waits when paused, warned or switched off", async () => {
    expect(await nextForSender(account({ status: "warning" }), { dryRun: false, now: MON_10AM_LA })).toMatchObject({ reason: "paused" });
    expect(await nextForSender(account({ status: "paused" }), { dryRun: false, now: MON_10AM_LA })).toMatchObject({ reason: "paused" });
    expect(await nextForSender(account({ send_on_schedule: false }), { dryRun: false, now: MON_10AM_LA })).toMatchObject({ reason: "switched_off" });
  });
  it("stops at the daily cap", async () => {
    // Standard is 20 a day with 5 kept for manual use, so 15 automatic invites today is the limit.
    for (let i = 0; i < 15; i++) (tables.linkedin_targets[i] ??= { id: `x${i}`, campaign_id: "c1", route: "invite", status: "queued", linkedin_slug: `s${i}` });
    tables.linkedin_targets.slice(0, 15).forEach((t, i) => Object.assign(t, { status: "invited", invited_at: new Date(MON_10AM_LA.getTime() - (60 + i) * 60_000 * 0.1).toISOString() }));
    tables.linkedin_targets.push({ id: "tq", campaign_id: "c1", route: "invite", status: "queued", linkedin_slug: "pq", display_name: "Q", next_action_at: null, invited_at: null, updated_at: "2026-11-02" });
    const r = await nextForSender(account(), { dryRun: true, now: MON_10AM_LA });
    expect(r).toMatchObject({ action: "wait", reason: "daily_cap" });
  });
  it("keeps a gap after the last invite", async () => {
    tables.linkedin_targets[0] = { ...tables.linkedin_targets[0], status: "invited", invited_at: new Date(MON_10AM_LA.getTime() - 60_000).toISOString() };
    expect(await nextForSender(account(), { dryRun: true, now: MON_10AM_LA })).toMatchObject({ reason: "gap" });
  });
  it("only sends from campaigns that are ready or running", async () => {
    tables.linkedin_campaigns[0].status = "paused";
    expect(await nextForSender(account(), { dryRun: true, now: MON_10AM_LA })).toMatchObject({ reason: "nothing_queued" });
  });
  it("fails a person whose invite would not fit, instead of cutting the text", async () => {
    (tables.linkedin_campaigns[0].invite_variants as Array<{ text: string }>)[0].text = "x".repeat(250);
    const r = await nextForSender(account(), { dryRun: true, now: MON_10AM_LA });
    expect(r).toMatchObject({ action: "wait" });
    expect(tables.linkedin_targets.every((t) => t.status === "failed")).toBe(true);
  });
  it("never starts the warm up on a dry run, but does on the first live run", async () => {
    tables.linkedin_accounts[0].warm_up_started_at = null;
    await nextForSender(account({ warm_up_started_at: null, status: "not_connected" }), { dryRun: true, now: MON_10AM_LA });
    expect(tables.linkedin_accounts[0].warm_up_started_at).toBeNull();
    await nextForSender(account({ warm_up_started_at: null, status: "not_connected" }), { dryRun: false, now: MON_10AM_LA });
    expect(tables.linkedin_accounts[0].warm_up_started_at).toBe(MON_10AM_LA.toISOString());
    expect(tables.linkedin_accounts[0].status).toBe("connected");
  });
});

describe("recordResult", () => {
  beforeEach(() => seed(1));

  it("marks an invite sent and starts the campaign", async () => {
    await recordResult(account(), { targetId: "t0", outcome: "sent", now: MON_10AM_LA });
    expect(tables.linkedin_targets[0]).toMatchObject({ status: "invited", invited_at: MON_10AM_LA.toISOString() });
    expect(tables.linkedin_campaigns[0].status).toBe("running");
  });
  it("holds a dry run person back for the day", async () => {
    await recordResult(account(), { targetId: "t0", outcome: "dry_run", now: MON_10AM_LA });
    expect(tables.linkedin_targets[0].status).toBe("queued");
    expect(String(tables.linkedin_targets[0].next_action_at) > MON_10AM_LA.toISOString()).toBe(true);
  });
  it("a LinkedIn warning stops the whole account", async () => {
    const r = await recordResult(account(), { targetId: "t0", outcome: "warning", detail: "captcha", now: MON_10AM_LA });
    expect(r.paused).toBe(true);
    expect(tables.linkedin_accounts[0]).toMatchObject({ status: "warning", paused_reason: "captcha" });
    expect(await nextForSender(tables.linkedin_accounts[0] as unknown as LinkedInAccount, { dryRun: false, now: MON_10AM_LA })).toMatchObject({ reason: "paused" });
  });
  it("moves an already connected person to message instead of inviting", async () => {
    await recordResult(account(), { targetId: "t0", outcome: "already_connected", now: MON_10AM_LA });
    expect(tables.linkedin_targets[0].route).toBe("message");
  });
  it("ignores a person who belongs to another account", async () => {
    await recordResult(account({ id: "other" }), { targetId: "t0", outcome: "sent", now: MON_10AM_LA });
    expect(tables.linkedin_targets[0].status).toBe("queued");
  });
});

describe("messages to existing connections", () => {
  const withMessageTargets = (n = 2) => {
    seed(0);
    tables.linkedin_campaigns[0] = { ...tables.linkedin_campaigns[0], connected_message_text: "Hi {first_name}, chat: {link}", handoff_mode: "web_chat", agent: "jessica" };
    tables.linkedin_targets = Array.from({ length: n }, (_, i) => ({ id: `m${i}`, campaign_id: "c1", route: "message", status: "queued", linkedin_slug: `c${i}`, display_name: `Sam ${i}`, next_action_at: null, messaged_at: null, updated_at: "2026-11-01" }));
  };

  it("hands out a message with the name and the chat link, and reserves the person", async () => {
    withMessageTargets();
    const r = await nextForSender(account(), { dryRun: true, now: MON_10AM_LA });
    expect(r).toMatchObject({ action: "message", slug: "c0", contactName: "Sam 0" });
    expect((r as { text: string }).text).toMatch(/^Hi Sam, chat: https:\/\/.+\/jessica\?src=linkedin&t=m0$/);
    expect(await nextForSender(account(), { dryRun: true, now: MON_10AM_LA })).toMatchObject({ action: "message", slug: "c1" });
  });
  it("sends no message when the campaign has no approved text for existing connections", async () => {
    withMessageTargets();
    delete tables.linkedin_campaigns[0].connected_message_text;
    expect(await nextForSender(account(), { dryRun: true, now: MON_10AM_LA })).toMatchObject({ action: "wait", reason: "nothing_queued" });
    expect(tables.linkedin_targets.every((t) => t.status === "queued")).toBe(true);
  });
  it("prefers an invite when one is allowed, and falls back to messages when invites are capped", async () => {
    withMessageTargets();
    tables.linkedin_targets.push({ id: "i0", campaign_id: "c1", route: "invite", status: "queued", linkedin_slug: "p0", display_name: "Pat", next_action_at: null, invited_at: null, updated_at: "2026-11-01" });
    expect(await nextForSender(account(), { dryRun: true, now: MON_10AM_LA })).toMatchObject({ action: "invite" });
    for (let i = 0; i < 15; i++) tables.linkedin_targets.push({ id: `d${i}`, campaign_id: "c1", route: "invite", status: "invited", linkedin_slug: `d${i}`, invited_at: new Date(MON_10AM_LA.getTime() - (10 + i) * 60_000).toISOString() });
    expect(await nextForSender(account(), { dryRun: true, now: MON_10AM_LA })).toMatchObject({ action: "message" });
  });
  it("stops at the message cap and keeps the gap", async () => {
    withMessageTargets(3);
    tables.linkedin_targets[0] = { ...tables.linkedin_targets[0], status: "messaged", messaged_at: new Date(MON_10AM_LA.getTime() - 60_000).toISOString() };
    expect(await nextForSender(account(), { dryRun: true, now: MON_10AM_LA })).toMatchObject({ reason: "gap" });
    tables.linkedin_targets[0].messaged_at = new Date(MON_10AM_LA.getTime() - 20 * 60_000).toISOString();
    for (let i = 0; i < 15; i++) tables.linkedin_targets.push({ id: `s${i}`, campaign_id: "c1", route: "message", status: "messaged", linkedin_slug: `s${i}`, messaged_at: new Date(MON_10AM_LA.getTime() - (10 + i) * 60_000).toISOString() });
    expect(await nextForSender(account(), { dryRun: true, now: MON_10AM_LA })).toMatchObject({ action: "wait", reason: "daily_cap" });
  });
  it("records a sent message, a dry run and a person who is not a connection", async () => {
    withMessageTargets();
    await recordResult(account(), { targetId: "m0", outcome: "message_sent", now: MON_10AM_LA });
    expect(tables.linkedin_targets[0]).toMatchObject({ status: "messaged", messaged_at: MON_10AM_LA.toISOString() });
    expect(tables.linkedin_events.at(-1)).toMatchObject({ kind: "message_sent" });
    await recordResult(account(), { targetId: "m1", outcome: "dry_run", now: MON_10AM_LA });
    expect(tables.linkedin_targets[1].status).toBe("queued");
    expect(String(tables.linkedin_events.at(-1)?.detail)).toMatch(/^Dry run: message was typed/);
    tables.linkedin_targets.push({ id: "m2", campaign_id: "c1", route: "message", status: "queued", linkedin_slug: "c2" });
    await recordResult(account(), { targetId: "m2", outcome: "not_connected", now: MON_10AM_LA });
    expect(tables.linkedin_targets[2].route).toBe("invite");
  });
});


describe("reading your own LinkedIn connections", () => {
  const network = (over: Record<string, unknown> = {}) => {
    tables.linkedin_accounts = [account() as unknown as Row];
    tables.linkedin_campaigns = [{ id: "n1", account_id: "a1", status: "ready", approved_at: "2026-11-01", wording_hash: "h", invite_variants: [], connected_message_text: "Hi {first_name}", audience: { source: "linkedin_network", filters: { industry: "Venture Capital and Private Equity", sort: "recent" } }, ...over }];
    tables.linkedin_targets = [];
    tables.linkedin_events = [];
  };

  it("asks the sender to read page 1 with the filters when no one is waiting", async () => {
    network();
    expect(await nextForSender(account(), { dryRun: true, now: MON_10AM_LA })).toMatchObject({ action: "read", campaignId: "n1", page: 1, searchUrl: null, filters: { industry: "Venture Capital and Private Equity", sort: "recent" } });
  });
  it("does not read while enough people are still waiting, or after the daily pages are used", async () => {
    network();
    for (let i = 0; i < 10; i++) tables.linkedin_targets.push({ id: `w${i}`, campaign_id: "n1", route: "message", status: "queued", linkedin_slug: `w${i}`, display_name: "W", next_action_at: "2099-01-01", updated_at: "2026-11-01" });
    expect(await nextForSender(account(), { dryRun: true, now: MON_10AM_LA })).toMatchObject({ action: "wait" });
    network();
    const day = new Date("2026-11-09T08:00:00Z").toISOString(); // start of Monday in Los Angeles
    (tables.linkedin_campaigns[0].audience as Record<string, unknown>).progress = { page: 4, done: false, found: 30, searchUrl: null, readDay: day, readToday: 3, readAt: "2026-11-09T10:00:00Z" };
    expect(await nextForSender(account(), { dryRun: true, now: MON_10AM_LA })).toMatchObject({ action: "wait" });
  });
  it("keeps new people as message targets, skips repeats and yourself, and moves to the next page", async () => {
    network();
    tables.linkedin_targets.push({ id: "old", campaign_id: "n1", route: "message", status: "messaged", linkedin_slug: "ana", display_name: "Ana" });
    const r = await recordRead(account({ linkedin_slug: "me" }), {
      campaignId: "n1", page: 1, filtersApplied: true, now: MON_10AM_LA,
      searchUrl: "https://www.linkedin.com/search/results/people/?network=%5B%22F%22%5D&industry=%5B%22x%22%5D",
      people: [{ slug: "ana", name: "Ana" }, { slug: "ben", name: "Ben Ray" }, { slug: "me", name: "Me" }, { slug: "ben", name: "Ben Ray" }, { slug: "ACoAAAbcdefghijklmnopqrstuv", name: "Hidden" }],
    });
    expect(r).toEqual({ added: 1, paused: false });
    expect(tables.linkedin_targets.filter((t) => t.id !== "old")).toMatchObject([{ linkedin_slug: "ben", display_name: "Ben Ray", route: "message", status: "queued" }]);
    const progress = (tables.linkedin_campaigns[0].audience as { progress: Record<string, unknown> }).progress;
    expect(progress).toMatchObject({ page: 2, found: 1, readToday: 1, done: false });
    expect(progress.searchUrl).toMatch(/^https:\/\/www\.linkedin\.com\/search\/results\/people/);
  });
  it("keeps only people whose headline has a chosen title, and says how many it skipped", async () => {
    network({ audience: { source: "linkedin_network", filters: { sort: "recent", titles: ["Founder", "CEO"] } } });
    const r = await recordRead(account(), { campaignId: "n1", page: 1, filtersApplied: true, now: MON_10AM_LA, people: [
      { slug: "ana", name: "Ana", headline: "Co-founder at Acme" }, { slug: "ben", name: "Ben", headline: "Software engineer" }, { slug: "cy", name: "Cy", headline: null },
    ] });
    expect(r.added).toBe(1);
    expect(tables.linkedin_targets).toMatchObject([{ linkedin_slug: "ana" }]);
    expect(tables.linkedin_events.at(-1)?.detail).toMatch(/2 skipped by title/);
    expect((tables.linkedin_campaigns[0].audience as { progress: { page: number } }).progress.page).toBe(2);
  });
  it("keeps nobody and retries when titles are set but no headline could be read", async () => {
    network({ audience: { source: "linkedin_network", filters: { sort: "recent", titles: ["Founder"] } } });
    const r = await recordRead(account(), { campaignId: "n1", page: 1, filtersApplied: true, now: MON_10AM_LA, people: [{ slug: "ana", name: "Ana" }, { slug: "ben", name: "Ben" }] });
    expect(r.added).toBe(0);
    expect(tables.linkedin_targets).toHaveLength(0);
    expect((tables.linkedin_campaigns[0].audience as { progress: { page: number } }).progress.page).toBe(1);
    expect(tables.linkedin_events.at(-1)).toMatchObject({ kind: "failed" });
  });
  it("keeps nobody when the filters could not be applied, and tries the same page later", async () => {
    network();
    const r = await recordRead(account(), { campaignId: "n1", page: 1, filtersApplied: false, people: [{ slug: "ben", name: "Ben" }], now: MON_10AM_LA, detail: "Industry filter not found" });
    expect(r.added).toBe(0);
    expect(tables.linkedin_targets).toHaveLength(0);
    expect((tables.linkedin_campaigns[0].audience as { progress: { page: number } }).progress.page).toBe(1);
    expect(tables.linkedin_events.at(-1)).toMatchObject({ kind: "failed" });
  });
  it("ends the reading on an empty page and pauses the account on a warning", async () => {
    network();
    await recordRead(account(), { campaignId: "n1", page: 3, filtersApplied: true, people: [], now: MON_10AM_LA });
    expect((tables.linkedin_campaigns[0].audience as { progress: { done: boolean } }).progress.done).toBe(true);
    const w = await recordRead(account(), { campaignId: "n1", page: 1, filtersApplied: true, people: [], warning: true, detail: "Unusual activity", now: MON_10AM_LA });
    expect(w.paused).toBe(true);
    expect(tables.linkedin_accounts[0].status).toBe("warning");
  });
  it("ignores a campaign that is not this account's or not a network campaign", async () => {
    network();
    tables.linkedin_campaigns[0].account_id = "other";
    expect(await recordRead(account(), { campaignId: "n1", page: 1, filtersApplied: true, people: [{ slug: "ben", name: "Ben" }], now: MON_10AM_LA })).toEqual({ added: 0, paused: false });
    expect(tables.linkedin_targets).toHaveLength(0);
  });
});

describe("matches on LinkedIn count", () => {
  const NOW = new Date("2026-11-10T10:00:00Z");
  beforeEach(() => { tables.linkedin_accounts = [account() as unknown as Row]; });

  it("hands the pending count to the sender once, with its filters", async () => {
    const mc = await requestMatchCheck("a1", { industry: "Venture Capital", sort: "recent" }, NOW);
    expect(await pendingMatchCheck(account(), new Date("2026-11-10T10:01:00Z"))).toEqual({ id: mc.id, filters: { industry: "Venture Capital", sort: "recent" } });
    expect(await pendingMatchCheck(account(), new Date("2026-11-10T10:30:00Z"))).toBeNull();
  });
  it("never asks a paused or warned account", async () => {
    await requestMatchCheck("a1", { sort: "recent" }, NOW);
    expect(await pendingMatchCheck(account({ status: "paused" }), NOW)).toBeNull();
    expect(await pendingMatchCheck(account({ status: "warning" }), NOW)).toBeNull();
  });
  it("stores the total, and ignores an answer for an old request", async () => {
    const mc = await requestMatchCheck("a1", { sort: "recent" }, NOW);
    await recordMatchCount(account(), { checkId: "old", total: 9, now: NOW });
    expect((await getMatchCheck("a1"))?.status).toBe("pending");
    await recordMatchCount(account(), { checkId: mc.id, total: 240, now: NOW });
    expect(await getMatchCheck("a1")).toMatchObject({ status: "done", total: 240 });
  });
  it("records a failed count and a warning that pauses the account", async () => {
    const a = await requestMatchCheck("a1", { sort: "recent" }, NOW);
    await recordMatchCount(account(), { checkId: a.id, failed: true, detail: "Industry filter not found", now: NOW });
    expect(await getMatchCheck("a1")).toMatchObject({ status: "failed", total: null, detail: "Industry filter not found" });
    const b = await requestMatchCheck("a1", { sort: "recent" }, NOW);
    expect(await recordMatchCount(account(), { checkId: b.id, warning: true, detail: "Unusual activity", now: NOW })).toEqual({ paused: true });
    expect(tables.linkedin_accounts[0].status).toBe("warning");
  });
});
