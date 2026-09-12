import { describe, it, expect, vi } from "vitest";
import { readAllRows, chunk, PAGE_SIZE } from "./paged";

/** Fake table of n rows that honours .range(from, to) and caps each page at PAGE_SIZE. */
function fakeTable(n: number) {
  const all = Array.from({ length: n }, (_, i) => ({ id: i }));
  const calls: Array<[number, number]> = [];
  const query = (from: number, to: number) => {
    calls.push([from, to]);
    return Promise.resolve({ data: all.slice(from, Math.min(to + 1, from + PAGE_SIZE)), error: null });
  };
  return { query, calls };
}

describe("readAllRows", () => {
  it("reads past the row cap that a single request would hit", async () => {
    const t = fakeTable(7184);
    const rows = await readAllRows<{ id: number }>(t.query);
    expect(rows).toHaveLength(7184);          // not 1000
    expect(rows[0].id).toBe(0);
    expect(rows[7183].id).toBe(7183);
    expect(t.calls).toHaveLength(8);          // 7 full pages + a short one
  });
  it("stops on the first short page", async () => {
    const t = fakeTable(1500);
    expect(await readAllRows(t.query)).toHaveLength(1500);
    expect(t.calls).toHaveLength(2);
  });
  it("makes exactly one extra call when the total is an exact multiple", async () => {
    // A full last page is indistinguishable from "more to come", so one empty read.
    const t = fakeTable(2000);
    expect(await readAllRows(t.query)).toHaveLength(2000);
    expect(t.calls).toHaveLength(3);
  });
  it("handles an empty table", async () => {
    const t = fakeTable(0);
    expect(await readAllRows(t.query)).toEqual([]);
    expect(t.calls).toHaveLength(1);
  });
  it("returns what it has when a page errors instead of throwing", async () => {
    const q = vi.fn()
      .mockResolvedValueOnce({ data: Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: i })), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect(await readAllRows<{ id: number }>(q)).toHaveLength(PAGE_SIZE);
  });
  it("respects the max safety valve", async () => {
    const t = fakeTable(10_000);
    const rows = await readAllRows(t.query, { max: 2000 });
    expect(rows).toHaveLength(2000);
  });
});

describe("chunk", () => {
  it("splits a long id list so .in() can't overflow the URL", () => {
    const parts = chunk(Array.from({ length: 1250 }, (_, i) => i));
    expect(parts.map((p) => p.length)).toEqual([500, 500, 250]);
    expect(parts.flat()).toHaveLength(1250);
  });
  it("returns nothing for an empty list, and one chunk when it fits", () => {
    expect(chunk([])).toEqual([]);
    expect(chunk([1, 2, 3])).toEqual([[1, 2, 3]]);
  });
});
