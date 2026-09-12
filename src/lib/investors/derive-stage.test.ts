import { describe, it, expect } from "vitest";
import { ruleFor, typesOf, hasAnyStage, summarise, STAGE_RULES } from "./derive-stage";
import { OP_STAGE_LABEL, OP_STAGE_LABEL_ALT, Q1_STAGE } from "@/lib/fit/options";
import { STAGE_VOCAB } from "@/lib/fit/enrich-investors";

const row = (o: { types?: string[]; ovTypes?: string[]; extra?: Record<string, unknown>; overrides?: Record<string, unknown> } = {}) => ({
  id: "c1", company: "Acme",
  raw: { __profile: { investorTypes: o.types ?? [], extra: o.extra ?? {} } },
  overrides: { ...(o.ovTypes ? { "Investor type": o.ovTypes } : {}), ...(o.overrides ?? {}) },
});

describe("typesOf", () => {
  it("prefers overrides over the Odoo profile", () => {
    expect(typesOf(row({ types: ["VC"], ovTypes: ["Angel"] }))).toEqual(["Angel"]);
  });
  it("handles Odoo [id, label] pairs", () => {
    expect(typesOf(row({ types: [["7", "Family Office"] as unknown as string] }))).toEqual(["Family Office"]);
  });
});

describe("hasAnyStage", () => {
  it("sees a stage under either label, in overrides or raw", () => {
    expect(hasAnyStage(row({ extra: { [OP_STAGE_LABEL]: ["Startup"] } }))).toBe(true);
    expect(hasAnyStage(row({ extra: { [OP_STAGE_LABEL_ALT]: ["Startup"] } }))).toBe(true);
    expect(hasAnyStage(row({ overrides: { [OP_STAGE_LABEL]: ["Startup"] } }))).toBe(true);
    expect(hasAnyStage(row())).toBe(false);
  });
  it("treats an empty array as no stage", () => {
    expect(hasAnyStage(row({ extra: { [OP_STAGE_LABEL]: [] } }))).toBe(false);
  });
});

describe("ruleFor", () => {
  it("maps each type to its rule", () => {
    expect(ruleFor(row({ types: ["Angel"] }))?.id).toBe("derived:angel");
    expect(ruleFor(row({ types: ["Angel Investor"] }))?.id).toBe("derived:angel");
    expect(ruleFor(row({ types: ["Family Office"] }))?.id).toBe("derived:family_office");
    expect(ruleFor(row({ types: ["Private Equity"] }))?.id).toBe("derived:private_equity");
    expect(ruleFor(row({ types: ["Venture Capital"] }))?.id).toBe("derived:vc");
    expect(ruleFor(row({ types: ["VC"] }))?.id).toBe("derived:vc");
  });
  it("is case-insensitive about the stored spelling", () => {
    expect(ruleFor(row({ types: ["private equity"] }))?.id).toBe("derived:private_equity");
  });
  it("NEVER overwrites an existing stage", () => {
    // The core safety property: a stated or AI-extracted stage always wins.
    expect(ruleFor(row({ types: ["Angel"], extra: { [OP_STAGE_LABEL]: ["Midsize Company"] } }))).toBeNull();
    expect(ruleFor(row({ types: ["Angel"], overrides: { [OP_STAGE_LABEL_ALT]: ["Midsize Company"] } }))).toBeNull();
  });
  it("skips contacts with no type, or a type with no rule", () => {
    expect(ruleFor(row({ types: [] }))).toBeNull();
    expect(ruleFor(row({ types: ["Accelerator"] }))).toBeNull();
    expect(ruleFor(row({ types: ["Hedge Fund"] }))).toBeNull();
  });
});

describe("the rules themselves", () => {
  it("only write stage values the matcher can compare", () => {
    // A value outside STAGE_VOCAB would store fine and then never match anything.
    for (const rule of STAGE_RULES) {
      for (const s of rule.stages) expect(STAGE_VOCAB as readonly string[]).toContain(s);
    }
  });
  it("cover every founder stage answer between them", () => {
    const written = new Set(STAGE_RULES.flatMap((r) => r.stages));
    for (const option of Q1_STAGE) {
      expect(option.stored.some((s) => written.has(s)), `no rule can match "${option.label}"`).toBe(true);
    }
  });
  it("keeps Angel out of the later bands and PE out of pre-revenue", () => {
    const angel = STAGE_RULES.find((r) => r.id === "derived:angel")!;
    const pe = STAGE_RULES.find((r) => r.id === "derived:private_equity")!;
    expect(angel.stages).not.toContain("Midsize Company");
    expect(pe.stages).not.toContain("Startup");
  });
  it("gives VC every band, so seed VCs are not excluded from pre-revenue founders", () => {
    const vc = STAGE_RULES.find((r) => r.id === "derived:vc")!;
    expect(vc.stages).toContain("Startup");
    expect(vc.stages).toContain("Midsize Company");
  });
  it("has unique rule ids, so undo targets exactly one rule", () => {
    expect(new Set(STAGE_RULES.map((r) => r.id)).size).toBe(STAGE_RULES.length);
  });
});

describe("summarise", () => {
  it("counts the plan per rule", () => {
    expect(summarise([
      { contactId: "1", company: null, ruleId: "derived:angel", stages: [] },
      { contactId: "2", company: null, ruleId: "derived:angel", stages: [] },
      { contactId: "3", company: null, ruleId: "derived:vc", stages: [] },
    ])).toEqual({ "derived:angel": 2, "derived:vc": 1 });
  });
});
