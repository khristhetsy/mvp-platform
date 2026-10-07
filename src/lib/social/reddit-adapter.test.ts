import { describe, expect, it } from "vitest";
import { redditSubreddit, redditTitleAndText } from "./reddit-adapter";
import { REDDIT_DISCLAIMER } from "./reddit";

describe("redditTitleAndText", () => {
  it("uses the first line as the title and the rest as the body", () => {
    const r = redditTitleAndText({ body: "Hook line\n\nPoint one.\nPoint two.", commentText: null, linkUrl: null });
    expect(r.title).toBe("Hook line");
    expect(r.text.startsWith("Point one.\nPoint two.")).toBe(true);
    expect(r.text.endsWith(REDDIT_DISCLAIMER)).toBe(true);
  });
  it("adds the comment text and tracked link once", () => {
    const r = redditTitleAndText({ body: "T\nBody", commentText: "See the matches", linkUrl: "https://icapos.com/r/x" });
    expect(r.text).toContain("See the matches");
    expect(r.text.match(/icapos\.com\/r\/x/g)?.length).toBe(1);
  });
  it("does not repeat a link already in the comment", () => {
    const r = redditTitleAndText({ body: "T\nB", commentText: "Go https://icapos.com/r/x", linkUrl: "https://icapos.com/r/x" });
    expect(r.text.match(/icapos\.com\/r\/x/g)?.length).toBe(1);
  });
  it("caps long titles at 300 characters", () => {
    expect(redditTitleAndText({ body: "x".repeat(400), commentText: null, linkUrl: null }).title.length).toBe(300);
  });
});

describe("redditSubreddit", () => {
  it("defaults to the iCFO community", () => {
    delete process.env.REDDIT_SUBREDDIT;
    expect(redditSubreddit()).toBe("FounderCapitalRaising");
  });
  it("strips an r/ prefix", () => {
    process.env.REDDIT_SUBREDDIT = "r/AngelInvesting";
    expect(redditSubreddit()).toBe("AngelInvesting");
    delete process.env.REDDIT_SUBREDDIT;
  });
});
