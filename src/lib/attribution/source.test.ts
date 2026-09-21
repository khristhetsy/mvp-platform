import { describe, expect, it } from "vitest";
import {
  applyManualSource,
  isHighConfidence,
  normalizeSourceTag,
  resolveSource,
  shouldReplaceSource,
  sourceRank,
  sourceTagFromQuery,
} from "@/lib/attribution/source";

describe("the /fit funnel always wins", () => {
  // The decision was to keep path 1 untouched. That is only real if a fit
  // session outranks every other signal, including a tagged scheduler link
  // arriving on the same booking.
  it("beats a tagged link on the same booking", () => {
    expect(
      resolveSource({ fitTag: "linkedin-sept", linkTag: "instagram-oct" }),
    ).toEqual({ tag: "linkedin-sept", confidence: "fit" });
  });

  it("beats every other candidate at once", () => {
    expect(
      resolveSource({
        fitTag: "fit-tag",
        linkTag: "link-tag",
        cookieTag: "cookie-tag",
        selfReportedTag: "self-tag",
      }),
    ).toEqual({ tag: "fit-tag", confidence: "fit" });
  });

  it("ranks fit above link, cookie and self-reported", () => {
    expect(sourceRank("fit")).toBeLessThan(sourceRank("link"));
    expect(sourceRank("link")).toBeLessThan(sourceRank("cookie"));
    expect(sourceRank("cookie")).toBeLessThan(sourceRank("self_reported"));
  });
});

describe("the rest of the ladder", () => {
  it("falls to the tagged link when there is no fit session", () => {
    expect(resolveSource({ linkTag: "linkedin-sept", cookieTag: "old-tag" })).toEqual({
      tag: "linkedin-sept",
      confidence: "link",
    });
  });

  it("falls to the cookie when the link carried nothing", () => {
    expect(resolveSource({ cookieTag: "linkedin-sept" })).toEqual({
      tag: "linkedin-sept",
      confidence: "cookie",
    });
  });

  it("uses the self-reported answer only when nothing else was captured", () => {
    expect(resolveSource({ selfReportedTag: "linkedin-sept" })).toEqual({
      tag: "linkedin-sept",
      confidence: "self_reported",
    });
  });

  it("returns null when nothing usable arrived", () => {
    // Unattributed is a real outcome, not a failure. Returning a placeholder
    // here is how the tile would start lying again.
    expect(resolveSource({})).toBeNull();
    expect(resolveSource({ linkTag: "  ", cookieTag: null })).toBeNull();
  });

  it("marks which answers are evidence and which are recollection", () => {
    expect(isHighConfidence("fit")).toBe(true);
    expect(isHighConfidence("link")).toBe(true);
    expect(isHighConfidence("cookie")).toBe(true);
    expect(isHighConfidence("self_reported")).toBe(false);
    expect(isHighConfidence("manual")).toBe(false);
  });
});

describe("a tag has to look like a campaign slug", () => {
  it("rejects the free text that broke lead_source in the first place", () => {
    // book.ts used to write "LinkedIn" into lead_source and compare it to
    // `linkedin-icapos-sept`. Anything with a space is a recollection, not a tag.
    for (const junk of ["a friend", "google search", "LinkedIn post", "word of mouth"]) {
      expect(normalizeSourceTag(junk)).toBeNull();
    }
  });

  it("tidies case, whitespace and stray slashes", () => {
    expect(normalizeSourceTag("  LinkedIn-Sept/ ")).toBe("linkedin-sept");
    expect(normalizeSourceTag("/instagram-oct")).toBe("instagram-oct");
  });

  it("accepts the slug shapes campaigns actually use", () => {
    expect(normalizeSourceTag("linkedin-icapos-sept")).toBe("linkedin-icapos-sept");
    expect(normalizeSourceTag("ig_post_42")).toBe("ig_post_42");
    expect(normalizeSourceTag("fb.q4")).toBe("fb.q4");
  });

  it("refuses a tag that starts with punctuation, and empty input", () => {
    expect(normalizeSourceTag("-leading")).toBeNull();
    expect(normalizeSourceTag("")).toBeNull();
    expect(normalizeSourceTag(null)).toBeNull();
    expect(normalizeSourceTag(undefined)).toBeNull();
  });

  it("caps the length so a crafted URL cannot write junk into the row", () => {
    expect(normalizeSourceTag("a".repeat(400))?.length).toBe(120);
  });
});

describe("first-touch, with one exception", () => {
  it("keeps the source a booking already has", () => {
    const existing = { tag: "linkedin-sept", confidence: "link" } as const;
    expect(shouldReplaceSource(existing, { tag: "ig-oct", confidence: "cookie" })).toBe(false);
    // Even a HIGHER-confidence latecomer does not overwrite: first touch is the
    // rule, matching what /fit already does.
    expect(shouldReplaceSource(existing, { tag: "ig-oct", confidence: "fit" })).toBe(false);
  });

  it("writes when there is nothing there yet", () => {
    expect(shouldReplaceSource(null, { tag: "ig-oct", confidence: "self_reported" })).toBe(true);
  });

  it("lets a staff member override anything", () => {
    const existing = { tag: "linkedin-sept", confidence: "fit" } as const;
    expect(shouldReplaceSource(existing, { tag: "conference", confidence: "manual" })).toBe(true);
  });

  it("refuses a manual override that is not a usable tag", () => {
    expect(applyManualSource("a friend")).toBeNull();
    expect(applyManualSource("conference-q4")).toEqual({
      tag: "conference-q4",
      confidence: "manual",
    });
  });
});

describe("reading a tag off a URL", () => {
  it("prefers our own src parameter", () => {
    const p = new URLSearchParams("utm_campaign=other&src=linkedin-sept");
    expect(sourceTagFromQuery(p)).toBe("linkedin-sept");
  });

  it("prefers utm_campaign over utm_source", () => {
    // A channel cannot tell two campaigns on the same channel apart.
    const p = new URLSearchParams("utm_source=linkedin&utm_campaign=linkedin-sept");
    expect(sourceTagFromQuery(p)).toBe("linkedin-sept");
  });

  it("falls back to utm_source when that is all there is", () => {
    expect(sourceTagFromQuery(new URLSearchParams("utm_source=linkedin"))).toBe("linkedin");
  });

  it("returns null for a plain URL", () => {
    expect(sourceTagFromQuery(new URLSearchParams(""))).toBeNull();
    expect(sourceTagFromQuery(new URLSearchParams("page=2"))).toBeNull();
  });

  it("skips a junk value and tries the next key", () => {
    const p = new URLSearchParams("src=a%20friend&utm_campaign=linkedin-sept");
    expect(sourceTagFromQuery(p)).toBe("linkedin-sept");
  });
});
