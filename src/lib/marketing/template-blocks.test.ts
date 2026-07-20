import { describe, it, expect } from "vitest";
import {
  renderBlocksToEmailHtml,
  renderBlocksToText,
  parseHtmlToBlocks,
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

  it("omits image blocks with no source rather than emitting a broken img", () => {
    const html = renderBlocksToEmailHtml([{ id: "i", type: "image", src: "", width: 200 }]);
    expect(html).not.toContain("<img");
  });

  it("omits image blocks with a non-http(s) source", () => {
    const html = renderBlocksToEmailHtml([
      { id: "i", type: "image", src: "javascript:alert(1)", width: 200 },
    ]);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("javascript:");
  });

  it("renders uploaded image URLs", () => {
    const html = renderBlocksToEmailHtml([
      { id: "i", type: "image", src: "https://cdn.example.com/a.png", alt: "Logo", width: 180 },
    ]);
    expect(html).toContain('src="https://cdn.example.com/a.png"');
    expect(html).toContain('alt="Logo"');
    expect(html).toContain('width="180"');
  });
});

describe("linked text and heading blocks", () => {
  it("wraps a linked text block in an anchor", () => {
    const html = renderBlocksToEmailHtml([
      { id: "t", type: "text", text: "Read the guide", url: "https://icapos.com/guide" },
    ]);
    expect(html).toContain('href="https://icapos.com/guide"');
    expect(html).toContain("Read the guide</a>");
  });

  it("links headings too", () => {
    const html = renderBlocksToEmailHtml([
      { id: "h", type: "heading", text: "Your score", level: 1, url: "https://icapos.com/score" },
    ]);
    expect(html).toContain('href="https://icapos.com/score"');
  });

  it("renders plain text when the URL is unsafe, never a dead href", () => {
    const html = renderBlocksToEmailHtml([
      { id: "t", type: "text", text: "Click", url: "javascript:alert(1)" },
    ]);
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<a ");
    expect(html).toContain("Click");
  });

  it("leaves unlinked blocks untouched", () => {
    expect(renderBlocksToEmailHtml([{ id: "t", type: "text", text: "Plain" }])).not.toContain("<a ");
  });

  it("surfaces the destination in the plain-text alternative", () => {
    const text = renderBlocksToText([
      { id: "t", type: "text", text: "Read the guide", url: "https://icapos.com/guide" },
    ]);
    expect(text).toContain("Read the guide (https://icapos.com/guide)");
  });

  it("recovers a link from a paragraph that is only a link", () => {
    const blocks = parseHtmlToBlocks('<p><a href="https://icapos.com/x">Open your pipeline</a></p>');
    expect(blocks[0]).toMatchObject({ type: "text", text: "Open your pipeline", url: "https://icapos.com/x" });
  });

  it("does not attach a URL when the link is mid-sentence", () => {
    const blocks = parseHtmlToBlocks('<p>Read the <a href="https://x.com">docs</a> first.</p>');
    expect(blocks[0]).not.toHaveProperty("url");
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
  it("keeps paragraphs as separate text blocks", () => {
    const seeded = seedBlocksFromHtml("Welcome", "<p>First para</p><p>Second para</p>");
    expect(seeded.some((b) => b.type === "text" && b.text.includes("First para"))).toBe(true);
    expect(seeded.some((b) => b.type === "text" && b.text.includes("Second para"))).toBe(true);
  });

  it("falls back to the subject heading when the body has no content", () => {
    const seeded = seedBlocksFromHtml("Welcome", "");
    expect(seeded[0]).toMatchObject({ type: "heading", text: "Welcome" });
  });

  it("never returns an empty document", () => {
    expect(seedBlocksFromHtml("", "").length).toBeGreaterThan(0);
  });
});

describe("parseHtmlToBlocks", () => {
  const digest = `
    <table role="presentation" width="600">
      <tr><td align="center"><img src="https://cdn.example.com/logo.png" alt="iCapOS" width="132" /></td></tr>
      <tr><td><h1 style="color:#ffffff;">This month's matched founders</h1></td></tr>
      <tr><td><p>A new cohort has completed their assessment.</p></td></tr>
      <tr><td align="center">
        <a href="https://icapos.com/pipeline" style="background:#5B4BE0;color:#ffffff;display:inline-block;padding:12px 22px;">Open your pipeline</a>
      </td></tr>
      <tr><td><hr /></td></tr>
    </table>`;

  it("preserves headings rather than flattening them to text", () => {
    const blocks = parseHtmlToBlocks(digest);
    expect(blocks).toContainEqual(
      expect.objectContaining({ type: "heading", text: "This month's matched founders" }),
    );
  });

  it("preserves images with their src, alt, and width", () => {
    const img = parseHtmlToBlocks(digest).find((b) => b.type === "image");
    expect(img).toMatchObject({ src: "https://cdn.example.com/logo.png", alt: "iCapOS", width: 132 });
  });

  it("turns styled links into button blocks with their background", () => {
    const btn = parseHtmlToBlocks(digest).find((b) => b.type === "button");
    expect(btn).toMatchObject({
      label: "Open your pipeline",
      url: "https://icapos.com/pipeline",
      bg: "#5B4BE0",
    });
  });

  it("keeps plain inline links as text, not buttons", () => {
    const blocks = parseHtmlToBlocks('<p>Read the <a href="https://x.com">docs</a> first.</p>');
    expect(blocks.every((b) => b.type !== "button")).toBe(true);
    expect(blocks.some((b) => b.type === "text" && b.text.includes("docs"))).toBe(true);
  });

  it("preserves horizontal rules as dividers", () => {
    expect(parseHtmlToBlocks(digest).some((b) => b.type === "divider")).toBe(true);
  });

  it("carries alignment down from the containing cell", () => {
    const blocks = parseHtmlToBlocks('<td align="center"><p>Centered</p></td>');
    expect(blocks.find((b) => b.type === "text")).toMatchObject({ align: "center" });
  });

  it("drops script and style content", () => {
    const blocks = parseHtmlToBlocks("<style>p{color:red}</style><script>alert(1)</script><p>Body</p>");
    const text = blocks.map((b) => (b.type === "text" ? b.text : "")).join(" ");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("color:red");
    expect(text).toContain("Body");
  });

  it("survives a round trip through the renderer", () => {
    const html = renderBlocksToEmailHtml(parseHtmlToBlocks(digest));
    expect(html).toContain("This month's matched founders");
    expect(html).toContain("https://icapos.com/pipeline");
    expect(html).toContain("https://cdn.example.com/logo.png");
  });
});

describe("stripHtmlToText", () => {
  it("converts breaks and tags to plain text", () => {
    expect(stripHtmlToText("<p>a</p><p>b</p>")).toBe("a\n\nb");
  });
});
