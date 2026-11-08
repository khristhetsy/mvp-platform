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
    if (mode === "insert") { rows().push({ id: `n${rows().length}`, ...patch }); return { data: [patch], error: null }; }
    const m = matched();
    return { data: head ? null : m, error: null, count: m.length };
  };
  const b: Record<string, unknown> = {
    select: (_c?: string, o?: { head?: boolean }) => { head = !!o?.head; return b; },
    update: (p: Row) => { mode = "update"; patch = p; return b; },
    insert: (p: Row) => { mode = "insert"; patch = p; return b; },
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

import { nextForSender, recordResult } from "./worker-store";
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
