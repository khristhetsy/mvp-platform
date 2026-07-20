import { describe, it, expect } from "vitest";
import {
  renderBlocksToEmailHtml,
  renderBlocksToText,
  seedBlocksFromHtml,
  stripHtmlToText,
  type TemplateBlock,
} from "./template-blocks";

const blocks: TemplateBlock[] = [
  { id: "1", type: "heading", text: "This month's matched founders", level: 1 },
  { id: "2", type: "text", text: "Dear {{first_name}}," },
  { id: "3", type: "button", label: "Open your pipeline", url: "https://icapos.com/pipeline" },
  { id: "4", type: "divider" },
];

describe("renderBlocksToEmailHtml", () => {
  it("produces table-based, inline-styled email HTML", () => {
    const html = renderBlocksToEmailHtml(blocks);
    expect(html).toContain("<table");
    expect(html).toContain('role="presentation"');
    expect(html).toContain("style=");
    // no modern layout that mail clients drop
    expect(html).not.toContain("display:flex");
    expect(html).not.toContain("<style");
  });

  it("preserves merge fields verbatim", () => {
    expect(renderBlocksToEmailHtml(blocks)).toContain("{{first_name}}");
  });

  it("escapes user text to prevent injected markup", () => {
    const html = renderBlocksToEmailHtml([
      { id: "x", type: "text", text: '<script>alert("x")</script>' },
    ]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("neutralises non-http button URLs", () => {
    const html = renderBlocksToEmailHtml([
      { id: "b", type: "button", label: "Click", url: "javascript:alert(1)" },
    ]);
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="#"');
  });

  it("keeps https button URLs", () => {
    expect(renderBlocksToEmailHtml(blocks)).toContain("https://icapos.com/pipeline");
  });
});

describe("renderBlocksToText", () => {
  it("produces a readable plain-text alternative", () => {
    const text = renderBlocksToText(blocks);
    expect(text).toContain("This month's matched founders");
    expect(text).toContain("Open your pipeline: https://icapos.com/pipeline");
  });
});

describe("seedBlocksFromHtml", () => {
  it("seeds a heading from the subject and paragraphs from the body", () => {
    const seeded = seedBlocksFromHtml("Welcome", "<p>First para</p><p>Second para</p>");
    expect(seeded[0]).toMatchObject({ type: "heading", text: "Welcome" });
    expect(seeded.some((b) => b.type === "text" && b.text.includes("First para"))).toBe(true);
  });

  it("never returns an empty document", () => {
    expect(seedBlocksFromHtml("", "").length).toBeGreaterThan(0);
  });
});

describe("stripHtmlToText", () => {
  it("converts breaks and tags to plain text", () => {
    expect(stripHtmlToText("<p>a</p><p>b</p>")).toBe("a\n\nb");
  });
});
