import { describe, it, expect } from "vitest";
import { scoreRow, rankRows, fieldsOf, scoreFields, fitWeightsFromEngine } from "./match-investors";
import { OP_STAGE_LABEL, INV_SIZE_LABEL, REVENUE_LABEL, type FitAnswers } from "./options";

function inv(opts: {
  id?: string;
  company: string;
  industries?: string[];
  stage?: string[];
  size?: string[];
  revenue?: string[];
  invTypes?: string[];
  source?: string;
  verifiedAt?: string;
  overrides?: Record<string, unknown> | null;
}) {
  return {
    id: opts.id ?? opts.company,
    company: opts.company,
    inv_source: opts.source ?? "verified",
    inv_verified_at: opts.verifiedAt ?? "2026-09-01T00:00:00Z",
    overrides: opts.overrides ?? null,
    raw: {
      __profile: {
        industries: opts.industries ?? [],
        investorTypes: opts.invTypes ?? [],
        extra: {
          [OP_STAGE_LABEL]: opts.stage ?? [],
          [INV_SIZE_LABEL]: opts.size ?? [],
          [REVENUE_LABEL]: opts.revenue ?? [],
        },
      },
    },
  };
}

// Multi-select answers; investorType empty = "open to any" (type factor is neutral +15).
const ANSWERS: FitAnswers = { stage: ["revenue_pre_a"], raise: ["1m_10m"], industry: ["Cleantech"], revenue: ["1m_5m"], investorType: [] };

describe("scoreRow", () => {
  it("scores a full match at 100", () => {
    const r = scoreRow(inv({ company: "Meridian", industries: ["Cleantech"], stage: ["Expand Growth"], size: ["$1m - $10m"], revenue: ["$1m - $10m"] }), ANSWERS);
    expect(r?.fit).toBe(100); // 30 + 25 + 20 + 15(any type) + 10
  });

  it("hard-filters a firm with no sector overlap (returns null)", () => {
    const r = scoreRow(inv({ company: "OffSector", industries: ["Biotech"], stage: ["Expand Growth"] }), ANSWERS);
    expect(r).toBeNull();
  });

  it("industry + open-to-any-type alone is 45", () => {
    const r = scoreRow(inv({ company: "IndustryOnly", industries: ["Cleantech"] }), ANSWERS);
    expect(r?.fit).toBe(45); // industry 30 + type 15 (any)
  });

  it("adds the investment weight only when the raise overlaps a stored band", () => {
    const hit = scoreRow(inv({ company: "A", industries: ["Cleantech"], size: ["$1m - $10m"] }), ANSWERS);
    const miss = scoreRow(inv({ company: "B", industries: ["Cleantech"], size: ["Less than $50k"] }), ANSWERS);
    expect(hit?.fit).toBe(65);   // 30 + 20 + 15
    expect(miss?.fit).toBe(45);  // 30 + 15
  });

  it("matches investor type when a specific type is selected", () => {
    const answers: FitAnswers = { ...ANSWERS, investorType: ["vc"] };
    const hit = scoreRow(inv({ company: "V", industries: ["Cleantech"], invTypes: ["Venture Capital"] }), answers);
    const miss = scoreRow(inv({ company: "A", industries: ["Cleantech"], invTypes: ["Angel"] }), answers);
    expect(hit?.fit).toBe(45);  // 30 + 15 (type overlap)
    expect(miss?.fit).toBe(30); // 30, no type overlap
  });
});

describe("rankRows", () => {
  it("keeps sector-matching firms sorted by fit, and excludes off-sector", () => {
    const out = rankRows([
      inv({ company: "Strong", industries: ["Cleantech"], stage: ["Expand Growth"], size: ["$1m - $10m"], revenue: ["$1m - $10m"] }), // 100
      inv({ company: "SectorOnly", industries: ["Cleantech"] }), // 35 → shows (industry hard filter passed)
      inv({ company: "OffSector", industries: ["Biotech"] }), // no sector overlap → excluded
    ], ANSWERS);
    expect(out.map((r) => r.company)).toEqual(["Strong", "SectorOnly"]);
  });

  it("returns one row per firm, preferring verified over self_reported", () => {
    const out = rankRows([
      inv({ id: "1", company: "Ridge Partners", source: "self_reported", industries: ["Cleantech"], stage: ["Expand Growth"], size: ["$1m - $10m"] }),
      inv({ id: "2", company: "ridge partners", source: "verified", industries: ["Cleantech"], stage: ["Expand Growth"], size: ["$1m - $10m"] }),
    ], ANSWERS);
    expect(out).toHaveLength(1); // deduped by normalised company
  });
});

describe("low-confidence gate", () => {
  const base = { id: "g1", company: "Acme", inv_source: null, inv_verified_at: null };
  const r = (overrides: Record<string, unknown>) => ({ ...base, raw: { __profile: { industries: [], investorTypes: ["Angel"] } }, overrides });
  it("holds back an industry tagged inferred:low unless allowed", () => {
    const row = r({ Industries: ["Fintech"], _industry_source: "inferred:low" });
    expect(fieldsOf(row).industries).toEqual([]);
    expect(fieldsOf(row, { includeLow: true }).industries).toEqual(["Fintech"]);
  });
  it("keeps untagged, stated and higher-confidence values as before", () => {
    expect(fieldsOf(r({ Industries: ["Fintech"] })).industries).toEqual(["Fintech"]);
    expect(fieldsOf(r({ Industries: ["Fintech"], _industry_source: "inferred:medium" })).industries).toEqual(["Fintech"]);
    expect(fieldsOf(r({ Industries: ["Fintech"], _industry_source: "stated:pitchbook" })).industries).toEqual(["Fintech"]);
  });
  it("falls back to the Odoo type when the override type is low confidence", () => {
    expect(fieldsOf(r({ "Investor type": ["VC"], _type_source: "inferred:low" })).types).toEqual(["Angel"]);
  });
});

describe("one weight table", () => {
  const engine = { sector: 40, stage: 10, checkSize: 10, geography: 10, investorType: 10, capitalType: 10, activeRating: 10, arr: 5, mrr: 5 };
  it("maps engine weights onto the /fit factors, ARR and MRR together as revenue", () => {
    expect(fitWeightsFromEngine(engine)).toEqual({ industry: 40, stage: 10, size: 10, type: 10, revenue: 10 });
  });
  it("scores as a percentage of the table's total", () => {
    const w = fitWeightsFromEngine(engine); // total 80
    const r = scoreFields(fieldsOf(inv({ company: "IndustryOnly", industries: ["Cleantech"] })), ANSWERS, w);
    // industry 40 + open-to-any type 10 = 50 of 80
    expect(r!.fit).toBe(63);
  });
  it("keeps today's scores when no table is passed", () => {
    const r = scoreRow(inv({ company: "IndustryOnly", industries: ["Cleantech"] }), ANSWERS);
    expect(r!.fit).toBe(45);
  });
  it("still lets a sector-only match pass with the table's weights", () => {
    const out = rankRows([inv({ company: "OnlySector", industries: ["Cleantech"], invTypes: ["Angel"] })], { ...ANSWERS, investorType: ["vc"] }, fitWeightsFromEngine(engine));
    expect(out.map((m) => m.company)).toEqual(["OnlySector"]);
  });
});

describe("rankRows with excludeSizeMismatch (/fit v2)", () => {
  const rows = [
    inv({ company: "Fits", industries: ["Cleantech"], size: ["$1m - $10m"] }),
    inv({ company: "Too small", industries: ["Cleantech"], size: ["$100k - $250k"] }),
    inv({ company: "Tiny", industries: ["Cleantech"], size: ["Less than $50k"] }),
    inv({ company: "Unknown size", industries: ["Cleantech"] }),
  ];

  it("leaves v1 ranking unchanged by default", () => {
    expect(rankRows(rows, ANSWERS).map((r) => r.company).sort()).toEqual(["Fits", "Tiny", "Too small", "Unknown size"]);
  });

  it("drops only investors whose stated check size cannot fit the raise", () => {
    const names = rankRows(rows, ANSWERS, undefined, { excludeSizeMismatch: true }).map((r) => r.company).sort();
    expect(names).toEqual(["Fits", "Unknown size"]);
  });
});
