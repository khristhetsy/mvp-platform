/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Res = { data: any[] | null; error: { message: string } | null };
const script: Res[] = [];
const ranges: number[] = [];

function builder() {
  let from = 0;
  const b: any = {
    select: () => b,
    order: () => b,
    eq: () => b,
    range: (f: number) => { from = f; ranges.push(f); return b; },
    then: (resolve: (r: Res) => unknown) => resolve(script.shift() ?? { data: [], error: null }),
  };
  void from;
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({ from: () => builder() }) }));

import { loadInvestorContacts } from "./load-investor-matches";

const row = (i: number) => ({ id: `c${i}`, name: `Investor ${i}`, email: `i${i}@x.com`, company: "Fund", profile: { industries: ["Software"] }, overrides: null });
const page = (n: number, start = 0): Res => ({ data: Array.from({ length: n }, (_, i) => row(start + i)), error: null });
const fail: Res = { data: null, error: { message: "timeout" } };

async function readAll() {
  const done = loadInvestorContacts({ all: true, investorsOnly: true, score: false });
  await vi.runAllTimersAsync();
  return done;
}

beforeEach(() => { script.length = 0; ranges.length = 0; vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("loadInvestorContacts all mode", () => {
  it("reads page after page until a short page", async () => {
    script.push(page(1000), page(5, 1000));
    const out = await readAll();
    expect(out).toHaveLength(1005);
    expect(ranges).toEqual([0, 1000]);
  });

  it("retries a failed page and carries on", async () => {
    script.push(fail, page(3));
    const out = await readAll();
    expect(out).toHaveLength(3);
    expect(ranges).toEqual([0, 0]);
  });

  it("retries up to three times, then returns nothing rather than a partial list", async () => {
    script.push(page(1000), fail, fail, fail);
    const out = await readAll();
    expect(out).toEqual([]);
    expect(ranges).toEqual([0, 1000, 1000, 1000]);
  });

  it("recovers on the last attempt", async () => {
    script.push(fail, fail, page(2));
    expect(await readAll()).toHaveLength(2);
    expect(ranges).toEqual([0, 0, 0]);
  });
});
