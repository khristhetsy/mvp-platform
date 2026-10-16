import { describe, it, expect } from "vitest";
import { BODY_TAGS, HEADLINE_TAGS, htmlToText, isHtmlSlot, plainHeadline, sanitizeHtml, textToHtml } from "./safe-html";

describe("sanitizeHtml", () => {
  it("keeps allowed tags and removes scripts, handlers and unknown tags", () => {
    const out = sanitizeHtml('<p onclick="x()">Hi <b>there</b></p><script>alert(1)</script><img src=x onerror=y><form>f</form>', BODY_TAGS);
    expect(out).toBe('<p style="margin:0 0 14px 0;">Hi <b>there</b></p>f');
    expect(out).not.toMatch(/script|onclick|onerror|<img|<form/i);
  });
  it("allows https links only and drops the tag around an unsafe one", () => {
    expect(sanitizeHtml('<a href="https://icapos.com/start" target="_blank">Go</a>', BODY_TAGS)).toBe('<a href="https://icapos.com/start" style="color:#1A6CE4;">Go</a>');
    expect(sanitizeHtml('<a href="javascript:alert(1)">Go</a>', BODY_TAGS)).toBe("Go");
  });
  it("allows only a hex color on a span, and only in the headline list", () => {
    expect(sanitizeHtml('<span style="color:#1A6CE4;background:url(x)">iCapOS</span>', HEADLINE_TAGS)).toBe('<span style="color:#1A6CE4;">iCapOS</span>');
    expect(sanitizeHtml("<p>x</p>", HEADLINE_TAGS)).toBe("x");
  });
  it("closes unclosed tags and ignores stray closing tags", () => {
    expect(sanitizeHtml("<b>bold</i></b><ul><li>a", BODY_TAGS)).toContain("</b>");
    expect(sanitizeHtml("<ul><li>a", BODY_TAGS)).toMatch(/<\/li><\/ul>$/);
    expect(sanitizeHtml("text</b>", BODY_TAGS)).toBe("text");
  });
  it("escapes stray angle brackets and keeps existing entities", () => {
    expect(sanitizeHtml("a < b & c &amp; d", BODY_TAGS)).toBe("a &lt; b &amp; c &amp; d");
  });
});

describe("textToHtml and htmlToText", () => {
  it("turns blank lines into paragraphs and single breaks into br", () => {
    expect(textToHtml("One\nline two\n\nSecond", "body")).toBe("<p>One<br>\nline two</p>\n<p>Second</p>");
  });
  it("keeps the headline on one line and escapes it", () => {
    expect(textToHtml("A & B <x>", "headline")).toBe("A &amp; B &lt;x&gt;");
  });
  it("goes back to plain text with bullets", () => {
    expect(htmlToText("<p>Hi &amp; bye</p><ul><li>One</li><li>Two</li></ul>")).toBe("Hi & bye\n\n• One\n• Two");
  });
});

describe("slot flags", () => {
  it("only headline and body can be HTML", () => {
    expect(isHtmlSlot({ design_html_headline: "1" }, "headline")).toBe(true);
    expect(isHtmlSlot({ design_html_cta_text: "1" }, "cta_text")).toBe(false);
    expect(isHtmlSlot({}, "body")).toBe(false);
  });
  it("the subject uses the plain headline", () => {
    expect(plainHeadline({ headline: 'The <span style="color:#1A6CE4">iCapOS</span> Agent', design_html_headline: "1" })).toBe("The iCapOS Agent");
    expect(plainHeadline({ headline: "Plain <b>text</b>" })).toBe("Plain <b>text</b>");
  });
});
