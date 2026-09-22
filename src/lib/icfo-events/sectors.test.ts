/**
 * The sector vocabulary — one spelling, whatever arrived.
 */
import { describe, it, expect } from "vitest";
import {
  EVENT_SECTORS,
  normalizeSectors,
  sectorLabel,
  toSectorSlug,
} from "@/lib/icfo-events/sectors";

describe("resolving a sector", () => {
  it("accepts its own slug", () => {
    expect(toSectorSlug("fintech")).toBe("fintech");
    expect(toSectorSlug("real-estate")).toBe("real-estate");
  });

  it("accepts the label a registrant read", () => {
    expect(toSectorSlug("FinTech")).toBe("fintech");
    expect(toSectorSlug("SaaS / B2B Software")).toBe("saas");
    expect(toSectorSlug("Deep Tech")).toBe("deep-tech");
  });

  it("ignores case, spacing and separators", () => {
    expect(toSectorSlug("AI / ML")).toBe("ai-ml");
    expect(toSectorSlug("ai/ml")).toBe("ai-ml");
    expect(toSectorSlug("  E-Commerce ")).toBe("ecommerce");
  });

  it("returns null for something that is not a sector", () => {
    expect(toSectorSlug("Agtech")).toBeNull();
    expect(toSectorSlug("")).toBeNull();
    expect(toSectorSlug(null)).toBeNull();
  });

  it("round-trips every sector through its own label", () => {
    for (const s of EVENT_SECTORS) {
      expect(toSectorSlug(s.label)).toBe(s.slug);
      expect(sectorLabel(s.slug)).toBe(s.label);
    }
  });
});

describe("normalising a stored list", () => {
  it("brings the two spellings together", () => {
    expect(normalizeSectors(["FinTech", "fintech", "HealthTech"])).toEqual(["fintech", "healthtech"]);
  });

  it("keeps an unknown value rather than dropping it", () => {
    // Two people who both typed "Agtech" still have something in common;
    // discarding it would quietly shrink the room.
    expect(normalizeSectors(["Agtech", "agtech"])).toEqual(["agtech"]);
  });

  it("drops blanks", () => {
    expect(normalizeSectors(["", "   ", "fintech"])).toEqual(["fintech"]);
  });

  it("is idempotent", () => {
    const once = normalizeSectors(["FinTech", "AI / ML", "Agtech"]);
    expect(normalizeSectors(once)).toEqual(once);
  });
});

describe("reading a sector back", () => {
  it("labels a slug", () => {
    expect(sectorLabel("ai-ml")).toBe("AI / ML");
  });

  it("leaves a value it does not know alone, so nothing renders blank", () => {
    expect(sectorLabel("agtech")).toBe("agtech");
  });
});
