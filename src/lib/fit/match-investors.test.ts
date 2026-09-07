import { describe, it, expect } from "vitest";
import { scoreRow, rankRows } from "./match-investors";
import { OP_STAGE_LABEL, INV_SIZE_LABEL, REVENUE_LABEL, type FitAnswers } from "./options";

function inv(opts: {
  id?: string;
  company: string;
  industries?: string[];
  stage?: string[];
  size?: string[];
  revenue?: string[];
  source?: string;
  verifiedAt?: string;
}) {
  return {
    id: opts.id ?? opts.company,
    company: opts.company,
    inv_source: opts.source ?? "verified",
    inv_verified_at: opts.verifiedAt ?? "2026-09-01T00:00:00Z",
    raw: {
      __profile: {
        industries: opts.industries ?? [],
        extra: {
          [OP_STAGE_LABEL]: opts.stage ?? [],
          [INV_SIZE_LABEL]: opts.size ?? [],
          [REVENUE_LABEL]: opts.revenue ?? [],
        },
      },
    },
  };
}

const ANSWERS: FitAnswers = { stage: "revenue_pre_a", raise: "1m_10m", industry: "Cleantech", revenue: "1m_5m" };

describe("scoreRow", () => {
  it("scores a full match at 100", () => {
    const r = scoreRow(inv({ company: "Meridian", industries: ["Cleantech"], stage: ["Expand Growth"], size: ["$1m - $10m"], revenue: ["$1m - $10m"] }), ANSWERS);
    expect(r?.fit).toBe(100);
  });

  it("hard-filters a firm with no sector overlap (returns null)", () => {
    const r = scoreRow(inv({ company: "OffSector", industries: ["Biotech"], stage: ["Expand Growth"] }), ANSWERS);
    expect(r).toBeNull();
  });

  it("industry alone is 35 (below the 70 pass threshold)", () => {
    const r = scoreRow(inv({ company: "IndustryOnly", industries: ["Cleantech"] }), ANSWERS);
    expect(r?.fit).toBe(35);
  });

  it("adds the investment weight only when the raise overlaps a stored band", () => {
    const hit = scoreRow(inv({ company: "A", industries: ["Cleantech"], size: ["$1m - $10m"] }), ANSWERS);
    const miss = scoreRow(inv({ company: "B", industries: ["Cleantech"], size: ["Less than $50k"] }), ANSWERS);
    expect(hit?.fit).toBe(60);   // 35 + 25
    expect(miss?.fit).toBe(35);  // 35 only
  });
});

describe("rankRows", () => {
  it("keeps only firms at or above the pass threshold, sorted by fit", () => {
    const out = rankRows([
      inv({ company: "Strong", industries: ["Cleantech"], stage: ["Expand Growth"], size: ["$1m - $10m"], revenue: ["$1m - $10m"] }), // 100
      inv({ company: "Weak", industries: ["Cleantech"], size: ["Less than $50k"] }), // 35 → dropped
    ], ANSWERS);
    expect(out.map((r) => r.company)).toEqual(["Strong"]);
  });

  it("returns one row per firm, preferring verified over self_reported", () => {
    const out = rankRows([
      inv({ id: "1", company: "Ridge Partners", source: "self_reported", industries: ["Cleantech"], stage: ["Expand Growth"], size: ["$1m - $10m"] }),
      inv({ id: "2", company: "ridge partners", source: "verified", industries: ["Cleantech"], stage: ["Expand Growth"], size: ["$1m - $10m"] }),
    ], ANSWERS);
    expect(out).toHaveLength(1); // deduped by normalised company
  });
});
