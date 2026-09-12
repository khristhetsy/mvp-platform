import { describe, it, expect } from "vitest";
import { ruleFor, fillsFor, typesOf, hasFieldValue, summarise, TYPE_RULES, EBITDA_LABEL } from "./derive-from-type";
import { OP_STAGE_LABEL, OP_STAGE_LABEL_ALT, INV_SIZE_LABEL, REVENUE_LABEL, Q1_STAGE } from "@/lib/fit/options";
import { STAGE_VOCAB } from "@/lib/fit/enrich-investors";

const row = (o: { types?: string[]; ovTypes?: string[]; extra?: Record<string, unknown>; overrides?: Record<string, unknown> } = {}) => ({
  id: "c1", company: "Acme",
  raw: { __profile: { investorTypes: o.types ?? [], extra: o.extra ?? {} } },
  overrides: { ...(o.ovTypes ? { "Investor type": o.ovTypes } : {}), ...(o.overrides ?? {}) },
});
const fields = (r: ReturnType<typeof row>) => fillsFor(r).map((f) => f.field).sort();

describe("typesOf", () => {
  it("prefers overrides over the Odoo profile", () => {
    expect(typesOf(row({ types: ["VC"], ovTypes: ["Angel"] }))).toEqual(["Angel"]);
  });
  it("handles Odoo [id, label] pairs", () => {
    expect(typesOf(row({ types: [["7", "Family Office"] as unknown as string] }))).toEqual(["Family Office"]);
  });
});

describe("ruleFor", () => {
  it("maps every known spelling to its rule", () => {
    expect(ruleFor(row({ types: ["Angel"] }))?.id).toBe("derived:angel");
    expect(ruleFor(row({ types: ["Angel Investor"] }))?.id).toBe("derived:angel");
    expect(ruleFor(row({ types: ["Family Office"] }))?.id).toBe("derived:family_office");
    expect(ruleFor(row({ types: ["PE"] }))?.id).toBe("derived:private_equity");
    expect(ruleFor(row({ types: ["Venture Capital"] }))?.id).toBe("derived:vc");
    expect(ruleFor(row({ types: ["venture capital"] }))?.id).toBe("derived:vc");
  });
  it("skips a contact with no type, or a type with no rule", () => {
    expect(ruleFor(row({ types: [] }))).toBeNull();
    expect(ruleFor(row({ types: ["Accelerator"] }))).toBeNull();
    expect(ruleFor(row({ types: ["Hedge Fund"] }))).toBeNull();
  });
});

describe("hasFieldValue — the never-overwrite guard", () => {
  const stageFill = TYPE_RULES[0].fills[0];
  it("sees a value under either stage label, in overrides or raw", () => {
    expect(hasFieldValue(row({ extra: { [OP_STAGE_LABEL]: ["Startup"] } }), stageFill)).toBe(true);
    expect(hasFieldValue(row({ extra: { [OP_STAGE_LABEL_ALT]: ["Startup"] } }), stageFill)).toBe(true);
    expect(hasFieldValue(row({ overrides: { [OP_STAGE_LABEL]: ["Startup"] } }), stageFill)).toBe(true);
  });
  it("sees a value stored under a RENAMED label, via keywords", () => {
    // A renamed label still holds a real value; overwriting it would destroy information.
    expect(hasFieldValue(row({ extra: { "Preferred operating stage of company?": ["Startup"] } }), stageFill)).toBe(true);
  });
  it("treats empty and absent alike", () => {
    expect(hasFieldValue(row({ extra: { [OP_STAGE_LABEL]: [] } }), stageFill)).toBe(false);
    expect(hasFieldValue(row(), stageFill)).toBe(false);
  });
});

describe("fillsFor", () => {
  it("gives Angel only a stage", () => {
    expect(fields(row({ types: ["Angel"] }))).toEqual(["stage"]);
  });
  it("gives Private Equity all four fields", () => {
    expect(fields(row({ types: ["Private Equity"] }))).toEqual(["ebitda", "revenue", "size", "stage"]);
  });
  it("fills only what is missing — the rest is left alone", () => {
    const r = row({ types: ["Private Equity"], extra: { [INV_SIZE_LABEL]: ["$1m - $10m"], [OP_STAGE_LABEL]: ["Midsize Company"] } });
    expect(fields(r)).toEqual(["ebitda", "revenue"]);
  });
  it("plans nothing when every field is already populated", () => {
    const r = row({ types: ["Private Equity"], extra: {
      [OP_STAGE_LABEL]: ["Midsize Company"], [INV_SIZE_LABEL]: ["$1m - $10m"],
      [REVENUE_LABEL]: ["$1m - $10m"], [EBITDA_LABEL]: ["$1m - $10m"],
    } });
    expect(fillsFor(r)).toEqual([]);
  });
  it("writes to the canonical label even when it matched on a keyword", () => {
    const [fill] = fillsFor(row({ types: ["Angel"] }));
    expect(fill.label).toBe(OP_STAGE_LABEL);
  });
});

describe("the rules themselves", () => {
  it("only emit stage values the matcher can compare", () => {
    for (const rule of TYPE_RULES) {
      for (const f of rule.fills.filter((x) => x.field === "stage")) {
        for (const v of f.values) expect(STAGE_VOCAB as readonly string[]).toContain(v);
      }
    }
  });
  it("cover every founder stage answer between them", () => {
    const written = new Set(TYPE_RULES.flatMap((r) => r.fills.filter((f) => f.field === "stage")).flatMap((f) => f.values));
    for (const option of Q1_STAGE) {
      expect(option.stored.some((s) => written.has(s)), `no rule can match "${option.label}"`).toBe(true);
    }
  });
  it("uses the right top band per field — the two vocabularies differ", () => {
    const pe = TYPE_RULES.find((r) => r.id === "derived:private_equity")!;
    expect(pe.fills.find((f) => f.field === "size")!.values).toContain("$100m+");
    expect(pe.fills.find((f) => f.field === "revenue")!.values).toContain("Over $100m");
  });
  it("marks EBITDA as scoring nothing, so the UI can say so", () => {
    const pe = TYPE_RULES.find((r) => r.id === "derived:private_equity")!;
    expect(pe.fills.find((f) => f.field === "ebitda")!.weight).toBe(0);
    expect(pe.fills.find((f) => f.field === "size")!.weight).toBe(20);
  });
  it("keeps Angel early and PE out of pre-revenue, and gives VC every band", () => {
    const stagesOf = (id: string) => TYPE_RULES.find((r) => r.id === id)!.fills.find((f) => f.field === "stage")!.values;
    expect(stagesOf("derived:angel")).not.toContain("Midsize Company");
    expect(stagesOf("derived:private_equity")).not.toContain("Startup");
    expect(stagesOf("derived:vc")).toContain("Startup");
    expect(stagesOf("derived:vc")).toContain("Midsize Company");
  });
  it("gives every rule/field pair a distinct provenance tag, so undo is surgical", () => {
    const pairs = TYPE_RULES.flatMap((r) => r.fills.map((f) => `${r.id}|${f.sourceKey}`));
    expect(new Set(pairs).size).toBe(pairs.length);
  });
});

describe("summarise", () => {
  it("counts per rule and field", () => {
    expect(summarise([
      { contactId: "1", company: null, ruleId: "derived:angel", field: "stage", label: "l", values: [], sourceKey: "s" },
      { contactId: "2", company: null, ruleId: "derived:angel", field: "stage", label: "l", values: [], sourceKey: "s" },
      { contactId: "3", company: null, ruleId: "derived:private_equity", field: "size", label: "l", values: [], sourceKey: "s" },
    ])).toEqual({ "derived:angel": { stage: 2 }, "derived:private_equity": { size: 1 } });
  });
});
