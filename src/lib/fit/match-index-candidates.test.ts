import { beforeEach, describe, expect, it, vi } from "vitest";

type Res = { data: Array<{ contact_id: string }> | null; error: { code?: string; message?: string } | null };
const script: Res[] = [];
const calls: Array<{ orders: string[]; overlaps: string[][]; limit: number | null }> = [];

function builder() {
  const rec = { orders: [] as string[], overlaps: [] as string[][], limit: null as number | null };
  calls.push(rec);
  const b: Record<string, unknown> = {
    select: () => b,
    overlaps: (_col: string, v: string[]) => { rec.overlaps.push(v); return b; },
    order: (col: string) => { rec.orders.push(col); return b; },
    limit: (n: number) => { rec.limit = n; return b; },
    then: (resolve: (r: Res) => unknown) => resolve(script.shift() ?? { data: [], error: null }),
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({ from: () => builder() }) }));
vi.mock("@/lib/supabase/report", () => ({ reportDbError: (_c: string, e: unknown) => Boolean(e) }));
vi.mock("@/lib/settings/platform-settings", () => ({ getBoolSetting: async () => false }));
vi.mock("@/lib/fit/match-investors", () => ({ fieldsOf: () => ({}), INCLUDE_LOW_CONFIDENCE_KEY: "k" }));

import { candidateIdsForFounder } from "./match-index";

const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => ({ contact_id: `${prefix}${i}` }));

beforeEach(() => { script.length = 0; calls.length = 0; });

describe("candidateIdsForFounder", () => {
  it("reads the founder's sector pool most complete first, then verified, then id", async () => {
    script.push({ data: ids("s", 300), error: null });
    const out = await candidateIdsForFounder(["Software"], 300);
    expect(out).toHaveLength(300);
    expect(calls).toHaveLength(1); // pool already fills the cap, no top up
    expect(calls[0].orders).toEqual(["completeness", "inv_verified_at", "contact_id"]);
    expect(calls[0].overlaps).toEqual([["Software"]]);
    expect(calls[0].limit).toBe(300);
  });

  it("retries without completeness when that column does not exist yet", async () => {
    script.push({ data: null, error: { code: "42703" } });
    script.push({ data: ids("s", 300), error: null });
    const out = await candidateIdsForFounder(["Software"], 300);
    expect(out).toHaveLength(300);
    expect(calls).toHaveLength(2);
    expect(calls[1].orders).toEqual(["inv_verified_at", "contact_id"]);
  });

  it("tops up from the rest of the index when the sector pool is small, without duplicates", async () => {
    script.push({ data: ids("s", 3), error: null });
    script.push({ data: [...ids("s", 3), ...ids("t", 400)], error: null });
    const out = await candidateIdsForFounder(["HealthTech"], 300);
    expect(out).toHaveLength(300);
    expect(new Set(out).size).toBe(300);
    expect(out.slice(0, 3)).toEqual(["s0", "s1", "s2"]); // sector matches stay first
  });

  it("goes straight to the top up when the founder has no recognised industry", async () => {
    script.push({ data: ids("t", 50), error: null });
    const out = await candidateIdsForFounder([], 50);
    expect(out).toHaveLength(50);
    expect(calls).toHaveLength(1);
    expect(calls[0].overlaps).toEqual([]);
  });

  it("never asks for more than the 1,000 row API cap", async () => {
    script.push({ data: ids("s", 1000), error: null });
    await candidateIdsForFounder(["Software"], 5000);
    expect(calls[0].limit).toBe(1000);
  });

  it("returns nothing on a database error so the caller falls back to the full read", async () => {
    script.push({ data: null, error: { code: "57014", message: "timeout" } });
    expect(await candidateIdsForFounder(["Software"], 300)).toEqual([]);
  });
});
