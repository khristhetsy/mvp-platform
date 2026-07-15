import { describe, it, expect } from "vitest";
import { absolutizeEmailHtml } from "./absolutize-html";

const BASE = "https://icapos.com";

describe("absolutizeEmailHtml", () => {
  it("rewrites root-relative image src", () => {
    expect(absolutizeEmailHtml(`<img src="/email-logo.png">`, BASE)).toBe(`<img src="https://icapos.com/email-logo.png">`);
  });

  it("rewrites path-relative image src", () => {
    expect(absolutizeEmailHtml(`<img src="email-logo.png">`, BASE)).toBe(`<img src="https://icapos.com/email-logo.png">`);
  });

  it("rewrites ./-relative image src", () => {
    expect(absolutizeEmailHtml(`<img src="./assets/logo.png">`, BASE)).toBe(`<img src="https://icapos.com/assets/logo.png">`);
  });

  it("leaves absolute https URLs unchanged", () => {
    const html = `<img src="https://cdn.example.com/logo.png">`;
    expect(absolutizeEmailHtml(html, BASE)).toBe(html);
  });

  it("leaves data:, cid:, mailto:, tel:, and protocol-relative untouched", () => {
    const html = `<img src="data:image/png;base64,AAA"><a href="mailto:x@y.com">m</a><a href="tel:+1">t</a><img src="cid:logo"><img src="//cdn.io/a.png">`;
    expect(absolutizeEmailHtml(html, BASE)).toBe(html);
  });

  it("rewrites relative href links", () => {
    expect(absolutizeEmailHtml(`<a href="/pricing">x</a>`, BASE)).toBe(`<a href="https://icapos.com/pricing">x</a>`);
  });

  it("leaves #anchors untouched", () => {
    expect(absolutizeEmailHtml(`<a href="#top">x</a>`, BASE)).toBe(`<a href="#top">x</a>`);
  });

  it("handles single quotes and mixed case attributes", () => {
    expect(absolutizeEmailHtml(`<IMG SRC='/a.png'>`, BASE)).toBe(`<IMG SRC='https://icapos.com/a.png'>`);
  });

  it("strips trailing slash on base and joins cleanly", () => {
    expect(absolutizeEmailHtml(`<img src="/a.png">`, "https://icapos.com/")).toBe(`<img src="https://icapos.com/a.png">`);
  });

  it("returns empty string for null/undefined", () => {
    expect(absolutizeEmailHtml(null, BASE)).toBe("");
    expect(absolutizeEmailHtml(undefined, BASE)).toBe("");
  });
});
