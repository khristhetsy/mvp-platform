import { describe, it, expect } from "vitest";
import { toPublicMatch, toPublicResponse } from "./public-match";
import type { MatchResult } from "./match-investors";
import type { FitAnswers } from "./options";

const answers: FitAnswers = { stage: ["revenue_pre_a"], raise: ["1m_10m"], industry: ["Artificial Intelligence", "AI"], revenue: ["under_1m"], investorType: ["any"] };

const row = (over: Partial<MatchResult> = {}): MatchResult => ({
  contactId: "c1", company: "Secret Capital LLC", summary: "", fit: 88,
  sectors: ["Software", "AI"], types: ["Venture Capital"], stage: "Startup, Expand Growth",
  checkSize: "$1m - $10m", revenue: null, score: 40, tier: "B", ...over,
});

describe("toPublicMatch", () => {
  it("never exposes the firm name or contact id", () => {
    const p = toPublicMatch(row(), answers, 0);
    expect(JSON.stringify(p)).not.toContain("Secret Capital");
    expect(JSON.stringify(p)).not.toContain("c1");
    expect(p.key).toBe("m1");
  });

  it("describes type, the overlapping sector, check size and stage", () => {
    const p = toPublicMatch(row(), answers, 0);
    expect(p.title).toBe("Venture fund, AI focus");
    expect(p.detail).toBe("Checks $1m - $10m · Startup, Expand Growth");
    expect(p.fit).toBe(88);
  });

  it("falls back to a generic label when type and data are missing", () => {
    const p = toPublicMatch(row({ types: [], sectors: [], checkSize: null, stage: null }), answers, 2);
    expect(p).toEqual({ key: "m3", title: "Investor", detail: "", fit: 88 });
  });
});

describe("toPublicResponse", () => {
  it("marks zero matches as thin and keeps totals", () => {
    const r = toPublicResponse({ matched_count: 0, top: [], locked_count: 0, thin: true, network_total: 7187 }, answers);
    expect(r).toEqual({ matched_count: 0, top: [], thin: true, network_total: 7187 });
  });
});
