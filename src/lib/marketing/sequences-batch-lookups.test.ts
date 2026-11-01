import { describe, it, expect, vi, beforeEach } from "vitest";

// A tiny fake database that records every request, so the test can prove the
// due-step collector reads the suppression list and prior events in bulk
// instead of once per contact.
type Call = { table: string; op: string };
const calls: Call[] = [];
const tables: Record<string, unknown[]> = {};
const updates: { table: string; patch: Record<string, unknown>; ids: string[] }[] = [];

function builder(table: string) {
  let op = "select";
  let patch: Record<string, unknown> = {};
  let idFilter: string[] = [];
  let single = false;
  const b: Record<string, unknown> = {};
  const chain = () => b;
  for (const m of ["select", "eq", "lte", "limit", "order", "range", "ilike"]) b[m] = chain;
  b.update = (p: Record<string, unknown>) => { op = "update"; patch = p; return b; };
  b.insert = () => { op = "insert"; return b; };
  b.in = (_c: string, v: string[]) => { idFilter = v; return b; };
  b.maybeSingle = () => { single = true; return b; };
  b.single = () => { single = true; return b; };
  b.then = (resolve: (v: unknown) => unknown) => {
    calls.push({ table, op });
    if (op === "update") updates.push({ table, patch, ids: idFilter });
    let data: unknown = op === "select" ? (tables[table] ?? []) : null;
    if (single) data = Array.isArray(data) ? (data[0] ?? null) : data;
    if (op === "insert") data = { id: "batch-1" };
    return Promise.resolve({ data, error: null }).then(resolve);
  };
  return b;
}

vi.mock("./db", () => ({ marketingDb: () => ({ from: (t: string) => builder(t) }) }));
vi.mock("./send", () => ({
  makeUnsubscribeToken: vi.fn(), sendMarketingEmail: vi.fn(), emailConfigured: vi.fn(),
  interpolate: vi.fn(), htmlToText: vi.fn(),
}));
vi.mock("@/lib/sales/activity", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/notes-log-preview", () => ({ buildPreview: vi.fn() }));
vi.mock("@/lib/notes-log", () => ({ emailLogIdsByProvider: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }));

import { collectDueSequenceBatches } from "./sequences";
import { loadUnsubscribedSet, normalizeEmail } from "./contacts";

const count = (table: string) => calls.filter((c) => c.table === table && c.op === "select").length;

beforeEach(() => {
  calls.length = 0; updates.length = 0;
  for (const k of Object.keys(tables)) delete tables[k];
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Jane@Example.COM ")).toBe("jane@example.com");
  });
});

describe("loadUnsubscribedSet", () => {
  it("returns lowercase addresses from a single read", async () => {
    tables.marketing_unsubscribes = [{ email: "A@x.com" }, { email: " b@x.com" }];
    const set = await loadUnsubscribedSet();
    expect(set.has("a@x.com")).toBe(true);
    expect(set.has("b@x.com")).toBe(true);
    expect(count("marketing_unsubscribes")).toBe(1);
  });
});

describe("collectDueSequenceBatches", () => {
  it("reads suppression and prior events once, not once per contact", async () => {
    const enr = (id: string, cid: string, email: string) => ({
      id, sequence_id: "s1", current_step: 1, contact_id: cid, contact: { id: cid, email },
    });
    tables.marketing_sequence_enrollments = [
      enr("e1", "c1", "one@x.com"),
      enr("e2", "c2", "Two@X.com"),   // suppressed, different case than stored
      enr("e3", "c3", "three@x.com"), // already opened, skipped by condition
      enr("e4", "c4", "four@x.com"),
      enr("e5", "c5", "five@x.com"),
    ];
    tables.marketing_unsubscribes = [{ email: "two@x.com" }];
    tables.marketing_events = [{ contact_id: "c3" }];
    tables.marketing_sequence_steps = [{ id: "st1", sequence_id: "s1", step_order: 1, delay_days: 2, condition: "no_open", template: { id: "t1" } }];
    tables.marketing_sequence_batches = [];
    tables.marketing_sequences = [{ approver_id: null }];

    const res = await collectDueSequenceBatches();

    expect(res).toEqual({ batches: 1, queued: 3 });
    // The point of the fix: one suppression read and one events read for the whole group.
    expect(count("marketing_unsubscribes")).toBe(1);
    expect(count("marketing_events")).toBe(1);
    // The suppressed contact is marked unsubscribed.
    expect(updates.some((u) => u.patch.status === "unsubscribed")).toBe(true);
  });

  it("skips the events read when the step has no condition", async () => {
    tables.marketing_sequence_enrollments = [
      { id: "e1", sequence_id: "s1", current_step: 1, contact_id: "c1", contact: { id: "c1", email: "one@x.com" } },
    ];
    tables.marketing_unsubscribes = [];
    tables.marketing_sequence_steps = [{ id: "st1", sequence_id: "s1", step_order: 1, delay_days: 2, condition: "always", template: { id: "t1" } }];
    tables.marketing_sequence_batches = [];
    tables.marketing_sequences = [{ approver_id: null }];

    await collectDueSequenceBatches();
    expect(count("marketing_events")).toBe(0);
  });
});
