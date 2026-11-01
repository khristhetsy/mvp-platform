import { describe, expect, it } from "vitest";
import { RESUME_STALE_MS, budgetSpent, splitSent } from "./campaigns";

describe("budgetSpent", () => {
  it("never stops a send that has no budget", () => {
    expect(budgetSpent(0, 10_000_000, undefined)).toBe(false);
  });

  it("keeps sending while under the budget", () => {
    expect(budgetSpent(1_000, 1_000 + 199_999, 200_000)).toBe(false);
  });

  it("stops once the budget is used up", () => {
    expect(budgetSpent(1_000, 1_000 + 200_000, 200_000)).toBe(true);
    expect(budgetSpent(1_000, 1_000 + 250_000, 200_000)).toBe(true);
  });
});

describe("splitSent", () => {
  const contacts = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

  it("sends everyone when nothing was sent before", () => {
    const r = splitSent(contacts, new Set());
    expect(r.todo).toEqual(contacts);
    expect(r.done).toBe(0);
  });

  it("skips contacts that already have a sent event, so nobody gets it twice", () => {
    const r = splitSent(contacts, new Set(["a", "c"]));
    expect(r.todo.map((c) => c.id)).toEqual(["b", "d"]);
    expect(r.done).toBe(2);
  });

  it("ignores sent ids that are no longer on the list", () => {
    const r = splitSent(contacts, new Set(["zzz", "b"]));
    expect(r.todo.map((c) => c.id)).toEqual(["a", "c", "d"]);
    expect(r.done).toBe(1);
  });

  it("has nothing left when everyone was sent", () => {
    const r = splitSent(contacts, new Set(["a", "b", "c", "d"]));
    expect(r.todo).toEqual([]);
    expect(r.done).toBe(4);
  });
});

describe("resume window", () => {
  it("treats a send as stopped only after two quiet minutes", () => {
    expect(RESUME_STALE_MS).toBe(120_000);
  });
});
