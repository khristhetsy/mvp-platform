import { describe, expect, it } from "vitest";
import { buildParts } from "./draft";
import { acceptGuidance, applyGuidance, buildGuidancePrompt, parseGuidance, pickExamples } from "./guidance";
import { draftViolations } from "./guards";
import type { TrainingDocument, TrainingExample } from "./training-types";

const ex = (over: Partial<TrainingExample>): TrainingExample => ({ id: "1", kind: "send", stageName: null, body: "Hi Maria, a fair point.", reason: null, createdAt: "2026-11-01T10:00:00Z", ...over });
const doc: TrainingDocument = { id: "d", fileName: "brochure.pdf", purpose: null, status: "trained", bytes: 10, createdAt: "2026-11-01", text: "iCapOS shows the readiness checklist investors use." };

describe("parseGuidance", () => {
  it("reads JSON inside prose or fences", () => {
    expect(parseGuidance('```json\n{"bridge":"That is fair.","value":"It shows the checklist."}\n```')).toEqual({ bridge: "That is fair.", value: "It shows the checklist." });
  });
  it("returns null for anything else", () => {
    expect(parseGuidance("no json")).toBeNull();
    expect(parseGuidance('{"bridge": 4}')).toBeNull();
  });
});

describe("acceptGuidance", () => {
  const good = { bridge: "That is a fair concern about cost.", value: "iCapOS shows the checklist investors use before a first meeting." };
  it("accepts clean lines", () => {
    expect(acceptGuidance(good, []).ok).toBe(true);
  });
  it("rejects figures", () => {
    expect(acceptGuidance({ ...good, value: "Over 7000 investors use the checklist before meetings." }, []).ok).toBe(false);
  });
  it("rejects built in banned words and staff banned words", () => {
    expect(acceptGuidance({ ...good, bridge: "Try it, there is a free plan for you." }, []).ok).toBe(false);
    expect(acceptGuidance({ ...good, bridge: "That is a fair concern about the cheap price." }, ["cheap"]).ok).toBe(false);
  });
  it("rejects quotation marks, bad length and unreadable replies", () => {
    expect(acceptGuidance({ ...good, bridge: 'You said "no" and that is fair enough.' }, []).ok).toBe(false);
    expect(acceptGuidance({ ...good, bridge: "Fair." }, []).ok).toBe(false);
    expect(acceptGuidance(null, []).ok).toBe(false);
  });
});

describe("applyGuidance", () => {
  const parts = buildParts({ firstName: "Maria", asked: "How long does it take to see results?", concern: null, objection: "timing", chatUrl: "https://icapos.com/x/invest?src=opp-abc", includeRefundOffer: true });
  const next = applyGuidance(parts, { bridge: "Timing depends on where you start.", value: "iCapOS shows the checklist investors use." });
  it("replaces only the bridge and value lines", () => {
    expect(next.intro[0]).toEqual(parts.intro[0]);
    expect(next.intro[next.intro.length - 1]).toEqual({ text: "Timing depends on where you start.", quote: false });
    expect(next.value).toBe("iCapOS shows the checklist investors use.");
    expect(next.refund).toBe(parts.refund);
    expect(next.question).toBe(parts.question);
    expect(next.link).toBe(parts.link);
  });
});

describe("pickExamples and prompt", () => {
  it("puts examples for the stage first and caps each kind", () => {
    const list = [
      ex({ id: "a", stageName: "Proposal", createdAt: "2026-11-01T09:00:00Z" }),
      ex({ id: "b", stageName: "Qualified", createdAt: "2026-10-01T09:00:00Z" }),
      ex({ id: "c", kind: "never", reason: "wrong product" }),
    ];
    const picked = pickExamples(list, "Qualified");
    expect(picked.send[0].id).toBe("b");
    expect(picked.never).toHaveLength(1);
  });

  it("marks documents and examples as reference material, and carries the reasons", () => {
    const prompt = buildGuidancePrompt({ objection: "money", technique: "x", stageName: "Qualified", asked: null, concern: null, documents: [doc], examples: [ex({ kind: "never", reason: "wrong product" })] });
    expect(prompt).toContain("brochure.pdf");
    expect(prompt).toContain("why: wrong product");
  });
});

describe("staff banned words in the guard", () => {
  it("adds to the built in rules and matches whole words", () => {
    expect(draftViolations("A cheap plan", ["cheap"])).toEqual(['banned word "cheap"']);
    expect(draftViolations("A cheaper plan", ["cheap"])).toEqual([]);
    expect(draftViolations("This is free", [])).toContain("free offer");
  });
});
