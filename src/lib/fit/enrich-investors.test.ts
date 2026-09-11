import { describe, it, expect } from "vitest";
import { parseProposal } from "./enrich-investors";

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
  it("returns null on no JSON / bad JSON", () => {
    expect(parseProposal("no json here")).toBeNull();
    expect(parseProposal("{not valid}")).toBeNull();
    expect(parseProposal("")).toBeNull();
  });
});
