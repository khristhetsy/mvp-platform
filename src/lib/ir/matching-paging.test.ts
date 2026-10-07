import { beforeEach, describe, expect, it, vi } from "vitest";

// 120 indexed investors, one firm each, all in Software.
const SCORABLES = Array.from({ length: 120 }, (_, i) => ({
  id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
  company: `Firm ${String(i).padStart(3, "0")}`,
  inv_source: i % 2 ? "verified" : "self_reported",
  inv_verified_at: null,
  fields: { industries: ["Software"], stages: [], sizes: [], types: ["Venture Capital"], revenues: [] },
}));
const tables: Record<string, unknown[]> = {};

vi.mock("@/lib/fit/match-index", () => ({ scorablesForIndustries: vi.fn(async () => SCORABLES) }));
vi.mock("@/lib/ir/db", () => {
  const chain = (table: string) => {
    const filters: Array<(r: Record<string, unknown>) => boolean> = [];
    const q: Record<string, unknown> = {
      select: () => q, eq: () => q, neq: () => q, or: () => q, limit: () => q,
      in: (col: string, vals: unknown[]) => { filters.push((r) => vals.includes(r[col])); return q; },
      maybeSingle: async () => ({ data: (tables[table] ?? [])[0] ?? null }),
      then: (res: (v: unknown) => unknown) => res({ data: (tables[table] ?? []).filter((r) => filters.every((f) => f(r as Record<string, unknown>))) }),
    };
    return q;
  };
  return { db: () => ({ from: chain }), listMatches: vi.fn(async () => []) };
});

import { proposeMatches } from "./matching";

const F = { industry: ["Software"], stage: [], raise: [], revenue: [], investorType: [], source: "any" as const, tier: "any" as const };
const V = { offset: 0, limit: 50, q: "", hideContacted: false, sort: null };

describe("proposeMatches paging", () => {
  beforeEach(() => {
    tables.crm_contacts = SCORABLES.map((s, i) => ({ id: s.id, name: `Person ${i}`, email: `p${i}@x.com`, phone: null, raw_phone: null, raw_mobile: null }));
    tables.ir_projects = [{ id: "p2", company_id: "c1", founder_contact_id: null }];
    tables.ir_matches = [];
  });

  it("returns one page of rows but every proposal in `all`", async () => {
    const r = await proposeMatches("p1", F, V);
    expect(r.filtered).toBe(120);
    expect(r.rows).toHaveLength(50);
    expect(r.all).toHaveLength(120);
    expect(r.rows[0].name).toMatch(/^Person /);
  });

  it("pages with offset and clamps past the end", async () => {
    const p3 = await proposeMatches("p1", F, { ...V, offset: 100 });
    expect(p3.rows).toHaveLength(20);
    expect(p3.offset).toBe(100);
    const past = await proposeMatches("p1", F, { ...V, offset: 500 });
    expect(past.offset).toBe(119);
  });

  it("applies source filter and search text to the whole list", async () => {
    const v = await proposeMatches("p1", { ...F, source: "verified" }, V);
    expect(v.filtered).toBe(60);
    const q = await proposeMatches("p1", F, { ...V, q: "11" });
    expect(q.all.map((e) => e[0])).toEqual(SCORABLES.filter((s) => s.company.includes("11")).map((s) => s.id));
  });

  it("sorts the whole list by firm", async () => {
    const r = await proposeMatches("p1", F, { ...V, sort: { key: "firm", dir: "desc" } });
    expect(r.rows[0].firm).toBe("Firm 119");
  });
});
