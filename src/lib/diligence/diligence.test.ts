import { describe, it, expect } from "vitest";
import { computeConfidencePure } from "./confidence";
import { evaluateTransition, priorStage } from "./state-machine";
import { nextFindingCode } from "./codes";
import type { Severity } from "./types";

describe("computeConfidencePure (severity-weighted)", () => {
  it("is 0 with no verified claims", () => {
    expect(computeConfidencePure([{ verification: "unverified", weight: 1, finding_id: null }], {})).toBe(0);
  });

  it("is 100 when all claims verified", () => {
    expect(
      computeConfidencePure(
        [
          { verification: "verified", weight: 1, finding_id: null },
          { verification: "verified", weight: 2, finding_id: null },
        ],
        {},
      ),
    ).toBe(100);
  });

  it("counts high-severity-linked claims double", () => {
    const sev: Record<string, Severity> = { f1: "high", f2: "low" };
    // f1 (high) weight1 => effective 2 (verified); f2 (low) weight1 => effective 1 (unverified)
    // verified 2 / total 3 = 67
    const pct = computeConfidencePure(
      [
        { verification: "verified", weight: 1, finding_id: "f1" },
        { verification: "unverified", weight: 1, finding_id: "f2" },
      ],
      sev,
    );
    expect(pct).toBe(67);
  });

  it("treats a missing/low severity link as flat weight", () => {
    const pct = computeConfidencePure(
      [
        { verification: "verified", weight: 1, finding_id: "f1" },
        { verification: "unverified", weight: 1, finding_id: null },
      ],
      { f1: "medium" },
    );
    expect(pct).toBe(50);
  });
});

describe("evaluateTransition", () => {
  it("allows a legal admin transition", () => {
    expect(evaluateTransition("draft", "send_to_founder", "admin")).toEqual({ ok: true, to: "sent_to_founder" });
  });

  it("rejects from the wrong stage", () => {
    const r = evaluateTransition("responding", "send_to_founder", "admin");
    expect(r.ok).toBe(false);
  });

  it("rejects the wrong role", () => {
    const r = evaluateTransition("draft", "send_to_founder", "founder");
    expect(r.ok).toBe(false);
  });

  it("lets the founder advance after responding", () => {
    expect(evaluateTransition("sent_to_founder", "founder_responded", "founder")).toEqual({
      ok: true,
      to: "responding",
    });
  });
});

describe("priorStage", () => {
  it("steps one stage back", () => {
    expect(priorStage("admin_review")).toBe("responding");
  });
  it("is null at draft", () => {
    expect(priorStage("draft")).toBeNull();
  });
});

describe("nextFindingCode", () => {
  it("starts at F-001", () => {
    expect(nextFindingCode([])).toBe("F-001");
  });
  it("increments past the max", () => {
    expect(nextFindingCode(["F-001", "F-003", "F-002"])).toBe("F-004");
  });
  it("ignores malformed codes", () => {
    expect(nextFindingCode(["X-9", "F-005", "junk"])).toBe("F-006");
  });
});
