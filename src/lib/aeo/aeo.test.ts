import { describe, it, expect } from "vitest";
import { runAeoComplianceCheck } from "./compliance";
import { buildJsonLd } from "./schema";
import type { AeoPage } from "./types";

describe("runAeoComplianceCheck", () => {
  it("clears engagement-register copy", () => {
    const r = runAeoComplianceCheck({
      definitionAnswer: "A Capital Readiness Rating describes how organized a company's diligence materials are.",
      faq: [{ q: "Is it a prediction?", a: "No. It is a descriptive measure of organization." }],
    });
    expect(r.status).toBe("cleared");
    expect(r.violations).toHaveLength(0);
  });

  it("flags outcome-register language (register check)", () => {
    const r = runAeoComplianceCheck({ definitionAnswer: "Use this to raise faster and get funded." });
    expect(r.status).toBe("flagged");
    expect(r.violations.some((v) => v.check === "register")).toBe(true);
  });

  it("flags guarantee/predictive language (causal check)", () => {
    const r = runAeoComplianceCheck({ definitionAnswer: "This guarantees returns for every company." });
    expect(r.violations.some((v) => v.check === "causal")).toBe(true);
  });

  it("flags offer/solicitation language (firewall check)", () => {
    const r = runAeoComplianceCheck({ definitionAnswer: "Invest now in this deal.", faq: [] });
    expect(r.violations.some((v) => v.check === "firewall")).toBe(true);
  });

  it("flags regulated-status misrepresentation (identity check)", () => {
    const r = runAeoComplianceCheck({ definitionAnswer: "We are an SEC approved broker-dealer." });
    expect(r.violations.some((v) => v.check === "identity")).toBe(true);
  });

  it("reports the field where a violation was found", () => {
    const r = runAeoComplianceCheck({
      definitionAnswer: "A clean description.",
      faq: [{ q: "How?", a: "You will get funded." }],
    });
    expect(r.violations[0]?.field).toBe("faq[0].a");
  });
});

describe("buildJsonLd", () => {
  const page: AeoPage = {
    id: "1", slug: "capital-readiness-rating", status: "published",
    eyebrow: "Capital readiness", h1: "What is a Capital Readiness Rating?", lede: "A structured way…",
    definitionAnswer: "A Capital Readiness Rating is a structured assessment.",
    definedTerm: "Capital Readiness Rating",
    sections: [], faq: [{ q: "Is it a prediction?", a: "No." }],
    metaDescription: "Meta.", complianceStatus: "cleared", updatedAt: "2026-07-02T00:00:00Z",
  };

  it("emits Article + FAQPage + DefinedTerm in the graph", () => {
    const ld = buildJsonLd(page);
    const graph = ld["@graph"] as { "@type": string }[];
    const types = graph.map((g) => g["@type"]);
    expect(types).toContain("Article");
    expect(types).toContain("FAQPage");
    expect(types).toContain("DefinedTerm");
  });

  it("schema answer matches the record's definition (no drift)", () => {
    const ld = buildJsonLd(page);
    const graph = ld["@graph"] as Record<string, unknown>[];
    const article = graph.find((g) => g["@type"] === "Article")!;
    expect(article.articleBody).toBe(page.definitionAnswer);
    const defined = graph.find((g) => g["@type"] === "DefinedTerm")!;
    expect(defined.description).toBe(page.definitionAnswer);
  });

  it("omits DefinedTerm when there is no defined term", () => {
    const ld = buildJsonLd({ ...page, definedTerm: undefined });
    const types = (ld["@graph"] as { "@type": string }[]).map((g) => g["@type"]);
    expect(types).not.toContain("DefinedTerm");
  });
});
