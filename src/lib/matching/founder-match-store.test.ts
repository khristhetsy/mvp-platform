/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = {
  flag: true,
  companies: [] as any[],
  prev: null as any,
  stored: null as any,
  upserts: [] as any[],
  upsertError: null as any,
  network: [] as any[],
  loaded: [] as any[],
  loadCalls: [] as any[],
};

function builder(table: string) {
  let from = 0;
  const b: any = {
    select: () => b,
    order: () => b,
    limit: () => b,
    eq: () => b,
    range: (f: number) => { from = f; return b; },
    maybeSingle: () => Promise.resolve({ data: table === "founder_investor_matches" ? (state.stored ?? state.prev) : null, error: null }),
    upsert: (rows: any[]) => { state.upserts.push(...rows); return Promise.resolve({ error: state.upsertError }); },
    then: (resolve: (r: any) => unknown) => resolve({ data: table === "companies" ? state.companies.slice(from, from + 1000) : [], error: null }),
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({ from: (t: string) => builder(t) }) }));
vi.mock("@/lib/settings/platform-settings", () => ({
  getBoolSetting: async () => state.flag,
  getInvestorMatchConfig: async () => ({ engineWeights: { w: 1 } }),
}));
vi.mock("@/lib/investors/load-investor-matches", () => ({
  loadInvestorContacts: async (opts: any) => { state.loadCalls.push(opts); return opts.all ? state.network : state.loaded; },
}));
vi.mock("@/lib/matching/contact-match", () => ({
  buildCompanyMatchProfile: (c: any) => ({ industry: c.industry }),
  // Score is the investor's score for that industry, so founders rank differently.
  scoreContactAgainstCompany: (s: any, p: any) => ({ matchScore: s.scores[p.industry] ?? 0 }),
}));

import { MIN_NETWORK_SHARE, STORE_TOP, computeFounderMatches, hashRankingInputs, isFresh, loadStoredInvestors, rankFounder, rankingInputs } from "./founder-match-store";

const investors = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `i${String(i).padStart(3, "0")}`, scores: { A: i % 100, B: 99 - (i % 100) } }));
const W = { w: 1 };

beforeEach(() => {
  state.flag = true; state.companies = []; state.prev = null; state.stored = null;
  state.upserts = []; state.upsertError = null; state.network = []; state.loaded = []; state.loadCalls = [];
});

describe("hashRankingInputs", () => {
  const base = { id: "c1", industry: "Software", funding_amount: 1000000, company_name: "Acme" };
  it("is stable and ignores key order, blanks and fields the engine never reads", () => {
    const a = hashRankingInputs(base, W);
    expect(hashRankingInputs({ funding_amount: 1000000, industry: " Software ", company_name: "Other name", id: "c2", state: "" }, W)).toBe(a);
  });
  it("changes when a ranking input or the engine weights change", () => {
    const a = hashRankingInputs(base, W);
    expect(hashRankingInputs({ ...base, industry: "Fintech" }, W)).not.toBe(a);
    expect(hashRankingInputs({ ...base, funding_amount: 2000000 }, W)).not.toBe(a);
    expect(hashRankingInputs(base, { w: 2 })).not.toBe(a);
  });
  it("treats a missing field and null the same", () => {
    expect(rankingInputs({ industry: null }).industry).toBeNull();
    expect(rankingInputs({}).industry).toBeNull();
  });
});

describe("isFresh", () => {
  const now = Date.parse("2026-11-02T12:00:00Z");
  it("accepts recent and rejects old or future timestamps", () => {
    expect(isFresh("2026-11-02T06:00:00Z", now)).toBe(true);
    expect(isFresh("2026-11-02T06:00:00", now)).toBe(true); // no offset is read as UTC
    expect(isFresh("2026-10-30T11:00:00Z", now)).toBe(false); // over 72 hours
    expect(isFresh("2026-11-03T12:00:00Z", now)).toBe(false);
    expect(isFresh("junk", now)).toBe(false);
  });
});

describe("rankFounder", () => {
  it("orders by score, breaks ties by id and caps the list", () => {
    const out = rankFounder([{ id: "b", s: 5 }, { id: "a", s: 5 }, { id: "c", s: 9 }, { id: "d", s: 1 }], (x) => x.s, 3);
    expect(out).toEqual([{ id: "c", score: 9 }, { id: "a", score: 5 }, { id: "b", score: 5 }]);
  });
});

describe("computeFounderMatches", () => {
  beforeEach(() => {
    state.network = investors(250);
    state.companies = [{ id: "c1", industry: "A" }, { id: "c2", industry: "B" }];
  });

  it("stores each founder's best investors, ranked for that founder", async () => {
    const out = await computeFounderMatches();
    expect(out).toMatchObject({ ok: true, founders: 2, networkSize: 250, written: 2, dryRun: false });
    const [r1, r2] = state.upserts;
    expect(r1.company_id).toBe("c1");
    expect(r1.matches).toHaveLength(STORE_TOP);
    expect(r1.matches[0].score).toBe(99);
    expect(r2.matches[0].score).toBe(99); // best for B is a different investor than for A
    expect(r1.matches[0].id).not.toBe(r2.matches[0].id);
    expect(r1.matches.map((m: any) => m.score)).toEqual([...r1.matches.map((m: any) => m.score)].sort((a: number, b: number) => b - a));
    expect(r1.profile_hash).toBe(hashRankingInputs(state.companies[0], W));
    expect(r1.network_size).toBe(250);
    expect(state.loadCalls[0]).toMatchObject({ all: true, investorsOnly: true });
  });

  it("scores and reports without saving on a dry run", async () => {
    const out = await computeFounderMatches({ dryRun: true });
    expect(out).toMatchObject({ ok: true, dryRun: true, written: 0, founders: 2 });
    expect(out.avgTop50Score).toBe(89.1); // mean of each founder's best 50 in the synthetic network
    expect(state.upserts).toHaveLength(0);
  });

  it("saves nothing when the network cannot be read", async () => {
    state.network = [];
    const out = await computeFounderMatches();
    expect(out.ok).toBe(false);
    expect(state.upserts).toHaveLength(0);
  });

  it("saves nothing when the read is far smaller than last time", async () => {
    state.prev = { network_size: 1000 };
    const out = await computeFounderMatches();
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/partial/);
    expect(250).toBeLessThan(1000 * MIN_NETWORK_SHARE);
    expect(state.upserts).toHaveLength(0);
  });

  it("reports a failed save", async () => {
    state.upsertError = { message: "boom" };
    const out = await computeFounderMatches();
    expect(out).toMatchObject({ ok: false, written: 0 });
  });
});

describe("loadStoredInvestors", () => {
  const company = { id: "c1", industry: "A" };
  const fresh = () => new Date(Date.now() - 3600_000).toISOString();
  const ids = Array.from({ length: 60 }, (_, i) => ({ id: `i${i}`, score: 90 - i }));
  const stored = (over: any = {}) => ({ profile_hash: hashRankingInputs(company, W), computed_at: fresh(), matches: ids, ...over });
  const args = { company, scoreAgainst: undefined, want: 50, take: 50 };
  beforeEach(() => { state.stored = stored(); state.loaded = ids.slice(0, 50).map((m) => ({ id: m.id })).reverse(); });

  it("returns the stored investors in stored order", async () => {
    const out = await loadStoredInvestors(args);
    expect(out!.map((r: any) => r.id)).toEqual(ids.slice(0, 50).map((m) => m.id));
    expect(state.loadCalls[0].ids).toHaveLength(50);
  });
  it("is off by default and never reads the table", async () => {
    state.flag = false;
    expect(await loadStoredInvestors(args)).toBeNull();
    expect(state.loadCalls).toHaveLength(0);
  });
  it("falls back when there is no stored row, it is stale, or the founder or weights changed", async () => {
    state.stored = null;
    expect(await loadStoredInvestors(args)).toBeNull();
    state.stored = stored({ computed_at: new Date(Date.now() - 80 * 3600_000).toISOString() });
    expect(await loadStoredInvestors(args)).toBeNull();
    state.stored = stored({ profile_hash: hashRankingInputs({ ...company, industry: "B" }, W) });
    expect(await loadStoredInvestors(args)).toBeNull();
    state.stored = stored({ profile_hash: hashRankingInputs(company, { w: 9 }) });
    expect(await loadStoredInvestors(args)).toBeNull();
  });
  it("falls back when too few ids are stored or too few contacts load", async () => {
    state.stored = stored({ matches: ids.slice(0, 10) });
    expect(await loadStoredInvestors(args)).toBeNull();
    state.stored = stored();
    state.loaded = state.loaded.slice(0, 20);
    expect(await loadStoredInvestors(args)).toBeNull();
  });
});
