import { beforeEach, describe, expect, it, vi } from "vitest";

const getBoolSetting = vi.fn();
const candidateIdsForFounder = vi.fn();
const loadInvestorContacts = vi.fn();

vi.mock("@/lib/settings/platform-settings", () => ({ getBoolSetting: (...a: unknown[]) => getBoolSetting(...a) }));
vi.mock("@/lib/fit/match-index", () => ({ candidateIdsForFounder: (...a: unknown[]) => candidateIdsForFounder(...a) }));
vi.mock("@/lib/investors/load-investor-matches", () => ({ loadInvestorContacts: (...a: unknown[]) => loadInvestorContacts(...a) }));

import { founderIndustries, loadPrefilteredInvestors, MATCH_PREFILTER_CAP, MATCH_PREFILTER_KEY } from "./candidate-investors";

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}` }));
const args = { industry: "Software", scoreAgainst: undefined, want: 50 };

describe("founderIndustries", () => {
  it("is empty when the industry is missing or blank", () => {
    expect(founderIndustries(null)).toEqual([]);
    expect(founderIndustries("   ")).toEqual([]);
  });
  it("returns canonical names for a known industry", () => {
    expect(founderIndustries("Software").length).toBeGreaterThan(0);
  });
});

describe("loadPrefilteredInvestors", () => {
  beforeEach(() => {
    getBoolSetting.mockReset().mockResolvedValue(true);
    candidateIdsForFounder.mockReset().mockResolvedValue(rows(300).map((r) => r.id));
    loadInvestorContacts.mockReset().mockResolvedValue(rows(300));
  });

  it("is off by default and never touches the index", async () => {
    getBoolSetting.mockResolvedValue(false);
    expect(await loadPrefilteredInvestors(args)).toBeNull();
    expect(getBoolSetting).toHaveBeenCalledWith(MATCH_PREFILTER_KEY, false);
    expect(candidateIdsForFounder).not.toHaveBeenCalled();
  });

  it("reads the short list with the default cap and returns the loaded contacts", async () => {
    const out = await loadPrefilteredInvestors(args);
    expect(out).toHaveLength(300);
    expect(candidateIdsForFounder).toHaveBeenCalledWith(expect.any(Array), MATCH_PREFILTER_CAP);
    expect(loadInvestorContacts).toHaveBeenCalledWith(expect.objectContaining({ ids: expect.any(Array), score: false, requireIndustryMatch: false }));
  });

  it("falls back (null) when the index has too few candidates", async () => {
    candidateIdsForFounder.mockResolvedValue(rows(10).map((r) => r.id));
    expect(await loadPrefilteredInvestors(args)).toBeNull();
    expect(loadInvestorContacts).not.toHaveBeenCalled();
  });

  it("falls back (null) when too few contacts load", async () => {
    loadInvestorContacts.mockResolvedValue(rows(20));
    expect(await loadPrefilteredInvestors(args)).toBeNull();
  });

  it("falls back (null) instead of throwing when the index or loader fails", async () => {
    candidateIdsForFounder.mockRejectedValue(new Error("db down"));
    expect(await loadPrefilteredInvestors(args)).toBeNull();
  });
});
