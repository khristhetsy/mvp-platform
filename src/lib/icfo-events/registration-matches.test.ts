import { describe, it, expect } from "vitest";
import { rankMatches, type PoolEntry } from "@/lib/icfo-events/registration-matches";

const inv = (investorType: string, sectors: string[], extra: Record<string, unknown> = {}): PoolEntry => ({ role: "investor", answers: { investorType, sectors, ...extra } });
const fnd = (stage: string, sector: string): PoolEntry => ({ role: "founder", answers: { stage, sector } });

describe("matches with other registrations", () => {
  const pool = [
    inv("Angel", ["FinTech", "SaaS / B2B Software"], { name: "Jane Doe", email: "jane@x.com", company: "Acme" }),
    inv("Venture Capital", ["FinTech"]),
    inv("Family Office", ["HealthTech"]),
    fnd("Seed", "FinTech"),
  ];

  it("ranks by the event rule: more shared sectors and role fit first", () => {
    const m = rankMatches({ role: "founder", sectors: ["FinTech", "SaaS / B2B Software"] }, pool);
    expect(m.map((x) => x.type)).toEqual(["Angel", "Venture Capital", "Seed"]);
    expect(m[0]).toMatchObject({ role: "investor", shared: ["FinTech", "SaaS / B2B Software"], strength: "Strong" });
  });

  it("needs at least one shared sector, so role fit alone never lists someone", () => {
    const m = rankMatches({ role: "founder", sectors: ["FinTech"] }, pool);
    expect(m.some((x) => x.type === "Family Office")).toBe(false);
  });

  it("never returns a name, company or contact detail", () => {
    const m = rankMatches({ role: "founder", sectors: ["FinTech"] }, pool);
    const text = JSON.stringify(m);
    expect(text).not.toContain("Jane");
    expect(text).not.toContain("jane@x.com");
    expect(text).not.toContain("Acme");
  });

  it("reads a founder's several sectors", () => {
    const m = rankMatches({ role: "investor", sectors: ["HealthTech"] }, [{ role: "founder", answers: { stage: "Seed", sectors: ["FinTech", "HealthTech"], sector: "FinTech" } }]);
    expect(m).toHaveLength(1);
    expect(m[0].shared).toEqual(["HealthTech"]);
  });

  it("returns nothing for no sectors", () => {
    expect(rankMatches({ role: "founder", sectors: [] }, pool)).toEqual([]);
  });
});
