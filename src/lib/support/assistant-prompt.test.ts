import { describe, expect, it } from "vitest";
import { CODE_DEFAULT_PRICING } from "@/lib/subscriptions/pricing-catalog";
import { DEFAULT_BRIEF_TEMPLATE, EMPTY_TRAINING, HANDOFF_TAG, PLANS_TOKEN, buildSystem, plansSentence, renderBrief } from "./assistant-prompt";

const base = { name: "Sam", company: "Acme", stage: "Stage 2", plan: "Basic", pricing: CODE_DEFAULT_PRICING };

describe("renderBrief", () => {
  it("fills the plans token from the live price list", () => {
    const out = renderBrief(DEFAULT_BRIEF_TEMPLATE, CODE_DEFAULT_PRICING);
    expect(out).not.toContain(PLANS_TOKEN);
    expect(out).toContain(plansSentence(CODE_DEFAULT_PRICING));
  });

  it("appends the live plans when a saved text dropped the token", () => {
    const out = renderBrief("iCapOS helps founders raise.", CODE_DEFAULT_PRICING);
    expect(out.startsWith("iCapOS helps founders raise.")).toBe(true);
    expect(out.endsWith(plansSentence(CODE_DEFAULT_PRICING))).toBe(true);
  });

  it("falls back to the built in text when the saved text is blank", () => {
    expect(renderBrief("   ", CODE_DEFAULT_PRICING)).toBe(renderBrief(DEFAULT_BRIEF_TEMPLATE, CODE_DEFAULT_PRICING));
  });
});

describe("buildSystem", () => {
  it("adds no training sections when nothing is taught", () => {
    const out = buildSystem(base);
    expect(out).not.toContain("APPROVED ANSWERS");
    expect(out).not.toContain("HELP DOCUMENTS");
    expect(out).toContain(HANDOFF_TAG);
    expect(buildSystem({ ...base, training: EMPTY_TRAINING })).toBe(out);
  });

  it("adds taught answers and PDF text when present", () => {
    const out = buildSystem({
      ...base,
      training: { briefTemplate: null, taught: [{ id: "1", question: "Can I upload Word?", answer: "PDF only." }], sources: ["Data room guide text"] },
    });
    expect(out).toContain("Q: Can I upload Word?\nA: PDF only.");
    expect(out).toContain("Data room guide text");
  });

  it("uses an edited brief in place of the built in one", () => {
    const out = buildSystem({ ...base, training: { briefTemplate: `Custom facts. ${PLANS_TOKEN}`, taught: [], sources: [] } });
    expect(out).toContain("Custom facts.");
    expect(out).not.toContain("Market Claim Grader IS the platform");
  });

  it("caps the PDF text", () => {
    const out = buildSystem({ ...base, training: { briefTemplate: null, taught: [], sources: ["x".repeat(30000)] } });
    expect(out.length).toBeLessThan(20000);
  });
});
