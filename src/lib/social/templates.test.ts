import { describe, expect, it } from "vitest";
import { addHashtags, draftFromTemplate, noteLines, nextPostTip, plainPunctuation, shorten, variantsPerNetwork } from "@/lib/social/templates";

describe("founder social templates", () => {
  it("fills a template from notes and the company name", () => {
    const out = draftFromTemplate("milestone", { notes: "- Closed two hospital pilots\n- 40 clinicians onboarded", company: "Acme Health" });
    expect(out).toContain("Acme Health");
    expect(out).toContain("Closed two hospital pilots");
    expect(out).toContain("• 40 clinicians onboarded");
  });

  it("never emits dash punctuation in drafts", () => {
    for (const key of ["investor_update", "milestone", "hiring", "product_launch", "event"] as const) {
      const out = draftFromTemplate(key, { notes: "Raised a seed round — and signed a partner", company: "Acme" });
      expect(out).not.toMatch(/[—–]/);
      expect(out).not.toMatch(/\s-\s/);
    }
    expect(plainPunctuation("a — b")).toBe("a, b");
  });

  it("strips bullets and numbering from notes", () => {
    expect(noteLines("1. one\n* two\n\n- three")).toEqual(["one", "two", "three"]);
  });

  it("shortens on a boundary and respects the limit", () => {
    const long = "First sentence here. Second sentence here. Third sentence here.";
    const out = shorten(long, 45);
    expect(out.length).toBeLessThanOrEqual(45);
    expect(out.endsWith(".")).toBe(true);
  });

  it("adds hashtags once", () => {
    const withTags = addHashtags("Hospital pilots expanding hospital adoption");
    expect(withTags).toMatch(/#hospital/);
    expect(addHashtags(withTags)).toBe(withTags);
  });

  it("writes a different variant per network", () => {
    const v = variantsPerNetwork("Pilot results are in. Hospital adoption doubled #health", ["linkedin", "instagram", "reddit"]);
    expect(v.reddit).not.toContain("#health");
    expect(v.linkedin).not.toBe(v.reddit);
  });

  it("gives a tip for the weakest stage", () => {
    expect(nextPostTip({ weakestStage: "meetings" })).toMatch(/book 20 minutes/);
    expect(nextPostTip({ weakestStage: null })).toMatch(/on pace/);
  });
});
