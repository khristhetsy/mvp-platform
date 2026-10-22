import { describe, expect, it } from "vitest";
import {
  announcementFor, changeOf, evidenceFlags, claimsFor, csvRow, emailFor, isFullyProven, isMeasured, missingFor,
  monthsBetween, proofStats, signed, statementOf, type ProofCompany, type ProofScore,
} from "@/lib/crr/proof";
import type { Dimension } from "@/lib/crr/profiles";

const dims = (n: number): Record<Dimension, number> => ({ narrative: n, team: n, financial: n, traction: n, capTable: n });
const score = (s: number, at: string): ProofScore => ({ score: s, at, band: s >= 75 ? "Strong" : s >= 60 ? "Solid" : s >= 40 ? "Developing" : "Early", dims: dims(s) });

function company(over: Omit<Partial<ProofCompany>, "first" | "latest"> & { id: string; first?: [number, string]; latest?: [number, string] }): ProofCompany {
  const first = over.first ? score(over.first[0], over.first[1]) : null;
  const latest = over.latest ? score(over.latest[0], over.latest[1]) : null;
  const history = over.history ?? [first, latest].filter(Boolean).map((s) => ({ score: s!.score, at: s!.at }));
  return {
    companyId: over.id,
    companyName: `Co ${over.id}`,
    founderName: `Founder ${over.id}`,
    founderEmail: null,
    industry: null,
    profile: "seed_institutional",
    profileLabel: "Seed",
    first, latest, history,
    quote: over.quote ?? "none",
    activity: over.activity === undefined ? null : over.activity,
    gaps: [],
  };
}

const A = company({ id: "a", first: [29, "2026-05-01T00:00:00Z"], latest: [76, "2026-10-01T00:00:00Z"], quote: "yes", activity: { meetings: 4, conversations: 7, intros: 2 } });
const B = company({ id: "b", first: [20, "2026-04-01T00:00:00Z"], latest: [60, "2026-10-01T00:00:00Z"], quote: "pending", activity: null });
const C = company({ id: "c", latest: [67, "2026-10-01T00:00:00Z"], history: [{ score: 67, at: "2026-10-01T00:00:00Z" }], quote: "none" });

describe("proof basics", () => {
  it("measures only companies with two or more score rows", () => {
    expect(isMeasured(A)).toBe(true);
    expect(isMeasured(C)).toBe(false);
    expect(changeOf(A)).toBe(47);
    expect(changeOf(C)).toBeNull();
  });

  it("counts whole months and never goes negative", () => {
    expect(monthsBetween("2026-05-01T00:00:00Z", "2026-10-01T00:00:00Z")).toBe(5);
    expect(monthsBetween("2026-10-01T00:00:00Z", "2026-05-01T00:00:00Z")).toBe(0);
    expect(monthsBetween("bad", "worse")).toBe(0);
  });

  it("signs numbers", () => {
    expect(signed(47)).toBe("+47");
    expect(signed(-2.04)).toBe("-2");
    expect(signed(0)).toBe("0");
  });
});

describe("proofStats", () => {
  const s = proofStats([A, B, C], 65);

  it("averages and medians only measured founders", () => {
    expect(s.total).toBe(3);
    expect(s.measured).toBe(2);
    expect(s.avg).toBe(43.5); // (47 + 40) / 2
    expect(s.median).toBe(43.5);
  });

  it("counts the gate at first and now", () => {
    expect(s.gateNow).toBe(2); // A 76, C 67
    expect(s.gateFirst).toBe(1); // C 67 is its only score
  });

  it("treats missing activity as none recorded, not zero", () => {
    expect(s.withActivity).toBe(1);
    expect(s.meetings).toBe(4);
    expect(s.conversations).toBe(7);
    expect(s.intros).toBe(2);
  });

  it("only A is proven on all three", () => {
    expect(isFullyProven(A)).toBe(true);
    expect(isFullyProven(B)).toBe(false);
    expect(s.fullyProven).toBe(1);
    expect(s.needs.map((x) => x.company.companyId)).toEqual(["c", "b"]); // C has three gaps, B two
  });

  it("has no statement without measured founders", () => {
    expect(statementOf(proofStats([C], 65))).toContain("No founder has a measured before and after");
    expect(statementOf(s)).toBe("2 founders, measured over 5 to 6 months, average CRR change +43.5 points.");
  });
});

describe("evidenceFlags", () => {
  it("flags weak baselines, short spans and tiny changes, only on measured founders", () => {
    expect(evidenceFlags(A)).toEqual([]);
    expect(evidenceFlags(C)).toEqual([]);
    const weak = company({ id: "w", first: [5, "2026-10-01T00:00:00Z"], latest: [8, "2026-10-10T00:00:00Z"] });
    expect(evidenceFlags(weak).map((f) => f.key)).toEqual(["low_baseline", "short_span", "tiny_change"]);
  });
});

describe("claims and copy", () => {
  it("marks a claim proven only when the platform holds the evidence", () => {
    const ok = claimsFor(A).map((c) => c.ok);
    expect(ok).toEqual([true, true, true, true]);
    const gaps = claimsFor(B).map((c) => c.ok);
    expect(gaps).toEqual([true, true, false, false]);
    expect(missingFor(C).map((m) => m.key)).toEqual(["baseline", "quote_none", "activity"]);
  });

  it("never claims iCapOS caused an outcome", () => {
    const text = [announcementFor(A), announcementFor(C), emailFor(A, proofStats([A], 65), ["x"]).body, emailFor(null, proofStats([A, B], 65), ["x"]).body].join("\n");
    expect(text).not.toMatch(/caused by|because of iCapOS|thanks to iCapOS/i);
    expect(text).toContain("do not claim that iCapOS caused");
  });

  it("announcement drops what it cannot prove", () => {
    expect(announcementFor(A)).toContain("from 29 to 76");
    expect(announcementFor(A)).toContain("agreed to be quoted");
    expect(announcementFor(B)).not.toContain("agreed to be quoted");
    expect(announcementFor(B)).toContain("No investor activity has been recorded yet");
    expect(announcementFor(C)).toContain("A before and after is needed");
  });

  it("builds the export row", () => {
    expect(csvRow(A)).toEqual(["Co a", "Founder a", "Seed", 29, 76, 47, 5, "yes", 4, 7, 2]);
    expect(csvRow(C)).toEqual(["Co c", "Founder c", "Seed", "", 67, "", "", "none", "", "", ""]);
  });
});
