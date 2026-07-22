import { describe, it, expect } from "vitest";
import { mergeSlots } from "./template-merge";
import type { PlaceholderSchema } from "./template-schema";

const schema: PlaceholderSchema = {
  slots: [
    { key: "headline", type: "text", label: "Headline" },
    { key: "body", type: "textarea", label: "Body" },
    { key: "cta_url", type: "url", label: "CTA link" },
    { key: "banner_image", type: "image", label: "Banner" },
  ],
  locked: [],
};

describe("mergeSlots", () => {
  it("replaces slot tokens with their values", () => {
    const html = mergeSlots("<h1>{{headline}}</h1><p>{{body}}</p>", { headline: "Q4 update", body: "Hello" }, schema);
    expect(html).toBe("<h1>Q4 update</h1><p>Hello</p>");
  });

  it("HTML-escapes text values to prevent injected markup", () => {
    const html = mergeSlots("<h1>{{headline}}</h1>", { headline: '<script>alert(1)</script>' }, schema);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("sanitises url and image slots — non-http becomes #", () => {
    const html = mergeSlots(
      '<a href="{{cta_url}}">go</a><img src="{{banner_image}}">',
      { cta_url: "javascript:alert(1)", banner_image: "https://cdn.example.com/b.png" },
      schema,
    );
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="#"');
    expect(html).toContain("https://cdn.example.com/b.png");
  });

  it("preserves send-time tokens for the send layer to fill", () => {
    const html = mergeSlots(
      '<a href="{{unsubscribe_url}}">Unsubscribe</a>',
      {},
      schema,
      { preserveTokens: ["unsubscribe_url"] },
    );
    expect(html).toContain("{{unsubscribe_url}}");
  });

  it("blanks an unknown, non-preserved token rather than showing literal braces", () => {
    const html = mergeSlots("<p>{{mystery}}</p>", {}, schema);
    expect(html).toBe("<p></p>");
    expect(html).not.toContain("{{");
  });

  it("blanks a known slot with no value", () => {
    expect(mergeSlots("<h1>{{headline}}</h1>", {}, schema)).toBe("<h1></h1>");
  });
});
