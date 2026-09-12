import { describe, it, expect } from "vitest";
import { parseProposal, normalizeStages, STAGE_VOCAB } from "./enrich-investors";
import { Q1_STAGE } from "./options";

describe("parseProposal", () => {
  it("parses clean JSON", () => {
    const p = parseProposal('{"industries":["Fintech","SaaS"],"investorType":"VC","confidence":88,"rationale":"name + domain"}')!;
    expect(p.industries).toEqual(["Fintech", "SaaS"]);
    expect(p.investorType).toBe("VC");
    expect(p.confidence).toBe(88);
  });
  it("tolerates code fences / prose around the JSON", () => {
    const p = parseProposal('Here you go:\n```json\n{"industries":["Healthcare"],"investorType":"Angel","confidence":72}\n```')!;
    expect(p.industries).toEqual(["Healthcare"]);
    expect(p.investorType).toBe("Angel");
    expect(p.confidence).toBe(72);
  });
  it("clamps confidence to 0–100 and rounds", () => {
    expect(parseProposal('{"industries":[],"confidence":140}')!.confidence).toBe(100);
    expect(parseProposal('{"industries":[],"confidence":-5}')!.confidence).toBe(0);
    expect(parseProposal('{"industries":[],"confidence":"73.6"}')!.confidence).toBe(74);
  });
  it("normalizes empty / unknown type to null", () => {
    expect(parseProposal('{"industries":["X"],"investorType":"unknown","confidence":10}')!.investorType).toBeNull();
    expect(parseProposal('{"industries":["X"],"confidence":10}')!.investorType).toBeNull();
  });
  it("accepts snake_case investor_type", () => {
    expect(parseProposal('{"industries":[],"investor_type":"Family Office","confidence":50}')!.investorType).toBe("Family Office");
  });
  it("clamps the type to a spelling the matcher compares against", () => {
    expect(parseProposal('{"industries":[],"investorType":"Corporate VC","confidence":50}')!.investorType).toBe("Corporate Venture");
    expect(parseProposal('{"industries":[],"investorType":"Hedge Fund","confidence":50}')!.investorType).toBeNull();
  });
  it("returns null on no JSON / bad JSON", () => {
    expect(parseProposal("no json here")).toBeNull();
    expect(parseProposal("{not valid}")).toBeNull();
    expect(parseProposal("")).toBeNull();
  });

  it("carries a stated thesis stage through, and defaults to none", () => {
    const p = parseProposal('{"industries":["SaaS"],"stages":["Startup","Prototype"],"confidence":92,"rationale":"\\"we lead pre-seed and seed rounds\\""}')!;
    expect(p.stages).toEqual(["Startup", "Prototype"]);
    expect(parseProposal('{"industries":["SaaS"],"confidence":50}')!.stages).toEqual([]);
  });
  it("accepts a singular stage key", () => {
    expect(parseProposal('{"industries":[],"stage":"Expand Growth","confidence":40}')!.stages).toEqual(["Expand Growth"]);
  });
});

describe("ClaudeUnavailableError", () => {
  it("is distinguishable from a null (nothing-found) result", async () => {
    // The whole point: an outage must not be recorded as "this investor has no signal",
    // which would reject the contact permanently.
    const { ClaudeUnavailableError } = await import("./enrich-investors");
    const e = new ClaudeUnavailableError("out of credits");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("ClaudeUnavailableError");
    expect(e instanceof ClaudeUnavailableError).toBe(true);
  });
});

describe("normalizeStages", () => {
  it("drops anything outside the vocabulary", () => {
    // A model that free-styles ("Seed", "Series A") must not reach the contact — those
    // strings would be stored and then silently never match.
    expect(normalizeStages(["Seed", "Series A", "Startup"])).toEqual(["Startup"]);
    expect(normalizeStages(["pre-seed"])).toEqual([]);
  });
  it("is case-insensitive and dedupes, returning vocabulary order", () => {
    expect(normalizeStages(["prototype", "STARTUP", "Startup"])).toEqual(["Startup", "Prototype"]);
  });
  it("handles non-array and empty input", () => {
    expect(normalizeStages("Small Business")).toEqual(["Small Business"]);
    expect(normalizeStages(null)).toEqual([]);
    expect(normalizeStages([])).toEqual([]);
  });
  it("covers exactly the values the /fit funnel maps founders onto", () => {
    // If Q1_STAGE gains an option, the vocabulary must gain it too or that founder
    // answer can never be filled by enrichment.
    const fromFunnel = new Set(Q1_STAGE.flatMap((o) => o.stored));
    for (const s of fromFunnel) expect(STAGE_VOCAB as readonly string[]).toContain(s);
  });
});
