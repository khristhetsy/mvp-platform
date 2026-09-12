import { describe, it, expect } from "vitest";
import { toIndexRow } from "./match-index";
import { scoreFields, rankScorables, scoreRow, fieldsOf, type GatedRow } from "./match-investors";
import { OP_STAGE_LABEL, OP_STAGE_LABEL_ALT, INV_SIZE_LABEL, REVENUE_LABEL, type FitAnswers } from "./options";

function row(over: Partial<GatedRow> & { industries?: string[]; extra?: Record<string, unknown>; types?: string[] } = {}): GatedRow {
  const { industries = ["Fintech"], extra = {}, types = [], ...rest } = over;
  return {
    id: "c1", company: "Acme Capital", inv_source: null, inv_verified_at: null,
    overrides: null,
    raw: { __profile: { industries, investorTypes: types, extra } },
    ...rest,
  } as GatedRow;
}

const answers = (o: Partial<FitAnswers> = {}): FitAnswers => ({
  stage: [], raise: [], industry: ["Fintech"], revenue: [], investorType: ["any"], ...o,
});

describe("toIndexRow", () => {
  it("projects the five scoring fields", () => {
    const r = toIndexRow(row({
      types: ["Angel"],
      extra: {
        [OP_STAGE_LABEL]: ["Startup"],
        [INV_SIZE_LABEL]: ["$50k - $100k"],
        [REVENUE_LABEL]: ["Less than $50k"],
      },
    }), "2026-09-12T00:00:00.000Z")!;
    expect(r.contact_id).toBe("c1");
    expect(r.industries).toEqual(["Fintech"]);
    expect(r.stages).toEqual(["Startup"]);
    expect(r.sizes).toEqual(["$50k - $100k"]);
    expect(r.types).toEqual(["Angel"]);
    expect(r.revenues).toEqual(["Less than $50k"]);
  });
  it("normalises company_key for firm de-dup", () => {
    expect(toIndexRow(row({ company: "  Acme Capital  " }))!.company_key).toBe("acme capital");
  });
  it("skips rows the matcher could never return", () => {
    expect(toIndexRow(row({ company: null }))).toBeNull();       // firm de-dup drops these
    expect(toIndexRow(row({ company: "   " }))).toBeNull();
    expect(toIndexRow(row({ industries: [] }))).toBeNull();      // hard filter excludes these
  });
  it("honours overrides over the Odoo profile, like the matcher does", () => {
    const r = toIndexRow(row({
      industries: ["Fintech"],
      overrides: { Industries: ["Healthcare"], [OP_STAGE_LABEL]: ["Prototype"] },
    } as Partial<GatedRow>))!;
    expect(r.industries).toEqual(["Healthcare"]);
    expect(r.stages).toEqual(["Prototype"]);
  });
});

describe("operating stage is read from either label", () => {
  // Two labels for one concept is why an approved stage scored nothing: enrichment wrote
  // the entrepreneur-side key, the profile row read the investor-side one.
  const a = answers({ stage: ["pre_revenue"] });

  // 30 industry + 25 stage + 15 type ("Open to any" imposes no constraint, so it scores).
  const WITH_STAGE = 70;
  it("scores a stage stored under the entrepreneur label", () => {
    expect(scoreRow(row({ extra: { [OP_STAGE_LABEL]: ["Startup"] } }), a)!.fit).toBe(WITH_STAGE);
  });
  it("scores a stage stored under the investor-preferences label", () => {
    expect(scoreRow(row({ extra: { [OP_STAGE_LABEL_ALT]: ["Startup"] } }), a)!.fit).toBe(WITH_STAGE);
  });
  it("scores 25 less when neither label carries a stage", () => {
    expect(scoreRow(row({ extra: {} }), a)!.fit).toBe(WITH_STAGE - 25);
  });
  it("unions both without double counting", () => {
    const f = fieldsOf(row({ extra: { [OP_STAGE_LABEL]: ["Startup"], [OP_STAGE_LABEL_ALT]: ["Startup", "Prototype"] } }));
    expect(f.stages.sort()).toEqual(["Prototype", "Startup"]);
  });
  it("carries both into the index projection", () => {
    expect(toIndexRow(row({ extra: { [OP_STAGE_LABEL_ALT]: ["Expand Growth"] } }))!.stages).toEqual(["Expand Growth"]);
  });
});

describe("index path scores identically to the wide-scan path", () => {
  // The whole risk of a derived table is drift. Both paths must agree exactly.
  const wide = row({
    types: ["Angel"],
    extra: {
      [OP_STAGE_LABEL]: ["Startup"],
      [INV_SIZE_LABEL]: ["$50k - $100k"],
      [REVENUE_LABEL]: ["Less than $50k"],
    },
  });
  const a = answers({ stage: ["pre_revenue"], raise: ["under_1m"], revenue: ["pre_revenue"], investorType: ["angel"] });

  it("produces the same fit and summary", () => {
    const viaWide = scoreRow(wide, a)!;
    const idx = toIndexRow(wide)!;
    const viaIndex = scoreFields({
      industries: idx.industries, stages: idx.stages, sizes: idx.sizes, types: idx.types, revenues: idx.revenues,
    }, a)!;
    expect(viaIndex.fit).toBe(viaWide.fit);
    expect(viaIndex.summary).toBe(viaWide.summary);
    expect(viaWide.fit).toBe(100);
  });
  it("fieldsOf and toIndexRow agree field for field", () => {
    const f = fieldsOf(wide);
    const idx = toIndexRow(wide)!;
    expect(idx.industries).toEqual(f.industries);
    expect(idx.stages).toEqual(f.stages);
    expect(idx.sizes).toEqual(f.sizes);
    expect(idx.types).toEqual(f.types);
    expect(idx.revenues).toEqual(f.revenues);
  });
});

describe("rankScorables", () => {
  const fields = (industries: string[]) => ({ industries, stages: [], sizes: [], types: [], revenues: [] });

  it("keeps one row per firm, preferring the more trusted source", () => {
    const out = rankScorables([
      { id: "a", company: "Acme Capital", inv_source: "inferred", inv_verified_at: null, fields: fields(["Fintech"]) },
      { id: "b", company: "acme capital", inv_source: "verified", inv_verified_at: null, fields: fields(["Fintech"]) },
    ], answers());
    expect(out).toHaveLength(1);
    expect(out[0].contactId).toBe("b");
  });
  it("applies the industry hard filter", () => {
    const out = rankScorables([
      { id: "a", company: "Acme", inv_source: null, inv_verified_at: null, fields: fields(["Real Estate"]) },
    ], answers());
    expect(out).toEqual([]);
  });
});
