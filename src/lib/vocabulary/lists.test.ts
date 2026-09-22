/**
 * The pure half of the vocabulary: resolving and labelling stored values.
 */
import { describe, it, expect } from "vitest";
import {
  CODE_FALLBACK,
  VOCABULARY_LISTS,
  labelOf,
  offered,
  resolveSlug,
  type VocabularyOption,
} from "@/lib/vocabulary/lists";

const industry: VocabularyOption[] = [
  { slug: "fintech", label: "Fintech", archived: false },
  { slug: "ai-ml", label: "AI / ML", archived: false },
  { slug: "saas-b2b-software", label: "SaaS / B2B Software", archived: true },
];

describe("resolving a stored value", () => {
  it("accepts the slug", () => {
    expect(resolveSlug(industry, "fintech")).toBe("fintech");
  });

  it("accepts the label a person read", () => {
    expect(resolveSlug(industry, "Fintech")).toBe("fintech");
    expect(resolveSlug(industry, "SaaS / B2B Software")).toBe("saas-b2b-software");
  });

  it("ignores case, spacing and separators", () => {
    expect(resolveSlug(industry, "AI / ML")).toBe("ai-ml");
    expect(resolveSlug(industry, "ai/ml")).toBe("ai-ml");
    expect(resolveSlug(industry, "  AIML ")).toBe("ai-ml");
  });

  it("resolves an archived value — a record holding it still matches", () => {
    expect(resolveSlug(industry, "SaaS / B2B Software")).toBe("saas-b2b-software");
  });

  // Nothing is guessed on the caller's behalf. An unrecognised value is
  // reported as unrecognised so a person decides what it means.
  it("returns null for a value belonging to no option", () => {
    expect(resolveSlug(industry, "Web3")).toBeNull();
    expect(resolveSlug(industry, "")).toBeNull();
    expect(resolveSlug(industry, null)).toBeNull();
  });
});

describe("labelling", () => {
  it("shows the label for a slug", () => {
    expect(labelOf(industry, "ai-ml")).toBe("AI / ML");
  });

  it("leaves a value it does not know alone, so nothing renders blank", () => {
    expect(labelOf(industry, "Web3")).toBe("Web3");
  });

  it("is idempotent", () => {
    expect(labelOf(industry, labelOf(industry, "fintech"))).toBe("Fintech");
  });
});

describe("what a picker offers", () => {
  it("leaves archived values off the menu", () => {
    expect(offered(industry).map((o) => o.slug)).toEqual(["fintech", "ai-ml"]);
  });
});

describe("the code fallback", () => {
  it("covers every list", () => {
    for (const list of VOCABULARY_LISTS) {
      expect(CODE_FALLBACK[list].length).toBeGreaterThan(0);
    }
  });

  it("offers everything — the fallback is what shipped, nothing retired", () => {
    for (const list of VOCABULARY_LISTS) {
      expect(CODE_FALLBACK[list].every((o) => !o.archived)).toBe(true);
    }
  });

  it("has unique slugs within each list", () => {
    for (const list of VOCABULARY_LISTS) {
      const slugs = CODE_FALLBACK[list].map((o) => o.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("resolves the industry labels the platform shipped with", () => {
    const opts = CODE_FALLBACK.industry;
    expect(resolveSlug(opts, "FinTech")).toBe("fintech");
    expect(resolveSlug(opts, "SaaS / B2B Software")).toBe("saas-b2b-software");
    expect(resolveSlug(opts, "E-commerce")).toBe("ecommerce");
  });
});
