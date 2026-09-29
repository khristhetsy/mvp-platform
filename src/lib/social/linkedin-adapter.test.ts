import { describe, it, expect, afterEach } from "vitest";
import { linkedInCommentary, linkedInCommentsEnabled, linkedInAdapter } from "./linkedin-adapter";

const ORIG = process.env.LINKEDIN_COMMENTS_ENABLED;
afterEach(() => { process.env.LINKEDIN_COMMENTS_ENABLED = ORIG; });

const link = "https://icapos.com/r/abc";

describe("linkedInCommentary", () => {
  it("comments off: appends comment text, then the link", () => {
    expect(linkedInCommentary({ body: "Body", commentText: "Try it now", linkUrl: link }, false))
      .toBe(`Body\n\nTry it now\n\n${link}`);
  });
  it("comments off: does not repeat a link the comment already contains", () => {
    expect(linkedInCommentary({ body: "Body", commentText: `Match here: ${link}`, linkUrl: link }, false))
      .toBe(`Body\n\nMatch here: ${link}`);
  });
  it("comments on: body plus link only, comment goes out separately", () => {
    expect(linkedInCommentary({ body: "Body", commentText: "Try it now", linkUrl: link }, true))
      .toBe(`Body\n\n${link}`);
  });
  it("no comment and no link: body only", () => {
    expect(linkedInCommentary({ body: "Body", commentText: null, linkUrl: null }, false)).toBe("Body");
  });
});

describe("linkedInCommentsEnabled", () => {
  it("is off unless the flag is exactly true", () => {
    delete process.env.LINKEDIN_COMMENTS_ENABLED;
    expect(linkedInCommentsEnabled()).toBe(false);
    expect(linkedInAdapter.supportsComments?.()).toBe(false);
    process.env.LINKEDIN_COMMENTS_ENABLED = "true";
    expect(linkedInCommentsEnabled()).toBe(true);
  });
});
