import { describe, expect, it } from "vitest";
import { buildReply, insertLink, isRedditTag, isRedditThreadUrl, LINK_TOKEN, REDDIT_DISCLAIMER, REDDIT_TEMPLATES, threadLabel, withDisclaimer } from "./reddit";

describe("reddit helpers", () => {
  it("recognises Reddit campaign tags only", () => {
    expect(isRedditTag("rd_ab12cd34")).toBe(true);
    expect(isRedditTag("rd-q4")).toBe(true);
    expect(isRedditTag("camp_ab12cd34")).toBe(false);
    expect(isRedditTag("li-post")).toBe(false);
    expect(isRedditTag(null)).toBe(false);
  });

  it("inserts the tracked link at the token", () => {
    expect(insertLink(`see ${LINK_TOKEN}`, "https://icapos.com/r/x")).toBe("see https://icapos.com/r/x");
  });

  it("leaves link-free bodies alone", () => {
    expect(insertLink("plain help", "https://icapos.com/r/x")).toBe("plain help");
  });

  it("adds the disclaimer exactly once", () => {
    const once = withDisclaimer("hello");
    expect(once.endsWith(REDDIT_DISCLAIMER)).toBe(true);
    expect(withDisclaimer(once)).toBe(once);
  });

  it("builds every template with the disclaimer", () => {
    for (const t of REDDIT_TEMPLATES) {
      const r = buildReply(t.body, "https://icapos.com/r/x");
      expect(r).toContain(REDDIT_DISCLAIMER);
      expect(r).not.toContain(LINK_TOKEN);
    }
  });

  it("labels and validates thread URLs", () => {
    expect(threadLabel("https://www.reddit.com/r/startups/comments/abc123/how_to_raise/")).toBe("r/startups/abc123");
    expect(isRedditThreadUrl("https://example.com/r/startups")).toBe(false);
  });
});
