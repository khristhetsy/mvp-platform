import { describe, expect, it } from "vitest";
import { classifyAudience, cleanExcerpt, detectPlatform, initialStatus, matchSignal, scoreHit, suggestTemplateKey, validateThreadUrl, type FinderSignal } from "./finder";

const signals: FinderSignal[] = [
  { id: "1", phrase: "raising a seed round", platform: "any", active: true },
  { id: "2", phrase: "data room", platform: "linkedin", active: true },
  { id: "3", phrase: "off phrase", platform: "any", active: false },
];

describe("finder platform and links", () => {
  it("detects the three platforms and rejects the rest", () => {
    expect(detectPlatform("https://www.reddit.com/r/startups/comments/abc/x/")).toBe("reddit");
    expect(detectPlatform("https://www.linkedin.com/posts/someone")).toBe("linkedin");
    expect(detectPlatform("https://x.com/someone/status/1")).toBe("x");
    expect(detectPlatform("https://twitter.com/someone/status/1")).toBe("x");
    expect(detectPlatform("http://reddit.com/r/startups/comments/abc/")).toBeNull();
    expect(detectPlatform("https://example.com/post")).toBeNull();
    expect(detectPlatform("not a url")).toBeNull();
  });

  it("validates links before saving", () => {
    expect(validateThreadUrl("https://www.reddit.com/r/startups/comments/abc/x/")).toEqual({ ok: true, platform: "reddit" });
    expect(validateThreadUrl("https://www.reddit.com/r/startups/")).toMatchObject({ ok: false });
    expect(validateThreadUrl("")).toMatchObject({ ok: false });
    expect(validateThreadUrl("https://x.com/a/status/1")).toEqual({ ok: true, platform: "x" });
    expect(validateThreadUrl("https://evil.example/a")).toMatchObject({ ok: false });
    expect(validateThreadUrl(`https://x.com/${"a".repeat(600)}`)).toMatchObject({ ok: false });
  });
});

describe("finder audience, signals and scoring", () => {
  it("classifies investor voice and defaults to founder", () => {
    expect(classifyAudience("Looking at early stage fintech deals this quarter.")).toBe("investor");
    expect(classifyAudience("We invest in seed stage SaaS, check size 250k.")).toBe("investor");
    expect(classifyAudience("Cold emailed 60 investors and got no replies.")).toBe("founder");
  });

  it("matches active signals by platform only", () => {
    expect(matchSignal("Anyone here raising a seed round?", "reddit", signals)?.id).toBe("1");
    expect(matchSignal("Need a data room checklist", "reddit", signals)).toBeNull();
    expect(matchSignal("Need a data room checklist", "linkedin", signals)?.id).toBe("2");
    expect(matchSignal("off phrase", "reddit", signals)).toBeNull();
  });

  it("scores by rule and never auto replies to investors", () => {
    expect(scoreHit({ audience: "investor", matched: true, text: "deals?" })).toBe("review");
    expect(scoreHit({ audience: "founder", matched: false, text: "hello" })).toBe("review");
    expect(scoreHit({ audience: "founder", matched: true, text: "How do I raise?" })).toBe("strong");
    expect(scoreHit({ audience: "founder", matched: true, text: "Raising a seed round" })).toBe("good");
    expect(initialStatus("investor")).toBe("held");
    expect(initialStatus("founder")).toBe("new");
  });

  it("suggests an existing Reddit template and defaults to the link free one", () => {
    expect(suggestTemplateKey("I cold emailed 60 investors and got no replies")).toBe("no_replies");
    expect(suggestTemplateKey("Where do I find investors for fintech?")).toBe("find_investors");
    expect(suggestTemplateKey("Is my deck ready?")).toBe("deck_feedback");
    expect(suggestTemplateKey("something unrelated")).toBe("deck_feedback");
  });

  it("trims excerpts", () => {
    expect(cleanExcerpt("  a \n b  ")).toBe("a b");
    expect(cleanExcerpt("x".repeat(900)).length).toBe(600);
    expect(cleanExcerpt(null)).toBe("");
  });
});
